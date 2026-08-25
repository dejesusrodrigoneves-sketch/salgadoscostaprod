const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');
const entregaService = require('../services/entregaService');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.listar = asyncHandler(async (req, res) => {
  const { data } = req.query;
  const entregas = await entregaService.listarEntregas(data, empresaId(req));
  res.json(entregas);
});

exports.registrar = asyncHandler(async (req, res) => {
  const { entregadorId, pedidoId, valor } = req.body;
  if (!entregadorId || !pedidoId) {
    return res.status(400).json({ error: 'entregadorId e pedidoId são obrigatórios' });
  }
  const entrega = await entregaService.registrarEntrega(entregadorId, pedidoId, valor, empresaId(req), getCtx(req));
  res.status(201).json(entrega);
});

exports.remover = asyncHandler(async (req, res) => {
  const result = await entregaService.removerEntrega(req.params.pedidoId, empresaId(req), getCtx(req));
  res.json(result);
});

exports.resumo = asyncHandler(async (req, res) => {
  const { data } = req.query;
  if (!data) {
    return res.status(400).json({ error: 'Parâmetro data é obrigatório (YYYY-MM-DD)' });
  }
  const resumo = await entregaService.resumoDiario(data, empresaId(req));
  res.json(resumo);
});

exports.resumoPeriodo = asyncHandler(async (req, res) => {
  const { inicio, fim, entregador } = req.query;
  if (!inicio || !fim) {
    return res.status(400).json({ error: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' });
  }
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(inicio) || !re.test(fim)) {
    return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
  }
  const resultado = await entregaService.resumoPorPeriodo(inicio, fim, entregador, empresaId(req), getCtx(req));
  res.json(resultado);
});
