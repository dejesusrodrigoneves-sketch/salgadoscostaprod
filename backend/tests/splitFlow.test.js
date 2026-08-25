process.env.ASAAS_WEBHOOK_TOKEN = 'segredo';
process.env.JWT_SECRET = 'test';
process.env.ASAAS_SUBCONTA_KEY = 'test-key-for-crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── shared mocks ── */
const {
  pagamentoPrisma, pedidoPrisma, weeklySettlementPrisma, sql, asaasClient, auditService, env, logger, businessDays, crypto, orderService,
} = vi.hoisted(() => ({
  pagamentoPrisma: {
    create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(),
  },
  pedidoPrisma: { update: vi.fn() },
  weeklySettlementPrisma: {
    findMany: vi.fn(), count: vi.fn(),
  },
  sql: {
    buscarPedido: vi.fn(),
    buscarEmpresa: vi.fn(),
    atualizarCliente: vi.fn(),
    buscarEventoWebhook: vi.fn(),
    criarEventoWebhook: vi.fn(),
    buscarSettlementActual: vi.fn(),
    criarSettlement: vi.fn(),
    atualizarSettlement: vi.fn(),
    buscarPedidosPagosNoPeriodo: vi.fn(),
    marcarPedidosArquivados: vi.fn(),
    buscarSettlementPorId: vi.fn(),
    listarSettlements: vi.fn(),
    countSettlementsPendentes: vi.fn(),
  },
  asaasClient: {
    criarCustomer: vi.fn(),
    criarPix: vi.fn(),
    criarPixComSplit: vi.fn(),
    consultarPayment: vi.fn(),
    reembolsar: vi.fn(),
    agendarTransferencia: vi.fn(),
    consultarSaldo: vi.fn(),
  },
  auditService: { audit: vi.fn(), appLog: vi.fn() },
  env: { asaasPixFeePercent: 2, asaasPixExpiryMin: 30 },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  businessDays: { getNextBusinessDay: vi.fn() },
  crypto: { decrypt: vi.fn() },
  orderService: { atualizarStatus: vi.fn() },
}));

vi.mock('../src/config/prisma.js', () => ({
  default: { pagamento: pagamentoPrisma, pedido: pedidoPrisma, weeklySettlement: weeklySettlementPrisma },
}));
vi.mock('../src/repositories/sqlRepository.js', () => ({ default: sql }));
vi.mock('../src/services/asaasClient.js', () => ({ default: asaasClient }));
vi.mock('../src/services/auditService.js', () => ({ default: auditService }));
vi.mock('../src/config/env.js', () => ({ default: env }));
vi.mock('../src/config/logger.js', () => ({ default: logger }));
vi.mock('../src/utils/crypto.js', () => ({ default: crypto, decrypt: crypto.decrypt }));
vi.mock('../src/utils/businessDays.js', () => ({ default: businessDays, getNextBusinessDay: businessDays.getNextBusinessDay }));
vi.mock('../src/services/orderService.js', () => ({ default: orderService }));

import paymentService from '../src/services/paymentService.js';
import settlementService from '../src/services/settlementService.js';

/* ── helpers ── */
const empresaOnboarded = {
  id: 10,
  asaasOnboarded: true,
  asaasWalletId: 'wallet_10',
  pixKey: 'pix@empresa10.com',
  pixKeyType: 'EMAIL',
  asaasApiKey: 'encrypted_key_10',
  asaasSubcontaId: 'sub_10',
};

const empresaNotOnboarded = {
  id: 20,
  asaasOnboarded: false,
  asaasWalletId: null,
  pixKey: null,
  pixKeyType: null,
};

describe('split integration flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pagamentoPrisma.create.mockImplementation(async (args) => ({ id: 100, ...args.data }));
    pagamentoPrisma.update.mockImplementation(async (args) => args.data);
    pedidoPrisma.update.mockImplementation(async (args) => args.data);
    sql.buscarSettlementActual.mockResolvedValue(null);
    sql.marcarPedidosArquivados.mockResolvedValue({});
    auditService.audit.mockResolvedValue({});
    env.asaasPixFeePercent = 2;
    env.asaasPixExpiryMin = 30;
  });

  /* ── 1. PIX without split ── */
  it('PIX without split → empresa not onboarded, criarPix called', async () => {
    sql.buscarPedido.mockResolvedValue({ id: 'ped_01', empresaId: 20 });
    sql.buscarEmpresa.mockResolvedValue(empresaNotOnboarded);
    asaasClient.criarCustomer.mockResolvedValue('cus_01');
    asaasClient.criarPix.mockResolvedValue({
      paymentId: 'pay_01', status: 'PENDING', pixCode: 'pixcode_nosplit', pixQrCode: 'qr_nosplit',
    });

    const pagamento = await paymentService.criarPixPedido('ped_01', {
      cliente: { id: 1, nome: 'NoSplit', cpf: '11122233344', telefone: '11900000001' },
      valor: 100,
    });

    expect(asaasClient.criarPix).toHaveBeenCalled();
    expect(asaasClient.criarPixComSplit).not.toHaveBeenCalled();
    expect(pagamento.asaasPaymentId).toBe('pay_01');
    expect(pagamento.empresaId).toBe(20);
  });

  /* ── 2. PIX with split ── */
  it('PIX with split → empresa onboarded, criarPixComSplit with wallet', async () => {
    sql.buscarPedido.mockResolvedValue({ id: 'ped_02', empresaId: 10 });
    sql.buscarEmpresa.mockResolvedValue(empresaOnboarded);
    asaasClient.criarCustomer.mockResolvedValue('cus_02');
    asaasClient.criarPixComSplit.mockResolvedValue({
      paymentId: 'pay_split_01', status: 'PENDING', pixCode: 'pixcode_split', pixQrCode: 'qr_split',
    });

    const pagamento = await paymentService.criarPixPedido('ped_02', {
      cliente: { id: 2, nome: 'WithSplit', cpf: '22233344455', telefone: '11900000002' },
      valor: 200,
    });

    expect(asaasClient.criarPixComSplit).toHaveBeenCalledWith(
      expect.objectContaining({
        splits: [{ walletId: 'wallet_10', percentualValue: 98 }],
      })
    );
    expect(asaasClient.criarPix).not.toHaveBeenCalled();
    expect(pagamento.asaasPaymentId).toBe('pay_split_01');
    expect(pagamento.empresaId).toBe(10);
  });

  /* ── 3. Settlement with transfer ── */
  it('settlement with transfer → onboarded empresa schedules transfer next business day', async () => {
    const weekDate = new Date(2025, 0, 8); // Wednesday
    const pedidos = [{ id: 'p1', total: 500 }, { id: 'p2', total: 300 }];

    sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
    sql.criarSettlement.mockImplementation(async (data) => ({ id: 50, ...data }));
    sql.buscarEmpresa.mockResolvedValue(empresaOnboarded);
    crypto.decrypt.mockReturnValue('decrypted_token_10');
    asaasClient.consultarSaldo.mockResolvedValue({ available: 1000 });
    asaasClient.agendarTransferencia.mockResolvedValue({ id: 'tr_01', status: 'SCHEDULED' });
    businessDays.getNextBusinessDay.mockReturnValue(new Date(2025, 0, 10)); // Friday

    const result = await settlementService.fecharSemana(10, weekDate);

    expect(result.splitStatus).toBe('auto');
    expect(result.transferId).toBe('tr_01');
    expect(result.transferStatus).toBe('scheduled');
    // totalBruto=800, totalLiquido=800*0.98=784, available=1000 → transferAmount=784
    expect(result.transferAmount).toBe(784);
    expect(asaasClient.agendarTransferencia).toHaveBeenCalledWith(
      expect.objectContaining({
        valor: 784,
        pixAddressKey: 'pix@empresa10.com',
        pixAddressKeyType: 'EMAIL',
        scheduleDate: new Date(2025, 0, 10),
      })
    );
    expect(sql.atualizarSettlement).toHaveBeenCalledWith(50, expect.objectContaining({
      splitStatus: 'auto',
      transferId: 'tr_01',
      transferStatus: 'scheduled',
    }));
  });

  /* ── 4. Settlement without transfer ── */
  it('settlement without transfer → not onboarded, splitStatus manual', async () => {
    const weekDate = new Date(2025, 0, 8);
    const pedidos = [{ id: 'p3', total: 150 }];

    sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
    sql.criarSettlement.mockImplementation(async (data) => ({ id: 60, ...data }));
    sql.buscarEmpresa.mockResolvedValue(empresaNotOnboarded);

    const result = await settlementService.fecharSemana(20, weekDate);

    expect(result.splitStatus).toBe('manual');
    expect(result.transferId).toBeNull();
    expect(result.transferStatus).toBeNull();
    expect(asaasClient.agendarTransferencia).not.toHaveBeenCalled();
    expect(sql.atualizarSettlement).toHaveBeenCalledWith(60, expect.objectContaining({
      splitStatus: 'manual',
      transferId: null,
      transferStatus: null,
    }));
  });

  /* ── 5. Full flow: pedido → PIX → webhook → settlement ── */
  it('full flow: criarPixPedido (split) → webhook confirm → fecharSemana schedules transfer', async () => {
    const weekDate = new Date(2025, 0, 8);
    const pedidoId = 'ped_full_01';

    // Step 1: criarPixPedido with split
    sql.buscarPedido.mockResolvedValue({ id: pedidoId, empresaId: 10 });
    sql.buscarEmpresa.mockResolvedValue(empresaOnboarded);
    asaasClient.criarCustomer.mockResolvedValue('cus_full');
    asaasClient.criarPixComSplit.mockResolvedValue({
      paymentId: 'pay_full_01', status: 'PENDING', pixCode: 'pix_full', pixQrCode: 'qr_full',
    });

    const pagamento = await paymentService.criarPixPedido(pedidoId, {
      cliente: { id: 3, nome: 'Full', cpf: '33344455566', telefone: '11900000003' },
      valor: 400,
    });
    expect(pagamento.asaasPaymentId).toBe('pay_full_01');
    expect(asaasClient.criarPixComSplit).toHaveBeenCalled();

    // Step 2: Webhook confirms payment
    sql.buscarEventoWebhook.mockResolvedValue(null);
    sql.criarEventoWebhook.mockResolvedValue({});
    pagamentoPrisma.findUnique.mockResolvedValue({
      id: 100, pedidoId, asaasPaymentId: 'pay_full_01', valor: '400.00', status: 'aguardando_pagamento',
    });
    sql.buscarPedido.mockResolvedValue({ id: pedidoId, status: 'aguardando_pagamento', paymentStatus: 'aguardando_pagamento' });
    asaasClient.consultarPayment.mockResolvedValue({ id: 'pay_full_01', status: 'RECEIVED', value: 400 });

    await paymentService.processarWebhook({ id: 'evt_full', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_full_01' } });
    expect(orderService.atualizarStatus).toHaveBeenCalledWith(pedidoId, 'producao', expect.anything());

    // Step 3: fecharSemana with settlement
    sql.buscarPedidosPagosNoPeriodo.mockResolvedValue([{ id: pedidoId, total: 400 }]);
    sql.criarSettlement.mockImplementation(async (data) => ({ id: 70, ...data }));
    sql.buscarEmpresa.mockResolvedValue(empresaOnboarded);
    crypto.decrypt.mockReturnValue('decrypted_token_10');
    asaasClient.consultarSaldo.mockResolvedValue({ available: 500 });
    asaasClient.agendarTransferencia.mockResolvedValue({ id: 'tr_full', status: 'SCHEDULED' });
    businessDays.getNextBusinessDay.mockReturnValue(new Date(2025, 0, 10));

    const settlement = await settlementService.fecharSemana(10, weekDate);

    expect(settlement.splitStatus).toBe('auto');
    expect(settlement.transferId).toBe('tr_full');
    // totalLiquido = 400 * 0.98 = 392, available = 500 → transferAmount = 392
    expect(settlement.transferAmount).toBe(392);
  });

  /* ── 6. Full flow: pedido → PIX → no-split → settlement manual ── */
  it('full flow: criarPixPedido (no split) → webhook confirm → fecharSemana manual', async () => {
    const weekDate = new Date(2025, 0, 8);
    const pedidoId = 'ped_full_02';

    // Step 1: criarPixPedido without split
    sql.buscarPedido.mockResolvedValue({ id: pedidoId, empresaId: 20 });
    sql.buscarEmpresa.mockResolvedValue(empresaNotOnboarded);
    asaasClient.criarCustomer.mockResolvedValue('cus_full2');
    asaasClient.criarPix.mockResolvedValue({
      paymentId: 'pay_full_02', status: 'PENDING', pixCode: 'pix_full2', pixQrCode: 'qr_full2',
    });

    const pagamento = await paymentService.criarPixPedido(pedidoId, {
      cliente: { id: 4, nome: 'Full2', cpf: '44455566677', telefone: '11900000004' },
      valor: 250,
    });
    expect(pagamento.asaasPaymentId).toBe('pay_full_02');
    expect(asaasClient.criarPix).toHaveBeenCalled();
    expect(asaasClient.criarPixComSplit).not.toHaveBeenCalled();

    // Step 2: Webhook confirms payment
    sql.buscarEventoWebhook.mockResolvedValue(null);
    sql.criarEventoWebhook.mockResolvedValue({});
    pagamentoPrisma.findUnique.mockResolvedValue({
      id: 101, pedidoId, asaasPaymentId: 'pay_full_02', valor: '250.00', status: 'aguardando_pagamento',
    });
    sql.buscarPedido.mockResolvedValue({ id: pedidoId, status: 'aguardando_pagamento', paymentStatus: 'aguardando_pagamento' });
    asaasClient.consultarPayment.mockResolvedValue({ id: 'pay_full_02', status: 'RECEIVED', value: 250 });

    await paymentService.processarWebhook({ id: 'evt_full2', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_full_02' } });
    expect(orderService.atualizarStatus).toHaveBeenCalledWith(pedidoId, 'producao', expect.anything());

    // Step 3: fecharSemana → manual (not onboarded)
    sql.buscarPedidosPagosNoPeriodo.mockResolvedValue([{ id: pedidoId, total: 250 }]);
    sql.criarSettlement.mockImplementation(async (data) => ({ id: 80, ...data }));
    sql.buscarEmpresa.mockResolvedValue(empresaNotOnboarded);

    const settlement = await settlementService.fecharSemana(20, weekDate);

    expect(settlement.splitStatus).toBe('manual');
    expect(settlement.transferId).toBeNull();
    expect(asaasClient.agendarTransferencia).not.toHaveBeenCalled();
  });

  /* ── 7. Settlement caps transfer at available balance ── */
  it('settlement caps transfer at balance when saldo < totalLiquido', async () => {
    const weekDate = new Date(2025, 0, 8);
    const pedidos = [{ id: 'p_high', total: 1000 }];

    sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
    sql.criarSettlement.mockImplementation(async (data) => ({ id: 90, ...data }));
    sql.buscarEmpresa.mockResolvedValue(empresaOnboarded);
    crypto.decrypt.mockReturnValue('decrypted_token_10');
    asaasClient.consultarSaldo.mockResolvedValue({ available: 200 }); // less than 980
    asaasClient.agendarTransferencia.mockResolvedValue({ id: 'tr_cap', status: 'SCHEDULED' });
    businessDays.getNextBusinessDay.mockReturnValue(new Date(2025, 0, 10));

    const result = await settlementService.fecharSemana(10, weekDate);

    // totalLiquido = 1000 * 0.98 = 980, available = 200 → transferAmount = 200
    expect(result.transferAmount).toBe(200);
    expect(asaasClient.agendarTransferencia).toHaveBeenCalledWith(
      expect.objectContaining({ valor: 200 })
    );
  });

  /* ── 8. Settlement with zero balance → no transfer ── */
  it('settlement with zero balance → no transfer scheduled', async () => {
    const weekDate = new Date(2025, 0, 8);
    const pedidos = [{ id: 'p_zero', total: 100 }];

    sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
    sql.criarSettlement.mockImplementation(async (data) => ({ id: 91, ...data }));
    sql.buscarEmpresa.mockResolvedValue(empresaOnboarded);
    crypto.decrypt.mockReturnValue('decrypted_token_10');
    asaasClient.consultarSaldo.mockResolvedValue({ available: 0 });

    const result = await settlementService.fecharSemana(10, weekDate);

    expect(result.splitStatus).toBe('auto');
    expect(result.transferId).toBeNull();
    expect(asaasClient.agendarTransferencia).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ available: 0 }),
      'No balance available for transfer'
    );
  });
});
