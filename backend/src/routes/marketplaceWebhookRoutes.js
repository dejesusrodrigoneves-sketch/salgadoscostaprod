const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const platformConnectionService = require('../services/platformConnectionService');

const router = Router();

const MARKETPLACE_TOKENS = {
  IFOOD: process.env.IFOOD_WEBHOOK_TOKEN,
  KEETA: process.env.KEETA_WEBHOOK_TOKEN,
  NINEFOOD: process.env.NINEFOOD_WEBHOOK_TOKEN,
};

function verificarMarketplaceToken(platform, token) {
  const expected = MARKETPLACE_TOKENS[platform];
  if (!expected) return false;
  return token === expected;
}

['IFOOD', 'KEETA', 'NINEFOOD'].forEach((platform) => {
  router.post(`/${platform.toLowerCase()}`, asyncHandler(async (req, res) => {
    const token = req.headers['x-webhook-token'];
    if (!verificarMarketplaceToken(platform, token)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    const ok = await platformConnectionService.handleWebhook(platform, req.body);
    if (!ok) return res.status(503).json({ error: 'Integração não configurada' });
    res.json({ received: true });
  }));
});

module.exports = router;
