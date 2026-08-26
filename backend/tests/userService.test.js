import { describe, it, expect, vi, beforeEach } from 'vitest';

import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';
import auditService from '../src/services/auditService.js';
import { deletar, resetarSenha, criar } from '../src/services/userService.js';

const CTX = {
  requestId: 'req-1',
  ip: '127.0.0.1',
  userAgent: 'test',
  path: '/api/usuarios/1',
  actor: { actorType: 'admin', actorId: 1, actorUsername: 'admin', actorRole: 'superadmin' },
};

const USER_ROW = { id: 1, username: 'joao', role: 'user' };

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(prisma.usuario, 'findFirst').mockImplementation(async ({ where }) => {
    if (where.empresaId !== undefined && typeof where.empresaId !== 'number')
      throw Object.assign(new Error('empresaId inválido'), { status: 400 });
    return where.id === 1 ? USER_ROW : null;
  });
  vi.spyOn(prisma.usuario, 'create').mockResolvedValue({ id: 100, username: 'novo', role: 'user', lojaNome: 'novo' });
  vi.spyOn(prisma.usuario, 'delete').mockResolvedValue({});
  vi.spyOn(prisma.usuario, 'update').mockResolvedValue({});
  vi.spyOn(bcrypt, 'hash').mockResolvedValue('HASHED:x');
  vi.spyOn(auditService, 'audit').mockResolvedValue();
});

// ─── deletar ────────────────────────────────────────────
describe('userService.deletar', () => {
  it('deleta usuário existente e retorna success', async () => {
    prisma.usuario.delete.mockResolvedValue({});

    const result = await deletar(1, CTX);

    expect(result).toEqual({ success: true });
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, username: true, role: true },
    });
    expect(prisma.usuario.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(auditService.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.delete', severity: 'critical' }),
    );
  });

  it('lança 404 quando usuário não existe', async () => {
    await expect(deletar(999, CTX)).rejects.toMatchObject({ status: 404 });
  });
});

// ─── resetarSenha ───────────────────────────────────────
describe('userService.resetarSenha', () => {
  it('reseta senha de usuário existente e retorna success', async () => {
    prisma.usuario.update.mockResolvedValue({});
    bcrypt.hash.mockResolvedValue('HASHED:novaSenha');

    const result = await resetarSenha(1, 'novaSenha', CTX);

    expect(result).toEqual({ success: true });
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, username: true, role: true },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha', 10);
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { passwordHash: 'HASHED:novaSenha' },
    });
    expect(auditService.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.reset_password', severity: 'critical' }),
    );
  });

  it('lança 404 quando usuário não existe', async () => {
    await expect(resetarSenha(999, 'novaSenha', CTX)).rejects.toMatchObject({ status: 404 });
  });

  it('lança 400 quando senha é muito curta', async () => {
    await expect(resetarSenha(1, '123', CTX)).rejects.toMatchObject({ status: 400 });
  });
});

// ─── criar — username duplicado global ─────────────────────
describe('userService.criar', () => {
  it('cria usuário quando username não existe', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 100, username: 'teste', role: 'user', lojaNome: 'teste' });

    const result = await criar({
      username: 'teste', password: 'Teste123', lojaNome: 'teste', role: 'user', empresaId: 1,
    });

    expect(result.username).toBe('teste');
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({ where: { username: 'teste' } });
    expect(prisma.usuario.create).toHaveBeenCalled();
  });

  it('lança 409 quando username já existe globalmente (outra empresa)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 1, username: 'teste', role: 'user', empresaId: 1 });

    await expect(
      criar({ username: 'teste', password: 'Teste123', lojaNome: 'teste2', role: 'user', empresaId: 2 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('lança 400 quando empresaId não fornecido', async () => {
    await expect(
      criar({ username: 'teste', password: 'Teste123' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
