import prisma from '../config/prisma.js';
import { normalizePedido } from '../integrations/saas/SaasFinancialProvider.js';
import { getProvider } from '../integrations/core/registry.js';
import { PLATFORMS } from '../integrations/core/types.js';
import logger from '../config/logger.js';

export async function upsertEntry(normalized) {
  const { empresaId, source, externalId, ...data } = normalized;
  return prisma.financialEntry.upsert({
    where: { empresaId_source_externalId: { empresaId, source, externalId } },
    update: data,
    create: { empresaId, source, externalId, ...data },
  });
}

export async function syncSaas(empresaId) {
  const pedidos = await prisma.pedido.findMany({
    where: { empresaId, status: 'pago', deletedAt: null },
    select: { id: true, empresaId: true, total: true, desconto: true, taxasEntrega: true, taxasCartao: true, createdAt: true },
  });

  const pedidoIds = pedidos.map(p => p.id);
  if (pedidoIds.length === 0) return { created: 0, updated: 0 };

  // Batch: all pagamentos for these pedidos (single query, not N)
  const todosPagamentos = await prisma.pagamento.findMany({
    where: { pedidoId: { in: pedidoIds }, status: 'pago' },
    select: { pedidoId: true, valor: true },
  });
  const somaPorPedido = new Map();
  for (const pg of todosPagamentos) {
    somaPorPedido.set(pg.pedidoId, (somaPorPedido.get(pg.pedidoId) || 0) + Number(pg.valor));
  }

  // Batch: all existing financial entries (single query, not N)
  const existentes = await prisma.financialEntry.findMany({
    where: { empresaId, source: PLATFORMS.SAAS, externalId: { in: pedidoIds } },
    select: { externalId: true },
  });
  const existSet = new Set(existentes.map(e => e.externalId));

  let created = 0;
  let updated = 0;
  for (const pedido of pedidos) {
    const soma = somaPorPedido.get(pedido.id);
    const recebido = soma != null
      ? soma
      : Number(pedido.total || 0) - Number(pedido.desconto || 0) - Number(pedido.taxasEntrega || 0) - Number(pedido.taxasCartao || 0);
    const normalized = normalizePedido(pedido, recebido);
    await upsertEntry(normalized);
    if (existSet.has(pedido.id)) updated += 1;
    else created += 1;
  }
  return { created, updated };
}

export async function syncEmpresa(empresaId, opts = {}) {
  const result = { created: 0, updated: 0, sources: ['SAAS'] };
  const saas = await syncSaas(empresaId);
  result.created += saas.created;
  result.updated += saas.updated;

  // Marketplaces: somente providers configurados com conexão ativa
  for (const platform of ['IFOOD', 'KEETA', 'FOOD99']) {
    const provider = getProvider(platform);
    if (!provider || !provider.isConfigured()) continue;
    const connection = await prisma.platformConnection.findUnique({
      where: { empresaId_platform: { empresaId, platform } },
    });
    if (!connection || connection.status !== 'CONNECTED') continue;
    try {
      const from = opts.from ? new Date(opts.from) : new Date(Date.now() - 90 * 24 * 3600 * 1000);
      const to = opts.to ? new Date(opts.to) : new Date();
      const entries = await provider.syncFinancialData(connection, from, to);
      for (const e of entries) {
        await upsertEntry(e);
        result.created += 1;
      }
      result.sources.push(platform);
    } catch (err) {
      logger.warn({ empresaId, platform, err: err.message }, 'sync marketplace falhou');
    }
  }
  return result;
}

export default { syncEmpresa, syncSaas, upsertEntry };
