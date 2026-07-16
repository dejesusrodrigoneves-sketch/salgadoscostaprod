const prisma = require('../config/prisma');
const sql = require('../repositories/sqlRepository');
const whatsapp = require('./whatsappService');

async function listar(filtros) {
  return sql.listarPedidos(filtros);
}

async function buscar(id) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  return pedido;
}

async function criar(data) {
  const pedidoId = await sql.nextPedidoId();
  const pedido = { ...data, id: pedidoId };
  await sql.criarPedido(pedido);
  return pedido;
}

async function darBaixaEstoque(pedido) {
  if (!pedido.itens || pedido.itens.length === 0) return;
  for (const item of pedido.itens) {
    const produto = await sql.buscarProduto(item.produtoId);
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

async function listarFiltrado(filtros) {
  return sql.listarPedidosFiltrados(filtros);
}

async function deletarPedido(id) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  // Delete child itens first
  await prisma.itensPedido.deleteMany({ where: { pedidoId: id } });
  return prisma.pedido.delete({ where: { id } });
}

async function finalizarPedido(id) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  const atualizado = await sql.atualizarPedido(id, { status: 'finalizado', finalizadoEm: new Date() });
  whatsapp.notificarStatus(atualizado, 'finalizado').catch(err => console.error('WhatsApp notify (finalizar) failed:', err.message));
  return atualizado;
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

  if (['producao', 'pronto', 'em_rota', 'finalizado'].includes(status)) {
    whatsapp.notificarStatus(pedido, status).catch(err => console.error('WhatsApp notify failed:', err.message));
  }
  return pedido;
}

module.exports = { listar, buscar, criar, atualizarStatus, deletarPedido, finalizarPedido, listarFiltrado, darBaixaEstoque };
