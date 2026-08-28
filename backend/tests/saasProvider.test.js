import { describe, it, expect } from 'vitest';
import { normalizePedido } from '../src/integrations/saas/SaasFinancialProvider.js';

describe('SaasFinancialProvider.normalizePedido', () => {
  const pedido = {
    id: '1-001',
    empresaId: 7,
    total: 100,
    desconto: 10,
    taxasEntrega: 8,
    taxasCartao: 2,
    createdAt: '2026-08-25T15:00:00Z',
  };

  it('calcula net = bruto - desconto - taxas', () => {
    const e = normalizePedido(pedido, 80);
    expect(e.source).toBe('SAAS');
    expect(e.externalId).toBe('1-001');
    expect(e.grossAmount).toBe(100);
    expect(e.discountAmount).toBe(10);
    expect(e.deliveryAmount).toBe(8);
    expect(e.otherFees).toBe(2);
    expect(e.netAmount).toBe(80);
    expect(e.receivedAmount).toBe(80);
    expect(e.status).toBe('PAID');
  });

  it('recebido null quando nao informado', () => {
    const e = normalizePedido(pedido, null);
    expect(e.receivedAmount).toBeNull();
  });
});
