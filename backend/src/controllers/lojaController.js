const service = require('../services/lojaService');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId || req.cliente?.empresaId;
}

exports.statusPublic = asyncHandler(async (req, res) => {
  const slug = req.ctx?.empresa?.slug;
  if (!slug) return res.status(404).json({ error: 'Loja não encontrada' });
  const status = await service.getStatus(slug);
  res.json(status);
});

exports.settingsPublic = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(404).json({ error: 'Loja não encontrada' });
  const settings = await service.getSettings(empId);
  res.json(settings);
});

exports.settings = asyncHandler(async (req, res) => {
  const settings = await service.getSettings(empresaId(req));
  res.json(settings);
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await service.updateSettings(empresaId(req), req.body, getCtx(req));
  res.json(settings);
});
