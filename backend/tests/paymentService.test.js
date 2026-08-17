process.env.ASAAS_WEBHOOK_TOKEN = 'segredo';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pagamentoPrisma, pedidoPrisma, sql, asaas, orderService } = vi.hoisted(() => ({
  pagamentoPrisma: {
    create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(),
  },
  pedidoPrisma: { update: vi.fn() },
  sql: {
    buscarPedido: vi.fn(),
    atualizarCliente: vi.fn(),
    buscarEventoWebhook: vi.fn(),
    criarEventoWebhook: vi.fn(),
  },
  asaas: {
    criarCustomer: vi.fn(), criarPix: vi.fn(), consultarPayment: vi.fn(), reembolsar: vi.fn(),
  },
  orderService: { atualizarStatus: vi.fn() },
}));

vi.mock('../src/config/prisma.js', () => ({ default: { pagamento: pagamentoPrisma, pedido: pedidoPrisma } }));
vi.mock('../src/repositories/sqlRepository.js', () => ({ default: sql }));
vi.mock('../src/services/asaasClient.js', () => ({ default: asaas }));
vi.mock('../src/services/orderService.js', () => ({ default: orderService }));

import paymentService from '../src/services/paymentService.js';

describe('paymentService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pagamentoPrisma.create.mockImplementation(async (args) => ({ id: 1, ...args.data }));
  });

  it('criarPixPedido cria customer asaas se ausente e cria pagamento', async () => {
    asaas.criarCustomer.mockResolvedValue('cus_abc');
    asaas.criarPix.mockResolvedValue({
      paymentId: 'pay_1', status: 'PENDING', pixCode: '000201', pixQrCode: 'img', expiresAt: '2026-08-15 12:00:00',
    });
    const p = await paymentService.criarPixPedido('001', {
      cliente: { id: 9, nome: 'Ana', cpf: '12345678901', telefone: '11999999999' },
      valor: 30,
    });
    expect(asaas.criarCustomer).toHaveBeenCalled();
    expect(sql.atualizarCliente).toHaveBeenCalledWith(9, { asaasCustomerId: 'cus_abc' });
    expect(asaas.criarPix).toHaveBeenCalled();
    expect(p.status).toBe('aguardando_pagamento');
    expect(p.asaasPaymentId).toBe('pay_1');
  });

  it('processarWebhook recebe evento duplicado e ignora', async () => {
    sql.buscarEventoWebhook.mockResolvedValue({ eventId: 'evt_1' });
    const r = await paymentService.processarWebhook({ id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } });
    expect(r.received).toBe(true);
    expect(asaas.consultarPayment).not.toHaveBeenCalled();
  });

  it('processarWebhook confirma pagamento e libera para producao', async () => {
    sql.buscarEventoWebhook.mockResolvedValue(null);
    sql.criarEventoWebhook.mockResolvedValue({});
    pagamentoPrisma.findUnique.mockResolvedValue({ id: 5, pedidoId: '001', asaasPaymentId: 'pay_1', valor: '30.00', status: 'aguardando_pagamento' });
    sql.buscarPedido.mockResolvedValue({ id: '001', status: 'aguardando_pagamento', paymentStatus: 'aguardando_pagamento' });
    asaas.consultarPayment.mockResolvedValue({ id: 'pay_1', status: 'RECEIVED', value: 30 });
    pagamentoPrisma.update.mockImplementation(async (args) => ({ ...args.data }));
    await paymentService.processarWebhook({ id: 'evt_2', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } });
    expect(orderService.atualizarStatus).toHaveBeenCalledWith('001', 'producao', expect.anything());
  });

  it('processarWebhook rejeita e reembolsa quando valor diverge', async () => {
    sql.buscarEventoWebhook.mockResolvedValue(null);
    sql.criarEventoWebhook.mockResolvedValue({});
    pagamentoPrisma.findUnique.mockResolvedValue({ id: 5, pedidoId: '001', asaasPaymentId: 'pay_1', valor: '100.00', status: 'aguardando_pagamento' });
    sql.buscarPedido.mockResolvedValue({ id: '001', status: 'aguardando_pagamento', paymentStatus: 'aguardando_pagamento' });
    asaas.consultarPayment.mockResolvedValue({ id: 'pay_1', status: 'RECEIVED', value: 90 });
    asaas.reembolsar.mockResolvedValue({ id: 'ref_1' });
    pagamentoPrisma.update.mockImplementation(async (args) => ({ ...args.data }));
    await paymentService.processarWebhook({ id: 'evt_3', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } });
    expect(asaas.reembolsar).toHaveBeenCalled();
    expect(orderService.atualizarStatus).not.toHaveBeenCalled();
  });
});
