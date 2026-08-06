const prisma = require('../config/prisma');
const sql = require('../repositories/sqlRepository');
const whatsapp = require('./whatsappService');
const auditService = require('./auditService');

async function listar(filtros) {
  return sql.listarPedidos(filtros);
}

async function buscar(id) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  return pedido;
}

async function criar(data, ctx = {}) {
  const pedidoId = await sql.nextPedidoId();
  const pedido = { ...data, id: pedidoId };
  await sql.criarPedido(pedido);

  auditService.audit({
    ...ctx,
    action: 'pedido.create',
    module: 'pedidos',
    targetType: 'pedido',
    targetId: pedidoId,
    after: { clienteNome: data.clienteNome, total: Number(data.total), status: 'pendente' },
    changedFields: ['clienteNome', 'total', 'status'],
  });

  return pedido;
}

async function darBaixaEstoque(pedido, ctx = {}) {
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

      auditService.audit({
        ...ctx,
        action: 'produto.stock_update',
        module: 'produtos',
        targetType: 'produto',
        targetId: item.produtoId,
        before: { estoqueAtual: Number(produto.estoqueAtual) },
        after: { estoqueAtual: novoEstoque },
        changedFields: Object.keys(updates),
        metadata: { ...(ctx.metadata || {}), pedidoId: pedido.id },
      });
    }
  }
}

async function listarFiltrado(filtros) {
  return sql.listarPedidosFiltrados(filtros);
}

async function deletarPedido(id, ctx = {}) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });

  auditService.audit({
    ...ctx,
    action: 'pedido.delete',
    module: 'pedidos',
    targetType: 'pedido',
    targetId: id,
    after: { status: pedido.status, total: Number(pedido.total), clienteNome: pedido.clienteNome },
    changedFields: ['status', 'total'],
    severity: 'warning',
  });

  // Delete child itens first
  await prisma.itensPedido.deleteMany({ where: { pedidoId: id } });
  return prisma.pedido.delete({ where: { id } });
}

async function finalizarPedido(id, ctx = {}) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });

  auditService.audit({
    ...ctx,
    action: 'pedido.finalizar',
    module: 'pedidos',
    targetType: 'pedido',
    targetId: id,
    before: { status: pedido.status },
    after: { status: 'finalizado' },
    changedFields: ['status'],
  });

  const atualizado = await sql.atualizarPedido(id, { status: 'finalizado', finalizadoEm: new Date() });
  whatsapp.notificarStatus(atualizado, 'finalizado').catch(err => console.error('WhatsApp notify (finalizar) failed:', err.message));
  return atualizado;
}

async function atualizarStatus(id, status, ctx = {}) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });

  auditService.audit({
    ...ctx,
    action: 'pedido.status_change',
    module: 'pedidos',
    targetType: 'pedido',
    targetId: id,
    before: { status: pedido.status },
    after: { status },
    changedFields: ['status'],
  });

  const updates = { status };
  if (status === 'finalizado') updates.finalizadoEm = new Date();

  const atualizado = await sql.atualizarPedido(id, updates);

  // Baixa de estoque ao confirmar pedido (status = aceito/producao)
  if (['aceito', 'producao'].includes(status)) {
    const pedidoCompleto = await sql.buscarPedido(id);
    darBaixaEstoque(pedidoCompleto, { ...ctx, metadata: { url: ctx.path || null } }).catch(err => console.error('Erro baixa estoque:', err));
  }

  if (['producao', 'pronto', 'em_rota', 'finalizado'].includes(status)) {
    whatsapp.notificarStatus(atualizado, status).catch(err => console.error('WhatsApp notify failed:', err.message));
  }
  return atualizado;
}

// Helper puro e testável: calcula as mudanças de edição sem tocar no DB.
// Retorna { updates, itensRemovidos, itensNovos, movimentosEstoque }.
// buscarProdutoFn é injetável (default null => não calcula movimentos de estoque).
async function processarEdicaoPedido(pedido, data, buscarProdutoFn = null) {
  const itensAntigos = pedido.itens || [];
  const itensNovosLista = data.itens || [];

  const itensRemovidos = [];
  const itensNovos = [];

  for (const itemAntigo of itensAntigos) {
    const match = itensNovosLista.find(i => Number(i.produtoId) === Number(itemAntigo.produtoId));
    if (!match) {
      itensRemovidos.push({ produtoId: itemAntigo.produtoId, quantidade: itemAntigo.quantidade });
    } else if (Number(match.quantidade) !== Number(itemAntigo.quantidade)) {
      // quantidade editada => remove o volume antigo e registra o novo volume
      itensRemovidos.push({ produtoId: itemAntigo.produtoId, quantidade: itemAntigo.quantidade });
      itensNovos.push({
        produtoId: Number(match.produtoId),
        quantidade: Number(match.quantidade),
        precoUnitario: String(match.precoUnitario ?? itemAntigo.precoUnitario ?? '0'),
        sabores: match.sabores ?? null,
      });
    }
  }

  for (const itemNovo of itensNovosLista) {
    const existe = itensAntigos.some(i => Number(i.produtoId) === Number(itemNovo.produtoId));
    if (!existe) {
      itensNovos.push({
        produtoId: Number(itemNovo.produtoId),
        quantidade: Number(itemNovo.quantidade),
        precoUnitario: String(itemNovo.precoUnitario ?? '0'),
        sabores: itemNovo.sabores ?? null,
      });
    }
  }

  const updates = {
    formaPagamento: data.formaPagamento,
    tipoEntrega: data.tipoEntrega,
    taxasEntrega: Number(data.taxasEntrega ?? 0),
    taxasCartao: Number(data.taxasCartao ?? 0),
    desconto: Number(data.desconto ?? 0),
    total: String(data.total ?? '0'),
    troco: Number(data.troco ?? 0),
  };

  // Endereço de entrega.
  // - Entrega = delivery: grava strings não-vazias fornecidas (preserva ausentes).
  // - Trocou para retirada/balcao (≠ delivery): limpa campos de endereço.
  const camposEndereco = [
    ['bairro', 'clienteBairro'],
    ['endereco', 'clienteEndereco'],
    ['numero', 'clienteNumero'],
    ['cep', 'clienteCep'],
    ['referencia', 'clienteReferencia'],
  ];
  if (String(data.tipoEntrega || '').toLowerCase() !== 'delivery') {
    for (const [, destKey] of camposEndereco) {
      updates[destKey] = null;
    }
  } else {
    for (const [srcKey, destKey] of camposEndereco) {
      const val = data[srcKey];
      if (val !== undefined && val !== null && String(val) !== '') {
        updates[destKey] = String(val);
      }
    }
  }

  // Movimentos de estoque: remoção soma (reversão), adição subtrai (baixa),
  // ambos apenas se o produto controlaEstoque.
  const movimentosEstoque = [];
  if (typeof buscarProdutoFn === 'function') {
    for (const r of itensRemovidos) {
      const produto = await buscarProdutoFn(Number(r.produtoId));
      if (produto && produto.controlaEstoque) {
        movimentosEstoque.push({ produtoId: Number(r.produtoId), delta: Number(r.quantidade) });
      }
    }
    for (const n of itensNovos) {
      const produto = await buscarProdutoFn(Number(n.produtoId));
      if (produto && produto.controlaEstoque) {
        movimentosEstoque.push({ produtoId: Number(n.produtoId), delta: -Number(n.quantidade) });
      }
    }
  }

  return { updates, itensRemovidos, itensNovos, movimentosEstoque };
}

// Thin wrapper: valida existência, aplica updates + substitui itens + movimenta estoque.
async function editarPedido(id, data, ctx = {}) {
  const pedido = await sql.buscarPedido(id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });

  const result = await processarEdicaoPedido(pedido, data, (pid) => sql.buscarProduto(pid));

  // Atualiza campos do pedido (formaPagamento, troco, tipoEntrega, taxasEntrega, taxasCartao, desconto, total)
  const atualizado = await sql.atualizarPedido(id, result.updates);

  // Substitui os itens do pedido pelos novos (delete + re-create).
  await prisma.itensPedido.deleteMany({ where: { pedidoId: id } });
  if (data.itens && data.itens.length > 0) {
    await prisma.itensPedido.createMany({
      data: data.itens.map(i => ({
        pedidoId: id,
        produtoId: Number(i.produtoId),
        quantidade: Number(i.quantidade),
        precoUnitario: i.precoUnitario,
        sabores: i.sabores ?? null,
      })),
    });
  }

  // Aplica movimentos de estoque (reversão + baixa) com audit.
  for (const mv of result.movimentosEstoque) {
    const produto = await sql.buscarProduto(mv.produtoId);
    if (!produto) continue;
    const novoEstoque = Math.max(0, produto.estoqueAtual + mv.delta);
    const updatesProduto = { estoqueAtual: novoEstoque };
    if (novoEstoque === 0 && produto.hideWhenOutOfStock) updatesProduto.status = 'paused';
    await sql.atualizarProduto(mv.produtoId, updatesProduto);

    auditService.audit({
      ...ctx,
      action: 'produto.stock_update',
      module: 'produtos',
      targetType: 'produto',
      targetId: mv.produtoId,
      before: { estoqueAtual: Number(produto.estoqueAtual) },
      after: { estoqueAtual: novoEstoque },
      changedFields: Object.keys(updatesProduto),
      metadata: { ...(ctx.metadata || {}), pedidoId: id, motivo: 'edicao_pedido_finalizado' },
    });
  }

  auditService.audit({
    ...ctx,
    action: 'pedido.editar',
    module: 'pedidos',
    targetType: 'pedido',
    targetId: id,
    before: { total: Number(pedido.total), formaPagamento: pedido.formaPagamento },
    after: { total: Number(atualizado.total) },
    changedFields: ['total', 'formaPagamento', 'tipoEntrega', 'itens'],
  });

  return sql.buscarPedido(id);
}

module.exports = { listar, buscar, criar, atualizarStatus, deletarPedido, finalizarPedido, listarFiltrado, darBaixaEstoque, processarEdicaoPedido, editarPedido };
