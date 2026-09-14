import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getEmpresaFromCache } = vi.hoisted(() => ({ getEmpresaFromCache: vi.fn() }));

vi.mock('../src/config/empresaCache.js', () => ({
  getEmpresaFromCache,
  isEmpresaDisponivel: (e) => !!e && !e.deletedAt && e.status === 'active',
}));

import { resolveEmpresa } from '../src/middleware/resolveEmpresa.js';

describe('resolveEmpresa middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CORS_BASE_DOMAIN;
    delete process.env.API_HOST;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.TRUSTED_HOSTS;
    process.env.NODE_ENV = 'test';
  });

  function mockRes() {
    const r = { code: 0, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
  }

  it('resolve por Origin canônico', async () => {
    process.env.CORS_BASE_DOMAIN = 'vercel.app';
    getEmpresaFromCache.mockResolvedValue({ id: 5, slug: 'loja1', status: 'active', deletedAt: null });
    const req = { headers: { host: 'svc.up.railway.app', origin: 'https://loja1.vercel.app' }, ctx: {}, query: {} };
    const res = mockRes(); const next = vi.fn();
    await resolveEmpresa(req, res, next);
    expect(req.ctx.empresaId).toBe(5);
  });

  it('suspenso => 404', async () => {
    process.env.CORS_BASE_DOMAIN = 'vercel.app';
    getEmpresaFromCache.mockResolvedValue({ id: 9, slug: 'susp', status: 'suspended' });
    const res = mockRes(); const next = vi.fn();
    await resolveEmpresa({ headers: { origin: 'https://susp.vercel.app' }, ctx: {}, query: {} }, res, next);
    expect(res.code).toBe(404);
  });

  it('Status null/desconhecido => 404', async () => {
    process.env.CORS_BASE_DOMAIN = 'vercel.app';
    getEmpresaFromCache.mockResolvedValue({ id: 9, slug: 'x', status: null });
    const res = mockRes(); const next = vi.fn();
    await resolveEmpresa({ headers: { origin: 'https://x.vercel.app' }, ctx: {}, query: {} }, res, next);
    expect(res.code).toBe(404);
  });

  it('host arbitrário NÃO vira tenant', async () => {
    const req = { headers: { host: 'evil.example.com' }, ctx: {}, query: {} };
    const next = vi.fn();
    await resolveEmpresa(req, mockRes(), next);
    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('API_HOST ignorado (sem Origin)', async () => {
    process.env.API_HOST = 'svc.up.railway.app';
    process.env.CORS_BASE_DOMAIN = 'vercel.app';
    const req = { headers: { host: 'svc.up.railway.app' }, ctx: {}, query: {} };
    const next = vi.fn();
    await resolveEmpresa(req, mockRes(), next);
    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('?slug= ignorado em produção', async () => {
    process.env.NODE_ENV = 'production';
    const req = { headers: { host: 'localhost' }, ctx: {}, query: { slug: 'loja1' } };
    const next = vi.fn();
    await resolveEmpresa(req, mockRes(), next);
    expect(getEmpresaFromCache).not.toHaveBeenCalled();
  });

  it('?slug= permitido em dev', async () => {
    process.env.NODE_ENV = 'development';
    getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'loja1', status: 'active' });
    const req = { headers: { host: 'localhost' }, ctx: {}, query: { slug: 'Loja1' } };
    const next = vi.fn();
    await resolveEmpresa(req, mockRes(), next);
    expect(getEmpresaFromCache).toHaveBeenCalledWith('loja1');
  });

  it('conflito Origin x ?slug= => vence Origin', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CORS_BASE_DOMAIN = 'vercel.app';
    getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'certa', status: 'active' });
    const req = { headers: { origin: 'https://certa.vercel.app' }, ctx: {}, query: { slug: 'outra' } };
    const next = vi.fn();
    await resolveEmpresa(req, mockRes(), next);
    expect(getEmpresaFromCache).toHaveBeenCalledWith('certa');
  });

  it('cache error => next(err) (não pendura)', async () => {
    process.env.CORS_BASE_DOMAIN = 'vercel.app';
    getEmpresaFromCache.mockRejectedValue(new Error('db down'));
    const next = vi.fn();
    await resolveEmpresa({ headers: { origin: 'https://loja1.vercel.app' }, ctx: {}, query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
