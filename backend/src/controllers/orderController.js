const orderService = require('../services/orderService');
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');
const config = require('../config/env');

exports.listar = asyncHandler(async (req, res) => {
  const pedidos = await orderService.listarFiltrado(req.query);
  const formatado = pedidos.map(function(p) {
    return {
      ...p,
      cliente: {
        nome: p.clienteNome,
        whatsapp: p.clienteWhatsapp,
        endereco: p.clienteEndereco,
        numero: p.clienteNumero,
        bairro: p.clienteBairro,
        pontoReferencia: p.clienteReferencia
      },
      cep: p.clienteCep,
      valores: {
        itens: p.valoresItens,
        entrega: p.taxasEntrega,
        desconto: p.desconto,
        total: p.total
      },
      taxaCartao: p.taxasCartao,
    };
  });
  res.json(formatado);
});

exports.buscar = asyncHandler(async (req, res) => {
  const pedido = await orderService.buscar(req.params.id);
  res.json(pedido);
});

exports.criar = asyncHandler(async (req, res) => {
  const pedido = await orderService.criar({ ...req.body, empresaId: 1 }, getCtx(req));
  res.status(201).json(pedido);
});

exports.deletar = asyncHandler(async (req, res) => {
  await orderService.deletarPedido(req.params.id, getCtx(req));
  res.json({ success: true });
});

exports.finalizar = asyncHandler(async (req, res) => {
  const pedido = await orderService.finalizarPedido(req.params.id, getCtx(req));

  res.json(pedido);
});

exports.atualizarStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status obrigatório' });
  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  const atualizado = await orderService.atualizarStatus(req.params.id, status, getCtx(req));

  res.json(atualizado);
});

exports.editarPedido = asyncHandler(async (req, res) => {
  const { total, itens, formaPagamento, tipoEntrega, bairro, taxasEntrega, taxasCartao, desconto, troco } = req.body;
  if (!total || !itens) return res.status(400).json({ error: 'total e itens obrigatórios' });
  const pedido = await orderService.editarPedido(req.params.id, req.body, getCtx(req));
  res.json(pedido);
});

function formatarTempoDecorrido(agora, entao) {
  const diff = agora - new Date(entao).getTime();
  if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)}min`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d ${Math.floor((diff % 86400000) / 3600000)}h`;
}

exports.listarNaoConcluidos = asyncHandler(async (req, res) => {
  const pedidos = await orderService.listarNaoConcluidos(req.query);
  const formatado = pedidos.map(function(p) {
    const dataExpiracao = p.updatedAt || p.createdAt;
    const motivo = p.paymentStatus === 'expirado'
      ? `Expirado há ${formatarTempoDecorrido(new Date(), dataExpiracao)}`
      : `Rejeitado: ${p.pagamentos?.[0]?.refundReason || 'motivo não informado'}`;
    return { ...p, motivo, dataExpiracao };
  });
  res.json(formatado);
});

exports.previewLimpeza = asyncHandler(async (req, res) => {
  const dias = Number(req.query.dias) || config.pedidoRetencaoDias;
  const preview = await sql.listarParaLimpeza(dias);
  res.json({ dias, total: preview.length, pedidos: preview });
});

exports.executarLimpeza = asyncHandler(async (req, res) => {
  const dias = Number(req.body?.dias) || config.pedidoRetencaoDias;
  const result = await orderService.limparPedidosAntigos(dias);
  res.json(result);
});
