import { describe, it, expect, vi, beforeEach } from 'vitest';

import paymentSetupService from '../src/services/paymentSetupService.js';

function deps() {
  return {
    sql: {
      buscarEmpresa: vi.fn(),
      buscarEmpresaByEmail: vi.fn(),
      atualizarEmpresa: vi.fn(),
      listarSettlements: vi.fn(),
    },
    asaasClient: {
      criarSubconta: vi.fn(),
    },
    encrypt: vi.fn(),
    auditService: {
      audit: vi.fn(),
    },
    getNextBusinessDay: vi.fn(),
  };
}

describe('paymentSetupService', () => {
  let d;
  beforeEach(() => {
    d = deps();
    d.getNextBusinessDay.mockImplementation((dt) => {
      const next = new Date(dt);
      next.setDate(next.getDate() + 1);
      return next;
    });
  });

  const empresaBase = {
    id: 1,
    nome: 'Teste LTDA',
    telefone: '11999999999',
    email: 'old@test.com',
    cpfCnpj: '12345678000190',
    pixKey: null,
    pixKeyType: null,
    asaasSubcontaId: null,
    asaasWalletId: null,
    asaasApiKey: null,
    asaasOnboarded: false,
    asaasCreatedAt: null,
    deletedAt: null,
  };

  describe('setup', () => {
    it('creates subconta and saves encrypted api key', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      d.sql.buscarEmpresaByEmail.mockResolvedValue(null);
      d.asaasClient.criarSubconta.mockResolvedValue({
        id: 'sub_123',
        apiKey: 'sk_live_abc',
        walletId: 'wallet_456',
      });
      d.encrypt.mockReturnValue('encrypted_key');
      d.sql.atualizarEmpresa.mockResolvedValue({});

      const result = await paymentSetupService.setup(1, {
        email: 'novo@test.com',
        cpfCnpj: '12345678000190',
        pixKey: 'novo@test.com',
        pixKeyType: 'email',
      }, d);

      expect(d.asaasClient.criarSubconta).toHaveBeenCalledWith({
        nome: 'Teste LTDA',
        email: 'novo@test.com',
        cpfCnpj: '12345678000190',
        phone: '11999999999',
      });
      expect(d.encrypt).toHaveBeenCalledWith('sk_live_abc');
      expect(d.sql.atualizarEmpresa).toHaveBeenCalledWith(1, expect.objectContaining({
        email: 'novo@test.com',
        cpfCnpj: '12345678000190',
        pixKey: 'novo@test.com',
        pixKeyType: 'email',
        asaasSubcontaId: 'sub_123',
        asaasWalletId: 'wallet_456',
        asaasApiKey: 'encrypted_key',
        asaasOnboarded: true,
      }));
      expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'empresa.payment_setup',
        targetType: 'empresa',
        targetId: 1,
      }));
      expect(result.success).toBe(true);
      expect(result.asaasSubcontaId).toBe('sub_123');
    });

    it('throws if empresa not found', async () => {
      d.sql.buscarEmpresa.mockResolvedValue(null);
      await expect(paymentSetupService.setup(99, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'valid@test.com', pixKeyType: 'email' }, d))
        .rejects.toThrow('Empresa não encontrada');
    });

    it('throws if already onboarded', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, asaasOnboarded: true });
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'valid@test.com', pixKeyType: 'email' }, d))
        .rejects.toThrow('já possui split configurado');
    });

    it('throws if empresa is deleted', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, deletedAt: new Date() });
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'valid@test.com', pixKeyType: 'email' }, d))
        .rejects.toThrow('inativa');
    });

    it('throws on missing required fields', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      await expect(paymentSetupService.setup(1, { cpfCnpj: '123', pixKey: 'x', pixKeyType: 'email' }, d))
        .rejects.toThrow('email obrigatório');
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', pixKey: 'x', pixKeyType: 'email' }, d))
        .rejects.toThrow('cpfCnpj obrigatório');
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKeyType: 'email' }, d))
        .rejects.toThrow('pixKey obrigatório');
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'x' }, d))
        .rejects.toThrow('pixKeyType inválido');
    });

    it('throws on invalid pixKeyType', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'x', pixKeyType: 'invalid' }, d))
        .rejects.toThrow('pixKeyType inválido');
    });

    it('throws on invalid pixKey format for type', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'abc', pixKeyType: 'cpf' }, d))
        .rejects.toThrow('pixKey inválido para o tipo "cpf"');
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: '12345', pixKeyType: 'cnpj' }, d))
        .rejects.toThrow('pixKey inválido para o tipo "cnpj"');
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'not-an-email', pixKeyType: 'email' }, d))
        .rejects.toThrow('pixKey inválido para o tipo "email"');
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: '123', pixKeyType: 'phone' }, d))
        .rejects.toThrow('pixKey inválido para o tipo "phone"');
      await expect(paymentSetupService.setup(1, { email: 'a@b.com', cpfCnpj: '123', pixKey: 'not-a-uuid', pixKeyType: 'random' }, d))
        .rejects.toThrow('pixKey inválido para o tipo "random"');
    });

    it('accepts valid pixKey formats', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      d.sql.buscarEmpresaByEmail.mockResolvedValue(null);
      d.asaasClient.criarSubconta.mockResolvedValue({ id: 'sub_1', apiKey: 'sk', walletId: 'w_1' });
      d.encrypt.mockReturnValue('enc');
      d.sql.atualizarEmpresa.mockResolvedValue({});

      const validKeys = [
        { pixKey: '12345678901', pixKeyType: 'cpf' },
        { pixKey: '12345678000190', pixKeyType: 'cnpj' },
        { pixKey: 'test@test.com', pixKeyType: 'email' },
        { pixKey: '11999999999', pixKeyType: 'phone' },
        { pixKey: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', pixKeyType: 'random' },
      ];
      for (const { pixKey, pixKeyType } of validKeys) {
        await expect(paymentSetupService.setup(1, { email: 'novo@test.com', cpfCnpj: '12345678000190', pixKey, pixKeyType }, d))
          .resolves.toHaveProperty('success', true);
      }
    });

    it('throws on email collision', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      d.sql.buscarEmpresaByEmail.mockResolvedValue({ id: 999, email: 'taken@test.com' });
      await expect(paymentSetupService.setup(1, { email: 'taken@test.com', cpfCnpj: '123', pixKey: '12345678901', pixKeyType: 'cpf' }, d))
        .rejects.toThrow('email já utilizado por outra empresa');
    });

    it('allows same empresa to reuse its own email', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      d.sql.buscarEmpresaByEmail.mockResolvedValue({ id: 1, email: 'old@test.com' });
      d.asaasClient.criarSubconta.mockResolvedValue({ id: 'sub_1', apiKey: 'sk', walletId: 'w_1' });
      d.encrypt.mockReturnValue('enc');
      d.sql.atualizarEmpresa.mockResolvedValue({});

      const result = await paymentSetupService.setup(1, { email: 'old@test.com', cpfCnpj: '12345678000190', pixKey: 'old@test.com', pixKeyType: 'email' }, d);
      expect(result.success).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns onboarding status with last settlement', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({
        ...empresaBase,
        asaasOnboarded: true,
        asaasSubcontaId: 'sub_123',
        pixKey: 'test@test.com',
        pixKeyType: 'email',
      });
      d.sql.listarSettlements.mockResolvedValue({
        settlements: [{ splitStatus: 'aprovado' }],
        total: 1,
      });

      const status = await paymentSetupService.getStatus(1, d);
      expect(status.onboarded).toBe(true);
      expect(status.asaasSubcontaId).toBe('sub_123');
      expect(status.pixKey).toBe('test@test.com');
      expect(status.lastSplitStatus).toBe('aprovado');
      expect(status.nextTransferDate).toBeInstanceOf(Date);
    });

    it('returns null splitStatus when no settlements', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase });
      d.sql.listarSettlements.mockResolvedValue({ settlements: [], total: 0 });

      const status = await paymentSetupService.getStatus(1, d);
      expect(status.onboarded).toBe(false);
      expect(status.lastSplitStatus).toBeNull();
    });

    it('throws if empresa not found', async () => {
      d.sql.buscarEmpresa.mockResolvedValue(null);
      await expect(paymentSetupService.getStatus(99, d)).rejects.toThrow('Empresa não encontrada');
    });

    it('throws if empresa is deleted', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, deletedAt: new Date() });
      await expect(paymentSetupService.getStatus(1, d)).rejects.toThrow('Empresa inativa');
    });
  });

  describe('update', () => {
    it('updates pix data only', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({
        ...empresaBase,
        asaasOnboarded: true,
        pixKey: 'old@test.com',
        pixKeyType: 'email',
      });
      d.sql.atualizarEmpresa.mockResolvedValue({});

      const result = await paymentSetupService.update(1, { pixKey: '99999999999', pixKeyType: 'phone' }, d);
      expect(d.sql.atualizarEmpresa).toHaveBeenCalledWith(1, { pixKey: '99999999999', pixKeyType: 'phone' });
      expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'empresa.payment_updated',
      }));
      expect(result.success).toBe(true);
    });

    it('throws if not onboarded', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, asaasOnboarded: false });
      await expect(paymentSetupService.update(1, { pixKey: 'valid@test.com', pixKeyType: 'email' }, d))
        .rejects.toThrow('não possui split configurado');
    });

    it('throws on invalid pixKeyType', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, asaasOnboarded: true });
      await expect(paymentSetupService.update(1, { pixKey: 'x', pixKeyType: 'bad' }, d))
        .rejects.toThrow('pixKeyType inválido');
    });

    it('throws on invalid pixKey format for type', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, asaasOnboarded: true });
      await expect(paymentSetupService.update(1, { pixKey: 'abc', pixKeyType: 'cpf' }, d))
        .rejects.toThrow('pixKey inválido para o tipo "cpf"');
      await expect(paymentSetupService.update(1, { pixKey: 'bad-email', pixKeyType: 'email' }, d))
        .rejects.toThrow('pixKey inválido para o tipo "email"');
    });

    it('throws if empresa is deleted', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, asaasOnboarded: true, deletedAt: new Date() });
      await expect(paymentSetupService.update(1, { pixKey: '12345678901', pixKeyType: 'cpf' }, d))
        .rejects.toThrow('Empresa inativa');
    });
  });

  describe('deactivate', () => {
    it('clears asaas fields and audits', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({
        ...empresaBase,
        asaasOnboarded: true,
        asaasSubcontaId: 'sub_123',
      });
      d.sql.atualizarEmpresa.mockResolvedValue({});

      const result = await paymentSetupService.deactivate(1, d);
      expect(d.sql.atualizarEmpresa).toHaveBeenCalledWith(1, {
        asaasSubcontaId: null,
        asaasWalletId: null,
        asaasApiKey: null,
        asaasOnboarded: false,
        asaasCreatedAt: null,
      });
      expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'empresa.payment_deactivated',
      }));
      expect(result.success).toBe(true);
    });

    it('throws if not onboarded', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, asaasOnboarded: false });
      await expect(paymentSetupService.deactivate(1, d))
        .rejects.toThrow('não possui split configurado');
    });

    it('throws if empresa not found', async () => {
      d.sql.buscarEmpresa.mockResolvedValue(null);
      await expect(paymentSetupService.deactivate(99, d))
        .rejects.toThrow('Empresa não encontrada');
    });

    it('throws if empresa is deleted', async () => {
      d.sql.buscarEmpresa.mockResolvedValue({ ...empresaBase, asaasOnboarded: true, deletedAt: new Date() });
      await expect(paymentSetupService.deactivate(1, d))
        .rejects.toThrow('Empresa inativa');
    });
  });
});

describe('validatePixKey', () => {
  it('validates CPF as 11 digits', () => {
    expect(paymentSetupService.validatePixKey('12345678901', 'cpf')).toBe(true);
    expect(paymentSetupService.validatePixKey('1234567890', 'cpf')).toBe(false);
    expect(paymentSetupService.validatePixKey('123456789012', 'cpf')).toBe(false);
    expect(paymentSetupService.validatePixKey('abcdefghijk', 'cpf')).toBe(false);
  });

  it('validates CNPJ as 14 digits', () => {
    expect(paymentSetupService.validatePixKey('12345678000190', 'cnpj')).toBe(true);
    expect(paymentSetupService.validatePixKey('1234567800019', 'cnpj')).toBe(false);
    expect(paymentSetupService.validatePixKey('123456780001901', 'cnpj')).toBe(false);
  });

  it('validates EMAIL with basic regex', () => {
    expect(paymentSetupService.validatePixKey('test@test.com', 'email')).toBe(true);
    expect(paymentSetupService.validatePixKey('a@b.co', 'email')).toBe(true);
    expect(paymentSetupService.validatePixKey('not-email', 'email')).toBe(false);
    expect(paymentSetupService.validatePixKey('@test.com', 'email')).toBe(false);
    expect(paymentSetupService.validatePixKey('test@', 'email')).toBe(false);
  });

  it('validates PHONE as 10-11 digits', () => {
    expect(paymentSetupService.validatePixKey('11999999999', 'phone')).toBe(true);
    expect(paymentSetupService.validatePixKey('1199999999', 'phone')).toBe(true);
    expect(paymentSetupService.validatePixKey('119999999', 'phone')).toBe(false);
    expect(paymentSetupService.validatePixKey('119999999999', 'phone')).toBe(false);
  });

  it('validates random as UUID', () => {
    expect(paymentSetupService.validatePixKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'random')).toBe(true);
    expect(paymentSetupService.validatePixKey('A1B2C3D4-E5F6-7890-ABCD-EF1234567890', 'random')).toBe(true);
    expect(paymentSetupService.validatePixKey('not-a-uuid', 'random')).toBe(false);
    expect(paymentSetupService.validatePixKey('a1b2c3d4e5f67890abcdef1234567890', 'random')).toBe(false);
  });

  it('returns false for null/undefined/non-string', () => {
    expect(paymentSetupService.validatePixKey(null, 'cpf')).toBe(false);
    expect(paymentSetupService.validatePixKey(undefined, 'cpf')).toBe(false);
    expect(paymentSetupService.validatePixKey(12345, 'cpf')).toBe(false);
  });

  it('returns false for unknown type', () => {
    expect(paymentSetupService.validatePixKey('test', 'unknown')).toBe(false);
  });
});
