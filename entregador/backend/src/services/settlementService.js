import sql from '../repositories/sqlRepository.js';
import prisma from '../config/prisma.js';
import auditService from './auditService.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { decrypt } from '../utils/crypto.js';
import asaasClient from './asaasClient.js';
import { getNextBusinessDay } from '../utils/businessDays.js';

/**
 * Calcula weekStart (segunda 00:00) e weekEnd (sexta 23:59:59) para uma data.
 */
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: friday };
}

/**
 * Fecha a semana para uma empresa (chamado pelo job sab 00:00).
 * Retorna settlement criado ou null se sem pedidos.
 */
async function fecharSemana(empresaId, referenceDate = new Date()) {
  const { weekStart, weekEnd } = getWeekRange(referenceDate);

  // Verificar se ja existe settlement para esta semana (idempotencia)
  const existing = await sql.buscarSettlementActual(empresaId, weekStart);
  if (existing) return existing;

  // Buscar pedidos pagos no periodo
  const pedidos = await sql.buscarPedidosPagosNoPeriodo(empresaId, weekStart, weekEnd);
  if (!pedidos || pedidos.length === 0) return null;

  // Calcular totais
  const totalPedidos = pedidos.length;
  const totalBruto = pedidos.reduce((sum, p) => sum + Number(p.total), 0);
  const totalLiquido = totalBruto * (1 - (env.asaasPixFeePercent || 2) / 100);

  // Criar settlement
  const settlement = await sql.criarSettlement({
    empresaId,
    weekStart,
    weekEnd,
    totalPedidos,
    totalBruto,
    totalLiquido,
    status: 'pendente',
    processedAt: new Date(),
  });

  // Lookup empresa + schedule transfer
  const empresa = await sql.buscarEmpresa(empresaId);
  const splitStatus = (empresa && empresa.asaasOnboarded) ? 'auto' : 'manual';

  let transferId = null;
  let transferStatus = null;
  let transferScheduledAt = null;
  let transferAmount = null;
  let splitError = null;

  if (empresa && empresa.asaasOnboarded && empresa.pixKey) {
    try {
      const decryptedKey = decrypt(empresa.asaasApiKey);
      const saldo = await asaasClient.consultarSaldo({
        accessToken: decryptedKey,
        subcontaId: empresa.asaasSubcontaId,
      });

      if (saldo.available <= 0) {
        logger.warn({ empresaId, available: saldo.available }, 'No balance available for transfer');
      } else {
        transferAmount = Math.min(Number(totalLiquido), saldo.available);
        const scheduleDate = getNextBusinessDay(weekEnd);

        const transfer = await asaasClient.agendarTransferencia({
          accessToken: decryptedKey,
          valor: transferAmount,
          pixAddressKey: empresa.pixKey,
          pixAddressKeyType: empresa.pixKeyType,
          scheduleDate,
          description: `Settlement ${weekStart} - ${weekEnd}`,
        });

        transferId = transfer.id;
        transferStatus = 'scheduled';
        transferScheduledAt = new Date();
      }
    } catch (err) {
      logger.error({ err, empresaId }, 'Failed to schedule transfer');
      splitError = err.message;
    }
  }

  // Persist split + transfer fields
  await sql.atualizarSettlement(settlement.id, {
    splitStatus,
    splitError,
    transferId,
    transferStatus,
    transferScheduledAt,
    transferAmount,
  });

  Object.assign(settlement, {
    splitStatus,
    splitError,
    transferId,
    transferStatus,
    transferScheduledAt,
    transferAmount,
  });

  // Marcar pedidos como arquivados
  await sql.marcarPedidosArquivados(empresaId, weekStart, weekEnd);

  // Audit log
  auditService.audit({
    action: 'settlement.created',
    module: 'settlements',
    targetType: 'settlement',
    targetId: settlement.id,
    after: { empresaId, totalPedidos, totalBruto, totalLiquido },
    severity: 'info',
  });

  return settlement;
}

/**
 * Busca settlement da semana atual para uma empresa.
 */
async function buscarActual(empresaId) {
  const now = new Date();
  const { weekStart } = getWeekRange(now);
  return sql.buscarSettlementActual(empresaId, weekStart);
}

/**
 * Busca historico de settlements (paginado).
 */
async function buscarHistory(empresaId, page = 1) {
  return sql.listarSettlements(empresaId, page);
}

/**
 * Busca detalhe de um settlement.
 */
async function buscarDetalhe(id) {
  return sql.buscarSettlementPorId(id);
}

/**
 * Lista settlements globais (superadmin).
 */
async function listarSettlementsGlobais(page = 1, limit = 20, empresaId = null) {
  const skip = (page - 1) * limit;
  const where = empresaId ? { empresaId } : {};
  const [settlements, total] = await Promise.all([
    prisma.weeklySettlement.findMany({
      where,
      orderBy: { weekStart: 'desc' },
      skip,
      take: limit,
      include: { empresa: { select: { id: true, nome: true, slug: true } } },
    }),
    prisma.weeklySettlement.count({ where }),
  ]);
  return { settlements, total, page, limit };
}

/**
 * Confirma pagamento de um settlement (webhook Asaas).
 * Se empresa deletada e nenhum pendente -> hard delete.
 */
async function confirmarPagamento(settlementId, asaasTransferId = null) {
  const settlement = await sql.buscarSettlementPorId(settlementId);
  if (!settlement) throw Object.assign(new Error('Settlement nao encontrado'), { status: 404 });

  await sql.atualizarSettlement(settlementId, {
    status: 'pago',
    paidAt: new Date(),
    asaasTransferId,
  });

  // Verificar se empresa pode ser hard-deletada
  const pendentes = await sql.countSettlementsPendentes(settlement.empresaId);
  if (pendentes === 0) {
    const empresa = await sql.buscarEmpresa(settlement.empresaId);
    if (empresa && empresa.deletedAt) {
      await sql.hardDeleteEmpresa(settlement.empresaId);
      auditService.audit({
        action: 'empresa.hard_deleted',
        module: 'empresas',
        targetType: 'empresa',
        targetId: settlement.empresaId,
        severity: 'info',
      });
    }
  }

  return { success: true };
}

export {
  getWeekRange,
  fecharSemana,
  buscarActual,
  buscarHistory,
  buscarDetalhe,
  listarSettlementsGlobais,
  confirmarPagamento,
};

export default {
  getWeekRange,
  fecharSemana,
  buscarActual,
  buscarHistory,
  buscarDetalhe,
  listarSettlementsGlobais,
  confirmarPagamento,
};
