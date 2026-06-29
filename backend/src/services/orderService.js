const prisma = require('../config/prisma');
const sql = require('../repositories/sqlRepository');
const whatsapp = require('./whatsappService');

async function listar(empresaId, filtros) {
  return sql.listarPedidos(empresaId, filtros);
}

async function buscar(id) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  return pedido;
}

async function criar(data) {
  const pedidoId = await sql.nextPedidoId(data.empresaId);
  const pedido = { ...data, id: pedidoId };
  await sql.criarPedido(pedido);
  return pedido;
}

async function darBaixaEstoque(pedido) {
  if (!pedido.itens || pedido.itens.length === 0) return;
  for (const item of pedido.itens) {
    const produto = await sql.buscarProduto(pedido.empresaId || 1, item.produtoId);
    if (produto && produto.controlaEstoque) {
      const novoEstoque = Math.max(0, produto.estoqueAtual - item.quantidade);
      const updates = { estoqueAtual: novoEstoque };
      if (novoEstoque === 0 && produto.hideWhenOutOfStock) {
        updates.status = 'paused';
      }
      await sql.atualizarProduto(item.produtoId, updates);
    }
  }
}

async function listarFiltrado(empresaId, filtros) {
  const where = { empresaId };
  if (filtros.status) {
    var statusList = filtros.status.split(',');
    if (statusList.length === 1) where.status = statusList[0];
    else where.status = { in: statusList };
  }
  if (filtros.createdAtFrom || filtros.createdAtTo) {
    where.createdAt = {};
    if (filtros.createdAtFrom) where.createdAt.gte = new Date(filtros.createdAtFrom);
    if (filtros.createdAtTo) where.createdAt.lte = new Date(filtros.createdAtTo);
  }
  return prisma.pedido.findMany({ where, orderBy: { createdAt: filtros.order === 'asc' ? 'asc' : 'desc' }, include: { itens: true } });
}

async function deletarPedido(empresaId, id) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido || pedido.empresaId !== empresaId) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  // Delete child itens first
  await prisma.itensPedido.deleteMany({ where: { pedidoId: id } });
  return prisma.pedido.delete({ where: { id } });
}

async function finalizarPedido(empresaId, id) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido || pedido.empresaId !== empresaId) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  return sql.atualizarPedido(id, { status: 'finalizado', finalizadoEm: new Date() });
}

async function atualizarStatus(id, status) {
  const updates = { status };
  if (status === 'finalizado') updates.finalizadoEm = new Date();

  const pedido = await sql.atualizarPedido(id, updates);

  // Baixa de estoque ao confirmar pedido (status = aceito/producao)
  if (['aceito', 'producao'].includes(status)) {
    const pedidoCompleto = await sql.buscarPedido(id);
    darBaixaEstoque(pedidoCompleto).catch(err => console.error('Erro baixa estoque:', err));
  }

  if (['producao', 'pronto', 'em_rota'].includes(status)) {
    whatsapp.notificarStatus(pedido, status).catch(() => {});
  }
  return pedido;
}

module.exports = { listar, buscar, criar, atualizarStatus, deletarPedido, finalizarPedido, listarFiltrado, darBaixaEstoque };
