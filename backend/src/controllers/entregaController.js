const { asyncHandler } = require('../middleware/errorHandler');
const entregaService = require('../services/entregaService');

exports.listar = asyncHandler(async (req, res) => {
  const { data } = req.query;
  const entregas = await entregaService.listarEntregas(req.user.empresaId, data);
  res.json(entregas);
});

exports.registrar = asyncHandler(async (req, res) => {
  const { entregadorId, pedidoId, valor } = req.body;
  if (!entregadorId || !pedidoId) {
    return res.status(400).json({ error: 'entregadorId e pedidoId são obrigatórios' });
  }
  const entrega = await entregaService.registrarEntrega(req.user.empresaId, entregadorId, pedidoId, valor);
  res.status(201).json(entrega);
});

exports.remover = asyncHandler(async (req, res) => {
  const result = await entregaService.removerEntrega(req.user.empresaId, req.params.pedidoId);
  res.json(result);
});

exports.resumo = asyncHandler(async (req, res) => {
  const { data } = req.query;
  if (!data) {
    return res.status(400).json({ error: 'Parâmetro data é obrigatório (YYYY-MM-DD)' });
  }
  const resumo = await entregaService.resumoDiario(req.user.empresaId, data);
  res.json(resumo);
});
