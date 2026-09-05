const prisma = require('../config/prisma');
const logger = require('../config/logger');
const auditService = require('./auditService');
const sql = require('../repositories/sqlRepository');

async function listarEntregas(data, empresaId) {
  const where = { empresaId };
  if (data) {
    const start = new Date(data + 'T00:00:00.000Z');
    const end = new Date(data + 'T23:59:59.999Z');
    where.data = { gte: start, lte: end };
  }
  return prisma.entregaDiaria.findMany({
    where,
    include: { entregador: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function registrarEntrega(entregadorId, pedidoId, valor, empresaId, ctx = {}) {
  const existente = await prisma.entregaDiaria.findFirst({
    where: { empresaId, pedidoId },
  });
  if (existente) {
    throw Object.assign(new Error('Entrega já registrada para este pedido'), { status: 409 });
  }
  const entrega = await prisma.entregaDiaria.create({
    data: {
      empresaId,
      entregadorId: Number(entregadorId),
      pedidoId,
      valor: valor || 0,
      data: new Date(),
    },
  });
  logger.info(`Entrega registrada: pedido ${pedidoId}, entregador ${entregadorId}, valor ${valor}`);

  auditService.audit({
    ...ctx,
    action: 'entrega.registrar',
    module: 'entregas',
    targetType: 'entrega',
    targetId: entrega.id,
    after: { pedidoId, entregadorId: Number(entregadorId), valor: Number(valor || 0) },
    changedFields: ['pedidoId', 'entregadorId', 'valor'],
  });

  return entrega;
}

async function removerEntrega(pedidoId, empresaId, ctx = {}) {
  const entrega = await prisma.entregaDiaria.findFirst({
    where: { empresaId, pedidoId },
  });
  if (!entrega) {
    throw Object.assign(new Error('Entrega não encontrada'), { status: 404 });
  }
  await prisma.entregaDiaria.delete({ where: { id: entrega.id } });
  logger.info(`Entrega removida: pedido ${pedidoId}`);

  auditService.audit({
    ...ctx,
    action: 'entrega.remover',
    module: 'entregas',
    targetType: 'entrega',
    targetId: entrega.id,
    after: { pedidoId, entregadorId: entrega.entregadorId, valor: Number(entrega.valor || 0) },
    changedFields: ['pedidoId', 'entregadorId', 'valor'],
    severity: 'warning',
  });

  return { success: true };
}

function agruparPorEntregador(entregas) {
  const map = {};
  for (const e of entregas) {
    const id = e.entregadorId;
    if (!map[id]) {
      map[id] = { id, nome: e.entregador.nome, entregas: 0, valorTotal: 0, totalPedidos: 0 };
    }
    map[id].entregas += 1;
    map[id].valorTotal += Number(e.valor || 0);
  }
  return Object.values(map);
}

async function resumoDiario(data, empresaId) {
  const dataInicio = data ? new Date(data + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const dataFim = new Date(dataInicio);
  dataFim.setUTCHours(23, 59, 59, 999);

  const entregas = await prisma.entregaDiaria.findMany({
    where: { empresaId, data: { gte: dataInicio, lte: dataFim } },
    include: { entregador: true },
  });

  const entregadores = agruparPorEntregador(entregas);

  return {
    data: dataInicio.toISOString().slice(0, 10),
    totalEntregas: entregas.length,
    totalValor: entregas.reduce((acc, e) => acc + Number(e.valor || 0), 0),
    totalPedidos: entregadores.reduce((a, d) => a + d.totalPedidos, 0),
    entregadores,
  };
}

async function montarResumoPeriodo(entregas, buscarPedidoFn) {
  if (!entregas.length) return { totalEntregas: 0, totalValor: 0, totalPedidos: 0, entregadores: [] };

  const pedidoIds = [...new Set(entregas.map(e => e.pedidoId))];
  let pedidos;
  try {
    pedidos = await buscarPedidoFn(pedidoIds);
  } catch {
    pedidos = pedidoIds.map(id => ({ id, itens: [] }));
  }
  if (!Array.isArray(pedidos)) pedidos = [];
  const pedidoMap = new Map(pedidos.filter(Boolean).map(p => [p.id, p]));

  const map = {};
  for (const e of entregas) {
    const pedido = pedidoMap.get(e.pedidoId);
    if (pedido == null) continue;

    const id = e.entregadorId;
    if (!map[id]) {
      map[id] = { id, nome: e.entregador.nome, entregas: 0, valorTotal: 0, totalPedidos: 0, pedidos: [] };
    }
    map[id].entregas += 1;
    map[id].valorTotal += Number(e.valor || 0);
    map[id].totalPedidos += Number(pedido.total || 0);
    map[id].pedidos.push({
      pedidoId: e.pedidoId,
      valor: Number(e.valor || 0),
      cliente: pedido.clienteNome || '-',
      itens: Array.isArray(pedido.itens) ? pedido.itens.map(function (i) {
        return {
          produtoId: i.produtoId,
          nome: i.produto ? i.produto.name : 'Produto #' + i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario
        };
      }) : [],
      totalPedido: Number(pedido.total || 0),
      formaPagamento: pedido.formaPagamento || '-',
      tipoEntrega: pedido.tipoEntrega || '-',
      bairro: pedido.clienteBairro || '-',
      data: pedido.createdAt || null,
    });
  }

  const entregadores = Object.values(map);
  return {
    totalEntregas: entregadores.reduce((a, d) => a + d.entregas, 0),
    totalValor: entregadores.reduce((acc, d) => acc + d.valorTotal, 0),
    totalPedidos: entregadores.reduce((a, d) => a + d.totalPedidos, 0),
    entregadores,
  };
}

async function resumoPorPeriodo(inicio, fim, entregadorId, empresaId, ctx = {}) {
  const where = {
    empresaId,
    entregadorId: entregadorId ? Number(entregadorId) : undefined,
    data: { gte: new Date(inicio + 'T00:00:00.000Z'), lte: new Date(fim + 'T23:59:59.999Z') },
  };
  const entregas = await prisma.entregaDiaria.findMany({
    where,
    include: { entregador: true },
    orderBy: { createdAt: 'asc' },
  });

  const resultado = await montarResumoPeriodo(entregas, sql.listarPedidosPorIds);
  return { inicio, fim, ...resultado };
}

module.exports = { listarEntregas, registrarEntrega, removerEntrega, resumoDiario, resumoPorPeriodo, agruparPorEntregador, montarResumoPeriodo };
