import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';
import auditService from '../src/services/auditService.js';
import { login, criarConta } from '../src/services/authService.js';

const CTX = { requestId: 'req-1', ip: '127.0.0.1', userAgent: 'test', path: '/api/auth/login' };

const ADMIN_USER = {
  id: 10, username: 'admin1', passwordHash: 'HASHED:admin', role: 'admin', empresaId: 1, lojaNome: 'LojaAdmin',
};

const SUPERADMIN_USER = {
  id: 99, username: 'super1', passwordHash: 'HASHED:super', role: 'superadmin', empresaId: null, lojaNome: null,
};

// Decode JWT payload helper
function decodePayload(token) {
  const [, payloadB64] = token.split('.');
  return JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
}

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(prisma.usuario, 'findFirst').mockResolvedValue(null);
  vi.spyOn(prisma.empresa, 'findUnique').mockResolvedValue({ id: 1 });
  vi.spyOn(prisma.usuario, 'create').mockResolvedValue({ id: 1, username: 'novo', role: 'admin', empresaId: 1, lojaNome: 'novo' });
  vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);
  vi.spyOn(bcrypt, 'hash').mockResolvedValue('HASHED:x');
  vi.spyOn(auditService, 'audit').mockResolvedValue();
});

// ─── login — admin/user → empresaId no token ─────────────
describe('authService.login — admin/user', () => {
  it('token contém empresaId do usuário', async () => {
    prisma.usuario.findFirst.mockResolvedValueOnce(ADMIN_USER);

    const result = await login('admin1', 'senha123', 1, '127.0.0.1', 'test', CTX);

    expect(result.user.role).toBe('admin');
    const payload = decodePayload(result.token);
    expect(payload.empresaId).toBe(1);
    expect(payload.role).toBe('admin');
    expect(payload.username).toBe('admin1');
  });
});

// ─── login — superadmin → empresaId null ──────────────────
describe('authService.login — superadmin', () => {
  it('token contém empresaId: null', async () => {
    // buscarUsuario(username) → null, buscarUsuarioSuperadmin(username) → SUPERADMIN_USER
    prisma.usuario.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(SUPERADMIN_USER);

    const result = await login('super1', 'senha123', undefined, '127.0.0.1', 'test', CTX);

    expect(result.user.role).toBe('superadmin');
    const payload = decodePayload(result.token);
    expect(payload.empresaId).toBeNull();
    expect(payload.role).toBe('superadmin');
  });
});

// ─── login — credenciais inválidas ────────────────────────
describe('authService.login — credenciais inválidas', () => {
  it('lança 401 quando usuário não existe', async () => {
    await expect(login('ghost', 'x', undefined, '127.0.0.1', 'test', CTX))
      .rejects.toMatchObject({ status: 401 });
  });

  it('lança 401 quando senha não confere', async () => {
    prisma.usuario.findFirst.mockResolvedValue(ADMIN_USER);
    bcrypt.compare.mockResolvedValue(false);

    await expect(login('admin1', 'errada', 1, '127.0.0.1', 'test', CTX))
      .rejects.toMatchObject({ status: 401 });
  });
});

// ─── login — empresa deletada ─────────────────────────────
describe('authService.login — empresa inativa', () => {
  it('lança 403 quando empresa está deletada', async () => {
    prisma.usuario.findFirst.mockResolvedValue(ADMIN_USER);
    prisma.empresa.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });

    await expect(login('admin1', 'senha123', 1, '127.0.0.1', 'test', CTX))
      .rejects.toMatchObject({ status: 403 });
  });
});

// ─── criarConta — username duplicado global ────────────────
describe('authService.criarConta — username duplicado', () => {
  it('lança 409 quando username já existe globalmente', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 5, username: 'teste', role: 'admin', empresaId: 1 });

    await expect(criarConta({ username: 'teste', password: 'Senha123', empresaId: 2 }))
      .rejects.toMatchObject({ status: 409 });
  });
});

// ─── criarConta — sucesso ──────────────────────────────────
describe('authService.criarConta — sucesso', () => {
  it('cria conta e retorna token com dados corretos', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 20, username: 'novo', role: 'admin', empresaId: 3, lojaNome: 'novo' });

    const result = await criarConta({ username: 'novo', password: 'Senha123', empresaId: 3 });

    expect(result.user.username).toBe('novo');
    expect(result.user.role).toBe('admin');
    const payload = decodePayload(result.token);
    expect(payload.empresaId).toBe(3);
    expect(payload.username).toBe('novo');
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ empresaId: 3, username: 'novo', role: 'admin' }),
      }),
    );
  });
});

// ─── criarConta — empresaId obrigatório ────────────────────
describe('authService.criarConta — validação', () => {
  it('lança 400 quando empresaId não fornecido', async () => {
    await expect(criarConta({ username: 'x', password: 'y' }))
      .rejects.toMatchObject({ status: 400 });
  });
});
