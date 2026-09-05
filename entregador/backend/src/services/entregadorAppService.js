const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * List orders assigned to a delivery driver
 * Returns orders WITHOUT total value (driver shouldn't see it before delivery)
 */
async function listarPedidos(empresaId, entregadorId, status) {
  const where = {
    empresaId,
    entregadorId: String(entregadorId),
    deletedAt: null,
  };

  if (status && status !== 'all') {
    where.status = status;
  } else {
    // Default: show em_rota and pendente (active deliveries)
    where.status = { in: ['em_rota', 'pendente'] };
  }

  const pedidos = await prisma.pedido.findMany({
    where,
    include: {
      itens: {
        include: { produto: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Map to remove sensitive data (total, valoresItens, taxasEntrega)
  return pedidos.map(p => ({
    id: p.id,
    clienteNome: p.clienteNome,
    clienteWhatsapp: p.clienteWhatsapp,
    clienteEndereco: p.clienteEndereco,
    clienteNumero: p.clienteNumero,
    clienteBairro: p.clienteBairro,
    clienteReferencia: p.clienteReferencia,
    tipoEntrega: p.tipoEntrega,
    formaPagamento: p.formaPagamento,
    troco: p.troco,
    status: p.status,
    lat: p.lat,
    lon: p.lon,
    createdAt: p.createdAt,
    itens: p.itens.map(i => ({
      quantidade: i.quantidade,
      nome: i.produto?.name || 'Produto',
      sabores: i.sabores,
    })),
  }));
}

/**
 * Get single order details (for confirmation modal)
 * Returns items but NOT total value
 */
async function buscarPedido(pedidoId, empresaId, entregadorId) {
  const pedido = await prisma.pedido.findFirst({
    where: {
      id: pedidoId,
      empresaId,
      entregadorId: String(entregadorId),
    },
    include: {
      itens: {
        include: { produto: { select: { name: true, price: true } } },
      },
    },
  });

  if (!pedido) return null;

  return {
    id: pedido.id,
    clienteNome: pedido.clienteNome,
    clienteWhatsapp: pedido.clienteWhatsapp,
    clienteEndereco: pedido.clienteEndereco,
    clienteNumero: pedido.clienteNumero,
    clienteBairro: pedido.clienteBairro,
    clienteReferencia: pedido.clienteReferencia,
    tipoEntrega: pedido.tipoEntrega,
    formaPagamento: pedido.formaPagamento,
    troco: pedido.troco,
    status: pedido.status,
    lat: pedido.lat,
    lon: pedido.lon,
    createdAt: pedido.createdAt,
    // Delivery fee is shown to driver (their earnings)
    taxaEntrega: pedido.taxasEntrega,
    itens: pedido.itens.map(i => ({
      quantidade: i.quantidade,
      nome: i.produto?.name || 'Produto',
      precoUnitario: i.precoUnitario,
      sabores: i.sabores,
    })),
  };
}

/**
 * Confirm delivery
 * Sets EntregaDiaria.valor = pedido.taxasEntrega (driver's earnings)
 * Sets EntregaDiaria.valorCobrado = what client paid (for reconciliation)
 */
async function confirmarEntrega(pedidoId, empresaId, entregadorId, valorCobrado, observacao) {
  // Fetch pedido to get delivery fee
  const pedido = await prisma.pedido.findFirst({
    where: {
      id: pedidoId,
      empresaId,
      entregadorId: String(entregadorId),
    },
  });

  if (!pedido) {
    throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  }

  if (pedido.status !== 'em_rota' && pedido.status !== 'pendente') {
    throw Object.assign(new Error('Pedido não pode ser confirmado neste status'), { status: 400 });
  }

  // Update pedido status
  await prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      status: 'finalizado',
      finalizadoEm: new Date(),
    },
  });

  // Create EntregaDiaria
  const entrega = await prisma.entregaDiaria.create({
    data: {
      empresaId,
      entregadorId: Number(entregadorId),
      pedidoId,
      data: new Date(),
      valor: pedido.taxasEntrega || 0, // Driver's earnings = delivery fee
      valorCobrado: valorCobrado || 0, // What client paid (for reconciliation)
      status: 'entregue',
      confirmadoEm: new Date(),
      observacao,
    },
  });

  return entrega;
}

/**
 * Register delivery failure
 */
async function registrarFalha(pedidoId, empresaId, entregadorId, motivo) {
  const pedido = await prisma.pedido.findFirst({
    where: {
      id: pedidoId,
      empresaId,
      entregadorId: String(entregadorId),
    },
  });

  if (!pedido) {
    throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  }

  // Update pedido status back to pendente (so admin can reassign)
  await prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      status: 'pendente',
      entregadorId: null,
    },
  });

  // Register failure in EntregaDiaria
  const entrega = await prisma.entregaDiaria.create({
    data: {
      empresaId,
      entregadorId: Number(entregadorId),
      pedidoId,
      data: new Date(),
      valor: 0,
      status: 'falha',
      observacao: motivo,
    },
  });

  return entrega;
}

/**
 * Get delivery history grouped by day
 * Returns EntregaDiaria.valor (delivery fee), NOT order total
 */
async function buscarHistorico(entregadorId, empresaId, inicio, fim) {
  const start = new Date(inicio);
  start.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(23, 59, 59, 999);

  const entregas = await prisma.entregaDiaria.findMany({
    where: {
      entregadorId: Number(entregadorId),
      empresaId,
      data: { gte: start, lte: end },
      status: 'entregue',
    },
    include: {
      pedido: {
        select: {
          clienteNome: true,
          formaPagamento: true,
        },
      },
    },
    orderBy: { data: 'desc' },
  });

  // Group by day
  const grouped = {};
  for (const e of entregas) {
    const day = e.data.toISOString().split('T')[0];
    if (!grouped[day]) {
      grouped[day] = { date: day, entregas: [], total: 0, count: 0 };
    }
    grouped[day].entregas.push({
      id: e.id,
      pedidoId: e.pedidoId,
      clienteNome: e.pedido?.clienteNome || 'Cliente',
      formaPagamento: e.pedido?.formaPagamento || 'N/A',
      valor: e.valor, // Delivery fee (driver's earnings)
      confirmadoEm: e.confirmadoEm,
    });
    grouped[day].total += Number(e.valor);
    grouped[day].count += 1;
  }

  // Calculate grand total
  const days = Object.values(grouped);
  const grandTotal = days.reduce((sum, d) => sum + d.total, 0);
  const totalCount = days.reduce((sum, d) => sum + d.count, 0);

  return {
    entregas: days,
    resumo: {
      total: grandTotal,
      quantidade: totalCount,
    },
  };
}

/**
 * Get driver profile
 */
async function buscarPerfil(entregadorId, empresaId) {
  const entregador = await prisma.entregador.findFirst({
    where: { id: Number(entregadorId), empresaId },
    select: {
      id: true,
      nome: true,
      telefone: true,
      whatsapp: true,
      endereco: true,
      chavePix: true,
      empresa: { select: { nome: true } },
    },
  });

  if (!entregador) {
    throw Object.assign(new Error('Entregador não encontrado'), { status: 404 });
  }

  return entregador;
}

/**
 * Update driver profile (limited fields)
 */
async function atualizarPerfil(entregadorId, empresaId, data) {
  const allowedFields = ['whatsapp', 'endereco', 'chavePix'];
  const updateData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  const entregador = await prisma.entregador.findFirst({
    where: { id: Number(entregadorId), empresaId },
  });

  if (!entregador) {
    throw Object.assign(new Error('Entregador não encontrado'), { status: 404 });
  }

  await prisma.entregador.update({
    where: { id: Number(entregadorId) },
    data: updateData,
  });

  return { success: true };
}

module.exports = {
  listarPedidos,
  buscarPedido,
  confirmarEntrega,
  registrarFalha,
  buscarHistorico,
  buscarPerfil,
  atualizarPerfil,
};
