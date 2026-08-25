import { describe, it, expect, vi } from 'vitest';
import { listarClientes, atualizarCliente, resetarSenha, deletarCliente } from '../src/services/clientService.js';

function deps() {
  return {
    sql: {
      listarClientes: vi.fn(async () => [
        { id: 1, nome: 'Maria', telefone: '21999999999', endereco: 'Rua A', numero: '10', bairro: 'Centro', cep: '20000-000', pontoReferencia: null, passwordHash: 'HASH', createdAt: new Date('2026-08-01'), consentimentoAt: new Date('2026-08-01'), consentimentoRevogadoAt: null },
      ]),
      buscarCliente: vi.fn(async (t) => (t === '21999999999' ? { id: 2 } : null)),
      buscarClientePorId: vi.fn(async (id) => (id === 99 ? null : { id, nome: 'Maria', telefone: '21999999999', endereco: 'Rua A', numero: '10', bairro: 'Centro', cep: '20000-000', pontoReferencia: null, createdAt: new Date('2026-08-01'), consentimentoAt: new Date('2026-08-01'), consentimentoRevogadoAt: null })),
      atualizarCliente: vi.fn(async (id, data) => ({ id, ...data })),
      deletarCliente: vi.fn(async (id) => ({ id })),
    },
    bcrypt: { hash: vi.fn(async (p) => 'HASHED:' + p) },
    auditService: { audit: vi.fn(async () => {}) },
    SALT_ROUNDS: 10,
  };
}

describe('listarClientes', () => {
  it('remove passwordHash da resposta', async () => {
    const d = deps();
    const result = await listarClientes(1, d);
    expect(result).toHaveLength(1);
    expect(result[0].passwordHash).toBeUndefined();
  });
});

describe('atualizarCliente', () => {
  it('rejeita telefone duplicado com 409', async () => {
    const d = deps();
    await expect(atualizarCliente(1, { telefone: '21999999999' }, {}, d))
      .rejects.toMatchObject({ message: 'Telefone já cadastrado por outro cliente', status: 409 });
  });
  it('atualiza e audita', async () => {
    const d = deps();
    const r = await atualizarCliente(1, { nome: 'Maria Silva', bairro: 'Copacabana' }, {}, d);
    expect(r.nome).toBe('Maria Silva');
    expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cliente.admin_update' }));
  });
  it('404 se cliente não existe', async () => {
    const d = deps();
    await expect(atualizarCliente(99, { nome: 'X' }, {}, d))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('resetarSenha', () => {
  it('rejeita senha curta com 400', async () => {
    const d = deps();
    await expect(resetarSenha(1, '123', {}, d)).rejects.toMatchObject({ status: 400 });
  });
  it('hasha e atualiza passwordHash, audita critical', async () => {
    const d = deps();
    const r = await resetarSenha(1, 'novaSenha123', {}, d);
    expect(r.success).toBe(true);
    expect(d.sql.atualizarCliente).toHaveBeenCalledWith(1, { passwordHash: 'HASHED:novaSenha123' });
    expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cliente.admin_reset_password', severity: 'critical' }));
  });
  it('404 se cliente não existe', async () => {
    const d = deps();
    await expect(resetarSenha(99, 'novaSenha123', {}, d)).rejects.toMatchObject({ status: 404 });
  });
});

describe('deletarCliente', () => {
  it('deleta e audita critical', async () => {
    const d = deps();
    const r = await deletarCliente(1, {}, d);
    expect(r.success).toBe(true);
    expect(d.sql.deletarCliente).toHaveBeenCalledWith(1);
    expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cliente.admin_delete', severity: 'critical' }));
  });
});