const { asyncHandler } = require('../middleware/errorHandler');
const financialSyncService = require('../services/financialSyncService');
const financialDashboardService = require('../services/financialDashboardService');
const dailyClosingService = require('../services/dailyClosingService');
const reconciliationService = require('../services/reconciliationService');
const platformConnectionService = require('../services/platformConnectionService');

function empresaId(req) { return req.ctx?.empresaId || req.user?.empresaId; }

exports.balance = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const { desde, ate, plataforma } = req.query;
  res.json(await financialDashboardService.balanco(empId, { desde, ate, plataforma }));
});

exports.consolidated = asyncHandler(async (req, res) => {
  const empId = empresaId(req) || (req.user.role === 'superadmin' ? Number(req.query.empresaId) : null);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });

  // Verificar se é matriz ou superadmin
  const prisma = require('../config/prisma.js');
  const empresa = await prisma.empresa.findUnique({
    where: { id: Number(empId) },
    select: { empresaTipo: true },
  });

  if (req.user.role !== 'superadmin' && empresa?.empresaTipo !== 'matriz') {
    return res.status(403).json({ error: 'Acesso negado: só matrizes ou superadmin' });
  }

  const { desde, ate, plataforma } = req.query;
  res.json(await financialDashboardService.balancoConsolidado(empId, { desde, ate, plataforma }));
});

exports.entries = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const page = parseInt(req.query.page) || 1;
  const { desde, ate, plataforma } = req.query;
  res.json(await financialDashboardService.entradas(empId, { page, desde, ate, plataforma }));
});

exports.closings = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  res.json(await dailyClosingService.listarClosings(empId, parseInt(req.query.page) || 1));
});

exports.reconciliations = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  res.json(await reconciliationService.listar(empId, parseInt(req.query.page) || 1));
});

exports.integrations = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  res.json(await platformConnectionService.listarIntegracoes(empId));
});

exports.sync = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  res.json(await financialSyncService.syncEmpresa(empId));
});

exports.closing = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const date = req.body?.date ? new Date(req.body.date) : new Date();
  const closing = await dailyClosingService.gerarFechamento(empId, date, req.user?.id);
  const reconciliations = await reconciliationService.reconciliarDia(empId, date, req.user?.id);
  res.json({ closing, reconciliations: reconciliations.length });
});

exports.connect = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const platform = String(req.params.platform || '').toUpperCase();
  const { url } = await platformConnectionService.iniciarConexao(empId, Number(req.user.id), platform);
  res.json({ url });
});

exports.callback = asyncHandler(async (req, res) => {
  const platform = String(req.params.platform || '').toUpperCase();
  const { code, state } = req.query;
  await platformConnectionService.processarCallback(platform, code, state);
  res.redirect(`/dashboard.html?integracao=${platform.toLowerCase()}&ok=1`);
});

exports.disconnect = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const platform = String(req.params.platform || '').toUpperCase();
  res.json(await platformConnectionService.desconectar(empId, platform));
});
