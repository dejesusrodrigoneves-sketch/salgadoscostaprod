import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('requireEmpresa middleware', () => {
  let requireEmpresa;

  beforeEach(() => {
    requireEmpresa = require('../src/middleware/requireEmpresa');
  });

  function mockRes() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }

  it('next() quando ctx.empresaId presente', () => {
    const req = { ctx: { empresaId: 1 }, user: { role: 'admin' } };
    const res = mockRes();
    const next = vi.fn();
    requireEmpresa(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('bloqueia quando ctx.empresaId ausente (user)', () => {
    const req = { ctx: {}, user: { role: 'user' } };
    const res = mockRes();
    const next = vi.fn();
    requireEmpresa(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('next() para superadmin sem ctx.empresaId', () => {
    const req = { ctx: {}, user: { role: 'superadmin' } };
    const res = mockRes();
    const next = vi.fn();
    requireEmpresa(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
