const orderService = require('../services/orderService');
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filtros = {};
  if (status) filtros.status = status;
  const pedidos = await orderService.listar(filtros);
  res.json(pedidos);
});

exports.buscar = asyncHandler(async (req, res) => {
  const pedido = await orderService.buscar(req.params.id);
  res.json(pedido);
});

exports.criar = asyncHandler(async (req, res) => {
  const pedido = await orderService.criar({ ...req.body, empresaId: 1 });
  res.status(201).json(pedido);
});

exports.deletar = asyncHandler(async (req, res) => {
  await orderService.deletarPedido(req.params.id);
  res.json({ success: true });
});

exports.finalizar = asyncHandler(async (req, res) => {
  const pedido = await orderService.finalizarPedido(req.params.id);
  res.json(pedido);
});

exports.atualizarStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status obrigatório' });
  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  const atualizado = await orderService.atualizarStatus(req.params.id, status);
  res.json(atualizado);
});
