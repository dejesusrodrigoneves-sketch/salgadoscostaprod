import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import tokenService from '../src/services/tokenService.js';
import * as registry from '../src/integrations/core/registry.js';

describe('financeiroRoutes', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('balance exige token (401)', async () => {
    const res = await request(app).get('/api/financeiro/balance');
    expect(res.status).toBe(401);
  });

  it('connect retorna 503 quando provider não configurado', async () => {
    const token = tokenService.gerarToken({ id: 2, username: 'admin', role: 'superadmin', empresaId: 7 });
    vi.spyOn(registry, 'getProvider').mockReturnValue({ platform: 'IFOOD', isConfigured: () => false });
    const res = await request(app)
      .post('/api/financeiro/integrations/IFOOD/connect')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('callback sem state retorna 400', async () => {
    const res = await request(app).get('/api/financeiro/integrations/IFOOD/callback?code=abc');
    expect(res.status).toBe(400);
  });

  it('admin integracoes exige superadmin (403)', async () => {
    const token = tokenService.gerarToken({ id: 2, username: 'admin', role: 'admin', empresaId: 7 });
    const res = await request(app)
      .get('/api/admin/integracoes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
