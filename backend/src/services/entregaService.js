const prisma = require('../config/prisma');
const logger = require('../config/logger');

async function listarEntregas(empresaId, data) {
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

async function registrarEntrega(empresaId, entregadorId, pedidoId, valor) {
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
  return entrega;
}

async function removerEntrega(empresaId, pedidoId) {
  const entrega = await prisma.entregaDiaria.findFirst({
    where: { empresaId, pedidoId },
  });
  if (!entrega) {
    throw Object.assign(new Error('Entrega não encontrada'), { status: 404 });
  }
  await prisma.entregaDiaria.delete({ where: { id: entrega.id } });
  logger.info(`Entrega removida: pedido ${pedidoId}`);
  return { success: true };
}

async function resumoDiario(empresaId, data) {
  const dataInicio = data ? new Date(data + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const dataFim = new Date(dataInicio);
  dataFim.setUTCHours(23, 59, 59, 999);

  const entregas = await prisma.entregaDiaria.findMany({
    where: { empresaId, data: { gte: dataInicio, lte: dataFim } },
    include: { entregador: true },
  });

  const totalEntregas = entregas.length;
  const totalValor = entregas.reduce((acc, e) => acc + Number(e.valor || 0), 0);

  const entregadoresMap = {};
  for (const e of entregas) {
    const id = e.entregadorId;
    if (!entregadoresMap[id]) {
      entregadoresMap[id] = {
        id,
        nome: e.entregador.nome,
        entregas: 0,
        totalValor: 0,
      };
    }
    entregadoresMap[id].entregas += 1;
    entregadoresMap[id].totalValor += Number(e.valor || 0);
  }

  return {
    data: dataInicio.toISOString().slice(0, 10),
    totalEntregas,
    totalValor,
    entregadores: Object.values(entregadoresMap),
  };
}

module.exports = { listarEntregas, registrarEntrega, removerEntrega, resumoDiario };
