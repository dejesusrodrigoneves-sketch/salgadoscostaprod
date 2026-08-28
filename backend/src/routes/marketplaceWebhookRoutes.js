const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const platformConnectionService = require('../services/platformConnectionService');

const router = Router();
['IFOOD', 'KEETA', 'NINEFOOD'].forEach((platform) => {
  router.post(`/${platform.toLowerCase()}`, asyncHandler(async (req, res) => {
    const ok = await platformConnectionService.handleWebhook(platform, req.body);
    if (!ok) return res.status(503).json({ error: 'Integração não configurada' });
    res.json({ received: true });
  }));
});

module.exports = router;
