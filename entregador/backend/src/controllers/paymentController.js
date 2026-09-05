const paymentSetupService = require('../services/paymentSetupService');
const { asyncHandler } = require('../middleware/errorHandler');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.setup = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const { email, cpfCnpj, pixKey, pixKeyType } = req.body;
  const result = await paymentSetupService.setup(empId, { email, cpfCnpj, pixKey, pixKeyType });
  res.status(201).json(result);
});

exports.getStatus = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const status = await paymentSetupService.getStatus(empId);
  res.json(status);
});

exports.update = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const { pixKey, pixKeyType } = req.body;
  const result = await paymentSetupService.update(empId, { pixKey, pixKeyType });
  res.json(result);
});

exports.deactivate = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const result = await paymentSetupService.deactivate(empId);
  res.json(result);
});
