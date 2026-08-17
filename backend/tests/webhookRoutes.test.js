process.env.ASAAS_WEBHOOK_TOKEN = 'segredo';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const { paymentServiceMock, asaasMock } = vi.hoisted(() => ({
  paymentServiceMock: {
    processarWebhook: vi.fn(),
  },
  asaasMock: { verificarAutenticacao: vi.fn() },
}));

vi.mock('../src/services/paymentService.js', () => ({ default: paymentServiceMock }));
vi.mock('../src/services/asaasClient.js', () => ({ default: asaasMock }));

import { webhookRouter } from '../src/routes/webhookRoutes.js';

const app = express();
app.use(express.json());
app.use('/webhooks', webhookRouter);

describe('webhookRoutes', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rejeita webhook sem token correto', async () => {
    asaasMock.verificarAutenticacao.mockReturnValue(false);
    const res = await request(app).post('/webhooks/asaas').send({ event: 'PAYMENT_RECEIVED' });
    expect(res.status).toBe(401);
  });

  it('processa webhook com token correto', async () => {
    asaasMock.verificarAutenticacao.mockReturnValue(true);
    paymentServiceMock.processarWebhook.mockResolvedValue({ received: true });
    const res = await request(app)
      .post('/webhooks/asaas')
      .set('asaas-access-token', 'segredo')
      .send({ id: 'evt_9', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } });
    expect(res.status).toBe(200);
    expect(paymentServiceMock.processarWebhook).toHaveBeenCalled();
  });
});
