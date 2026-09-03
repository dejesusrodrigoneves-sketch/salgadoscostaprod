const { asyncHandler } = require('../middleware/errorHandler');
const entregadorAppService = require('../services/entregadorAppService');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.listarPedidos = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const pedidos = await entregadorAppService.listarPedidos(empresaId(req), req.user.id, status);
  res.json({ pedidos, count: pedidos.length });
});

exports.buscarPedido = asyncHandler(async (req, res) => {
  const pedido = await entregadorAppService.buscarPedido(req.params.id, empresaId(req), req.user.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(pedido);
});

exports.confirmarEntrega = asyncHandler(async (req, res) => {
  const { valorCobrado, observacao } = req.body;
  if (valorCobrado === undefined || valorCobrado === null) {
    return res.status(400).json({ error: 'valorCobrado é obrigatório' });
  }
  const entrega = await entregadorAppService.confirmarEntrega(
    req.params.id,
    empresaId(req),
    req.user.id,
    valorCobrado,
    observacao
  );
  res.json({ success: true, entrega });
});

exports.registrarFalha = asyncHandler(async (req, res) => {
  const { motivo } = req.body;
  if (!motivo) {
    return res.status(400).json({ error: 'motivo é obrigatório' });
  }
  const entrega = await entregadorAppService.registrarFalha(
    req.params.id,
    empresaId(req),
    req.user.id,
    motivo
  );
  res.json({ success: true, entrega });
});

exports.buscarHistorico = asyncHandler(async (req, res) => {
  const { inicio, fim } = req.query;
  if (!inicio || !fim) {
    return res.status(400).json({ error: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' });
  }
  const resultado = await entregadorAppService.buscarHistorico(req.user.id, empresaId(req), inicio, fim);
  res.json(resultado);
});

exports.buscarPerfil = asyncHandler(async (req, res) => {
  const perfil = await entregadorAppService.buscarPerfil(req.user.id, empresaId(req));
  res.json(perfil);
});

exports.atualizarPerfil = asyncHandler(async (req, res) => {
  await entregadorAppService.atualizarPerfil(req.user.id, empresaId(req), req.body);
  res.json({ success: true });
});

exports.registrarPushToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) {
    return res.status(400).json({ error: 'fcmToken é obrigatório' });
  }
  const prisma = require('../config/prisma');
  const entregadorId = req.entregador?.id || req.user.id;
  await prisma.entregador.update({
    where: { id: Number(entregadorId) },
    data: { fcmToken },
  });
  res.json({ success: true });
});

exports.removerPushToken = asyncHandler(async (req, res) => {
  const prisma = require('../config/prisma');
  const entregadorId = req.entregador?.id || req.user.id;
  await prisma.entregador.update({
    where: { id: Number(entregadorId) },
    data: { fcmToken: null },
  });
  res.json({ success: true });
});
