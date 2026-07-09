const service = require('../services/lojaService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.statusPublic = asyncHandler(async (req, res) => {
  const { slug } = req.query;
  const status = await service.getStatus(slug || 'salgadoscosta');
  res.json(status);
});

exports.settingsPublic = asyncHandler(async (req, res) => {
  const settings = await service.getSettings();
  res.json(settings);
});

exports.settings = asyncHandler(async (req, res) => {
  const settings = await service.getSettings();
  res.json(settings);
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await service.updateSettings(req.body);
  res.json(settings);
});
