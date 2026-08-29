// backend/src/controllers/superadminDashboardController.js (CJS)
const { getSummary, getEmpresas } = require('../services/superadminDashboardService');

async function getSummaryController(req, res) {
  try {
    const { empresaId } = req.query;
    const summary = await getSummary(empresaId ? parseInt(empresaId) : null);
    if (!summary) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }
    res.json(summary);
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Erro ao carregar resumo do dashboard' });
  }
}

async function getEmpresasController(req, res) {
  try {
    const empresas = await getEmpresas();
    res.json({ empresas });
  } catch (err) {
    console.error('Dashboard empresas error:', err);
    res.status(500).json({ error: 'Erro ao carregar empresas do dashboard' });
  }
}

module.exports = { getSummaryController, getEmpresasController };