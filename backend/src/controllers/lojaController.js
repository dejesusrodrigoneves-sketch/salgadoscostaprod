const service = require('../services/lojaService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.statusPublic = asyncHandler(async (req, res) => {
  const { slug } = req.query;
  const status = await service.getStatus(slug || 'salgadoscosta');
  res.json(status);
});

exports.settingsPublic = asyncHandler(async (req, res) => {
  const { slug } = req.query;
  const empresa = await (slug
    ? require('../repositories/sqlRepository').buscarEmpresaPorSlug(slug)
    : require('../repositories/sqlRepository').buscarEmpresa(1));
  if (!empresa) return res.status(404).json({ error: 'Loja não encontrada' });
  res.json(service.getSettings(empresa.id));
});

exports.settings = asyncHandler(async (req, res) => {
  const settings = await service.getSettings(req.user.empresaId);
  res.json(settings);
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await service.updateSettings(req.user.empresaId, req.body);
  res.json(settings);
});
