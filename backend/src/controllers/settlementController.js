const settlementService = require('../services/settlementService');
const { asyncHandler } = require('../middleware/errorHandler');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.actual = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const settlement = await settlementService.buscarActual(empId);
  res.json(settlement || { message: 'Nenhum settlement nesta semana' });
});

exports.history = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const page = parseInt(req.query.page) || 1;
  const result = await settlementService.buscarHistory(empId, page);
  res.json(result);
});

exports.detalhe = asyncHandler(async (req, res) => {
  const settlement = await settlementService.buscarDetalhe(Number(req.params.id));
  if (!settlement) return res.status(404).json({ error: 'Settlement não encontrado' });
  res.json(settlement);
});

exports.globalSettlements = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const empresaId = req.query.empresaId ? Number(req.query.empresaId) : null;
  const result = await settlementService.listarSettlementsGlobais(page, 20, empresaId);
  res.json(result);
});
