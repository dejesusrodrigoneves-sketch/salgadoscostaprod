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

  let created = 0;
  let updated = 0;
  for (const pedido of pedidos) {
    const pagamentos = await prisma.pagamento.findMany({
      where: { pedidoId: pedido.id, status: 'pago' },
      select: { valor: true },
    });
    const recebido = pagamentos.length
      ? pagamentos.reduce((s, p) => s + Number(p.valor), 0)
      : Number(pedido.total || 0) - Number(pedido.desconto || 0) - Number(pedido.taxasEntrega || 0) - Number(pedido.taxasCartao || 0);

    const normalized = normalizePedido(pedido, recebido);
    const existing = await prisma.financialEntry.findUnique({
      where: { empresaId_source_externalId: { empresaId, source: PLATFORMS.SAAS, externalId: pedido.id } },
      select: { id: true },
    });
    await upsertEntry(normalized);
    if (existing) updated += 1;
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
  for (const platform of ['IFOOD', 'KEETA', 'NINEFOOD']) {
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
