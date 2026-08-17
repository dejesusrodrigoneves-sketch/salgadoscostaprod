import { describe, it, expect, vi, beforeEach } from 'vitest';

const axios = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('axios', () => ({ default: axios }));

import asaasClient from '../src/services/asaasClient.js';

describe('asaasClient', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('criarPix cria pagamento e busca QR code', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'pay_123', status: 'PENDING' } });
    axios.get.mockResolvedValueOnce({
      data: { payload: '00020126580014BR.GOV.BCB.PIX', encodedImage: 'iVBORw0KGgo=', expirationDate: '2026-08-15 12:00:00' },
    });
    const out = await asaasClient.criarPix({ customerId: 'cus_1', valor: 10.5, descricao: 'Pedido 001', dueDate: '2026-08-15' });
    expect(out.paymentId).toBe('pay_123');
    expect(out.pixCode).toBe('00020126580014BR.GOV.BCB.PIX');
    expect(out.pixQrCode).toBe('iVBORw0KGgo=');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/payments'),
      expect.objectContaining({ billingType: 'PIX', value: 10.5, customer: 'cus_1' }),
      expect.anything()
    );
  });

  it('verificarAutenticacao compara header com token do env', () => {
    expect(asaasClient.verificarAutenticacao(process.env.ASAAS_WEBHOOK_TOKEN)).toBe(true);
    expect(asaasClient.verificarAutenticacao('errado')).toBe(false);
  });
});
