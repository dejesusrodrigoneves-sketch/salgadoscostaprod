import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/config/prisma.js';
import auditService from '../src/services/auditService.js';
import * as registry from '../src/integrations/core/registry.js';
import { processarCallback, iniciarConexao, desconectar } from '../src/services/platformConnectionService.js';

describe('platformConnectionService (anti-IDOR)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('rejeita state inválido', async () => {
    vi.spyOn(prisma.oAuthState, 'findUnique').mockResolvedValue(null);
    await expect(processarCallback('IFOOD', 'code', 'nao-existe')).rejects.toMatchObject({ status: 400 });
  });

  it('rejeita state já utilizado (single-use)', async () => {
    vi.spyOn(prisma.oAuthState, 'findUnique').mockResolvedValue({
      nonce: 'n1', empresaId: 7, usuarioId: 1, platform: 'IFOOD', expiresAt: new Date(Date.now() + 60000), usedAt: new Date(),
    });
    await expect(processarCallback('IFOOD', 'code', 'n1')).rejects.toMatchObject({ status: 400 });
  });

  it('rejeita state expirado', async () => {
    vi.spyOn(prisma.oAuthState, 'findUnique').mockResolvedValue({
      nonce: 'n1', empresaId: 7, usuarioId: 1, platform: 'IFOOD', expiresAt: new Date(Date.now() - 1000), usedAt: null,
    });
    await expect(processarCallback('IFOOD', 'code', 'n1')).rejects.toMatchObject({ status: 400 });
  });

  it('rejeita state de plataforma diferente', async () => {
    vi.spyOn(prisma.oAuthState, 'findUnique').mockResolvedValue({
      nonce: 'n1', empresaId: 7, usuarioId: 1, platform: 'KEETA', expiresAt: new Date(Date.now() + 60000), usedAt: null,
    });
    await expect(processarCallback('IFOOD', 'code', 'n1')).rejects.toMatchObject({ status: 403 });
  });

  it('resolve empresa do state e cria conexão', async () => {
    vi.spyOn(prisma.oAuthState, 'findUnique').mockResolvedValue({
      nonce: 'n1', empresaId: 7, usuarioId: 1, platform: 'IFOOD', expiresAt: new Date(Date.now() + 60000), usedAt: null,
    });
    vi.spyOn(prisma.oAuthState, 'update').mockResolvedValue({});
    const provider = {
      platform: 'IFOOD',
      isConfigured: () => true,
      exchangeCode: async () => ({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600, externalAccountId: 'ext-1' }),
    };
    vi.spyOn(registry, 'getProvider').mockReturnValue(provider);
    const upsert = vi.spyOn(prisma.platformConnection, 'upsert').mockResolvedValue({ id: 1 });
    vi.spyOn(auditService, 'audit').mockResolvedValue(undefined);

    const result = await processarCallback('IFOOD', 'code', 'n1');

    expect(result.empresaId).toBe(7);
    const { where, create } = upsert.mock.calls[0][0];
    expect(where.empresaId_platform.empresaId).toBe(7);
    expect(create.empresaId).toBe(7);
  });

  it('iniciarConexao retorna 503 se não configurado', async () => {
    vi.spyOn(registry, 'getProvider').mockReturnValue({ platform: 'IFOOD', isConfigured: () => false });
    await expect(iniciarConexao(7, 1, 'IFOOD')).rejects.toMatchObject({ status: 503 });
  });
});
