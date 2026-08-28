const { asyncHandler } = require('../middleware/errorHandler');
const platformConnectionService = require('../services/platformConnectionService');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await platformConnectionService.statusGlobal());
});

exports.detalhe = asyncHandler(async (req, res) => {
  const platform = String(req.params.platform || '').toUpperCase();
  res.json(await platformConnectionService.statusPlataforma(platform));
});
