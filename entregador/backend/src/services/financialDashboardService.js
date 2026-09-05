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

export async function balancoConsolidado(empresaId, { desde, ate, plataforma } = {}) {
  // 1. Buscar filiais da matriz
  const filiais = await prisma.empresa.findMany({
    where: { parentEmpresaId: Number(empresaId) },
    select: { id: true, nome: true },
  });

  // Grupo: matriz + filiais
  const grupoIds = [Number(empresaId), ...filiais.map(f => f.id)];

  // 2. Buscar dados da matriz para incluir no breakdown
  const matriz = await prisma.empresa.findUnique({
    where: { id: Number(empresaId) },
    select: { id: true, nome: true },
  });

  // 3. Aggregate de todas as empresas do grupo
  const where = {
    empresaId: { in: grupoIds },
  };
  if (desde || ate) {
    where.transactionDate = {};
    if (desde) where.transactionDate.gte = new Date(desde);
    if (ate) where.transactionDate.lte = new Date(ate);
  }
  if (plataforma && plataforma !== 'todas') {
    where.source = plataforma.toUpperCase();
  }

  const agg = await prisma.financialEntry.aggregate({
    where,
    _sum: {
      grossAmount: true,
      discountAmount: true,
      platformFee: true,
      paymentFee: true,
      otherFees: true,
      netAmount: true,
      receivedAmount: true,
    },
  });

  const s = agg._sum || {};
  const fees = Number(s.platformFee || 0) + Number(s.paymentFee || 0) + Number(s.otherFees || 0);
  const net = Number(s.netAmount || 0);
  const received = Number(s.receivedAmount || 0);

  // 4. GroupBy empresaId para breakdown
  const porEmpresaRaw = await prisma.financialEntry.groupBy({
    by: ['empresaId'],
    where: {
      empresaId: { in: grupoIds },
      ...(desde || ate ? { transactionDate: where.transactionDate } : {}),
      ...(plataforma && plataforma !== 'todas' ? { source: plataforma.toUpperCase() } : {}),
    },
    _sum: { netAmount: true },
  });

  const porEmpresa = porEmpresaRaw.map(g => {
    const info = g.empresaId === Number(empresaId)
      ? matriz
      : filiais.find(f => f.id === g.empresaId);
    return {
      empresaId: g.empresaId,
      nome: info?.nome || 'Desconhecido',
      tipo: g.empresaId === Number(empresaId) ? 'matriz' : 'filial',
      net: round2(Number(g._sum.netAmount || 0)),
    };
  }).sort((a, b) => b.net - a.net);

  // 5. GroupBy source para plataforma
  const porPlataforma = await prisma.financialEntry.groupBy({
    by: ['source'],
    where: {
      empresaId: { in: grupoIds },
      ...(desde || ate ? { transactionDate: where.transactionDate } : {}),
    },
    _sum: { netAmount: true },
  });

  return {
    consolidated: {
      gross: round2(Number(s.grossAmount || 0)),
      discounts: round2(Number(s.discountAmount || 0)),
      fees: round2(fees),
      net: round2(net),
      received: round2(received),
      receivable: round2(Math.max(0, net - received)),
    },
    porEmpresa,
    porPlataforma: porPlataforma.map(g => ({
      source: g.source,
      net: round2(Number(g._sum.netAmount || 0)),
    })),
  };
}

export default { balanco, entradas, balancoConsolidado };
