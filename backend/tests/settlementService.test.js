process.env.JWT_SECRET = 'test';
process.env.ASAAS_SUBCONTA_KEY = 'test-key-for-crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sql, auditService, env, logger, asaasClient, businessDays, crypto } = vi.hoisted(() => ({
  sql: {
    buscarSettlementActual: vi.fn(),
    criarSettlement: vi.fn(),
    marcarPedidosArquivados: vi.fn(),
    buscarPedidosPagosNoPeriodo: vi.fn(),
    buscarEmpresa: vi.fn(),
    atualizarSettlement: vi.fn(),
    buscarSettlementPorId: vi.fn(),
    listarSettlements: vi.fn(),
    countSettlementsPendentes: vi.fn(),
    hardDeleteEmpresa: vi.fn(),
  },
  auditService: { audit: vi.fn() },
  env: { asaasPixFeePercent: 2 },
  logger: { error: vi.fn(), info: vi.fn() },
  asaasClient: {
    consultarSaldo: vi.fn(),
    agendarTransferencia: vi.fn(),
  },
  businessDays: { getNextBusinessDay: vi.fn() },
  crypto: { decrypt: vi.fn() },
}));

vi.mock('../src/repositories/sqlRepository.js', () => ({ default: sql }));
vi.mock('../src/config/prisma.js', () => ({ default: {} }));
vi.mock('../src/services/auditService.js', () => ({ default: auditService }));
vi.mock('../src/config/env.js', () => ({ default: env }));
vi.mock('../src/config/logger.js', () => ({ default: logger }));
vi.mock('../src/utils/crypto.js', () => ({ default: crypto, decrypt: crypto.decrypt }));
vi.mock('../src/utils/businessDays.js', () => ({ default: businessDays, getNextBusinessDay: businessDays.getNextBusinessDay }));
vi.mock('../src/services/asaasClient.js', () => ({ default: asaasClient }));

import settlementService from '../src/services/settlementService.js';

describe('settlementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sql.buscarSettlementActual.mockResolvedValue(null);
    sql.marcarPedidosArquivados.mockResolvedValue({});
    auditService.audit.mockResolvedValue({});
    env.asaasPixFeePercent = 2;
  });

  describe('fecharSemana', () => {
    const empresaId = 42;
    const weekDate = new Date(2025, 0, 6); // Monday Jan 6 2025
    const pedidos = [
      { id: 'p1', total: 100 },
      { id: 'p2', total: 200 },
    ];

    it('returns null when no pedidos', async () => {
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue([]);
      const result = await settlementService.fecharSemana(empresaId, weekDate);
      expect(result).toBeNull();
    }, 10000);

    it('returns existing settlement (idempotent)', async () => {
      const existing = { id: 99, empresaId };
      sql.buscarSettlementActual.mockResolvedValue(existing);
      const result = await settlementService.fecharSemana(empresaId, weekDate);
      expect(result).toBe(existing);
    }, 10000);

    it('creates settlement with splitStatus manual for non-onboarded empresa', async () => {
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
      sql.criarSettlement.mockImplementation(async (data) => ({ id: 1, ...data }));
      sql.buscarEmpresa.mockResolvedValue({ id: empresaId, asaasOnboarded: false });

      const result = await settlementService.fecharSemana(empresaId, weekDate);

      expect(result.splitStatus).toBe('manual');
      expect(result.transferId).toBeNull();
      expect(sql.atualizarSettlement).toHaveBeenCalledWith(1, expect.objectContaining({
        splitStatus: 'manual',
        transferId: null,
        transferStatus: null,
      }));
    }, 10000);

    it('calculates totalLiquido using env fee percent', async () => {
      env.asaasPixFeePercent = 3;
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
      sql.criarSettlement.mockImplementation(async (data) => ({ id: 2, ...data }));
      sql.buscarEmpresa.mockResolvedValue({ id: empresaId, asaasOnboarded: false });

      const result = await settlementService.fecharSemana(empresaId, weekDate);

      // 300 * (1 - 3/100) = 300 * 0.97 = 291
      expect(result.totalLiquido).toBeCloseTo(291, 2);
    }, 10000);

    it('schedules transfer for onboarded empresa with PIX key', async () => {
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
      sql.criarSettlement.mockImplementation(async (data) => ({ id: 3, ...data }));
      sql.buscarEmpresa.mockResolvedValue({
        id: empresaId,
        asaasOnboarded: true,
        pixKey: 'pix@key',
        pixKeyType: 'EMAIL',
        asaasApiKey: 'encrypted-key',
        asaasSubcontaId: 'sub_123',
      });
      crypto.decrypt.mockReturnValue('decrypted-token');
      asaasClient.consultarSaldo.mockResolvedValue({ available: 500 });
      asaasClient.agendarTransferencia.mockResolvedValue({ id: 'tr_abc', status: 'SCHEDULED' });
      businessDays.getNextBusinessDay.mockReturnValue(new Date(2025, 0, 7));

      const result = await settlementService.fecharSemana(empresaId, weekDate);

      expect(result.splitStatus).toBe('auto');
      expect(result.transferId).toBe('tr_abc');
      expect(result.transferStatus).toBe('scheduled');
      expect(result.transferAmount).toBe(294); // min(300*0.98, 500) = 294
      expect(asaasClient.agendarTransferencia).toHaveBeenCalledWith(expect.objectContaining({
        valor: 294,
        pixAddressKey: 'pix@key',
        pixAddressKeyType: 'EMAIL',
      }));
    }, 10000);

    it('caps transfer amount at available balance', async () => {
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
      sql.criarSettlement.mockImplementation(async (data) => ({ id: 4, ...data }));
      sql.buscarEmpresa.mockResolvedValue({
        id: empresaId,
        asaasOnboarded: true,
        pixKey: 'pix@key',
        pixKeyType: 'CPF',
        asaasApiKey: 'encrypted-key',
        asaasSubcontaId: 'sub_456',
      });
      crypto.decrypt.mockReturnValue('decrypted-token');
      asaasClient.consultarSaldo.mockResolvedValue({ available: 100 }); // less than totalLiquido
      asaasClient.agendarTransferencia.mockResolvedValue({ id: 'tr_def', status: 'SCHEDULED' });
      businessDays.getNextBusinessDay.mockReturnValue(new Date(2025, 0, 7));

      const result = await settlementService.fecharSemana(empresaId, weekDate);

      expect(result.transferAmount).toBe(100);
      expect(asaasClient.agendarTransferencia).toHaveBeenCalledWith(
        expect.objectContaining({ valor: 100 }),
      );
    }, 10000);

    it('does not fail settlement when transfer errors', async () => {
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
      sql.criarSettlement.mockImplementation(async (data) => ({ id: 5, ...data }));
      sql.buscarEmpresa.mockResolvedValue({
        id: empresaId,
        asaasOnboarded: true,
        pixKey: 'pix@key',
        pixKeyType: 'EMAIL',
        asaasApiKey: 'encrypted-key',
        asaasSubcontaId: 'sub_789',
      });
      crypto.decrypt.mockImplementation(() => { throw new Error('decrypt failed'); });

      const result = await settlementService.fecharSemana(empresaId, weekDate);

      expect(result.id).toBe(5);
      expect(result.splitStatus).toBe('auto');
      expect(result.transferId).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    }, 10000);

    it('sets splitStatus auto for onboarded empresa without PIX key', async () => {
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue(pedidos);
      sql.criarSettlement.mockImplementation(async (data) => ({ id: 6, ...data }));
      sql.buscarEmpresa.mockResolvedValue({
        id: empresaId,
        asaasOnboarded: true,
        pixKey: null,
      });

      const result = await settlementService.fecharSemana(empresaId, weekDate);

      expect(result.splitStatus).toBe('auto');
      expect(result.transferId).toBeNull();
    }, 10000);
  });
});
