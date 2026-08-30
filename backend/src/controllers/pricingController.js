// backend/src/controllers/pricingController.js (CJS)
const pricingService = require('../services/pricingService.js');

async function createPricingController(req, res) {
  try {
    const { value, effectiveDate } = req.body;
    if (!value || !effectiveDate) {
      return res.status(400).json({ error: 'Valor e data de efetivação são obrigatórios' });
    }
    
    const config = await pricingService.createPricingConfig(value, effectiveDate);
    
    // Notify all companies
    const notifyResult = await pricingService.notifyPriceChange(config);
    
    res.status(201).json({ 
      config,
      notifications: notifyResult
    });
  } catch (e) {
    console.error('Pricing create error:', e);
    res.status(500).json({ error: 'Erro ao criar configuração de preço' });
  }
}

async function getPricingController(req, res) {
  try {
    const history = await pricingService.getPricingHistory();
    res.json(history);
  } catch (e) {
    console.error('Pricing get error:', e);
    res.status(500).json({ error: 'Erro ao buscar preços' });
  }
}

async function getCurrentPricingController(req, res) {
  try {
    const current = await pricingService.getCurrentPricing();
    res.json(current || { value: 100, status: 'DEFAULT' });
  } catch (e) {
    console.error('Pricing current error:', e);
    res.status(500).json({ error: 'Erro ao buscar preço vigente' });
  }
}

module.exports = {
  createPricingController,
  getPricingController,
  getCurrentPricingController
};
