import { Router } from 'express';
import asaasClient from '../services/asaasClient.js';
import paymentService from '../services/paymentService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const webhookRouter = Router();

webhookRouter.post('/asaas', asyncHandler(async (req, res) => {
  const token = req.headers['asaas-access-token'];
  if (!asaasClient.verificarAutenticacao(token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  const result = await paymentService.processarWebhook(req.body);
  res.json(result);
}));

export { webhookRouter };
