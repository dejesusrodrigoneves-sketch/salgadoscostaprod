import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getEmpresaFromCache } = vi.hoisted(() => ({ getEmpresaFromCache: vi.fn() }));

vi.mock('../src/config/empresaCache.js', () => ({ getEmpresaFromCache }));

import { resolveEmpresa } from '../src/middleware/resolveEmpresa.js';

describe('resolveEmpresa middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockReq(host, query) {
    return { headers: { host }, ctx: {}, query: query || {} };
  }

  function mockRes() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }

  it('resolve empresa válida', async () => {
    getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'test', nome: 'Test' });
    const req = mockReq('test.sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBe(1);
    expect(req.ctx.empresa.slug).toBe('test');
    expect(next).toHaveBeenCalled();
  });

  it('retorna 404 para slug inexistente', async () => {
    getEmpresaFromCache.mockResolvedValue(null);
    const req = mockReq('naoexiste.sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignora subdomínio www', async () => {
    const req = mockReq('www.sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('ignora localhost (dev)', async () => {
    const req = mockReq('localhost');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('ignora IP / sem ponto (dev)', async () => {
    const req = mockReq('127.0.0.1');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('ignora domínio raiz sem subdomínio', async () => {
    const req = mockReq('sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('resolveEmpresa - query slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockReq(host, query) {
    return { headers: { host }, ctx: {}, query: query || {} };
  }

  function mockRes() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }

  it('resolve empresa de ?slug= quando host é localhost', async () => {
    getEmpresaFromCache.mockResolvedValue({ id: 7, slug: 'teste', nome: 'Teste' });
    const req = mockReq('localhost', { slug: 'TESTE' });
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(getEmpresaFromCache).toHaveBeenCalledWith('teste');
    expect(req.ctx.empresaId).toBe(7);
    expect(req.ctx.empresa.slug).toBe('teste');
    expect(next).toHaveBeenCalled();
  });

  it('retorna 404 quando ?slug= não existe no cache', async () => {
    getEmpresaFromCache.mockResolvedValue(null);
    const req = mockReq('localhost', { slug: 'naoexiste' });
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignora ?slug= vazio e cai no host logic (localhost => sem tenant)', async () => {
    const req = mockReq('localhost', { slug: '   ' });
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(getEmpresaFromCache).not.toHaveBeenCalled();
    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
