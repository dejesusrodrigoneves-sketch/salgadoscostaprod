import prisma from '../config/prisma.js';

function round2(v) { return Math.round(v * 100) / 100; }

function buildWhere(empresaId, { desde, ate, plataforma }) {
  const where = { empresaId };
  if (desde || ate) {
    where.transactionDate = {};
    if (desde) where.transactionDate.gte = new Date(desde);
    if (ate) where.transactionDate.lte = new Date(ate);
  }
  if (plataforma && plataforma !== 'todas') where.source = plataforma.toUpperCase();
  return where;
}

export async function balanco(empresaId, { desde, ate, plataforma } = {}) {
  const where = buildWhere(empresaId, { desde, ate, plataforma });

  const agg = await prisma.financialEntry.aggregate({
    where,
    _sum: { grossAmount: true, discountAmount: true, platformFee: true, paymentFee: true, otherFees: true, netAmount: true, receivedAmount: true },
  });
  const s = agg._sum || {};
  const fees = Number(s.platformFee || 0) + Number(s.paymentFee || 0) + Number(s.otherFees || 0);
  const net = Number(s.netAmount || 0);
  const received = Number(s.receivedAmount || 0);

  const grupos = await prisma.financialEntry.groupBy({
    by: ['source'],
    where: { empresaId, ...(desde || ate ? { transactionDate: where.transactionDate } : {}) },
    _sum: { netAmount: true },
  });

  return {
    gross: round2(Number(s.grossAmount || 0)),
    discounts: round2(Number(s.discountAmount || 0)),
    fees: round2(fees),
    net: round2(net),
    received: round2(received),
    receivable: round2(Math.max(0, net - received)),
    porPlataforma: grupos.map(g => ({ source: g.source, net: round2(Number(g._sum.netAmount || 0)) })),
  };
}

export async function entradas(empresaId, { page = 1, desde, ate, plataforma } = {}) {
  const limit = 50;
  const skip = (page - 1) * limit;
  const where = buildWhere(empresaId, { desde, ate, plataforma });
  const [entries, total] = await Promise.all([
    prisma.financialEntry.findMany({ where, orderBy: { transactionDate: 'desc' }, skip, take: limit }),
    prisma.financialEntry.count({ where }),
  ]);
  return { entries, total, page, limit };
}

export default { balanco, entradas };
