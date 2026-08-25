import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

// prisma.js exporta CLIENT DIRETO (module.exports = prisma); ESM default interop.
// DEVE usar pattern import + vi.hoisted + { default } (igual paymentService.test.js).
vi.mock('../src/config/prisma.js', () => ({ default: { empresa: { findUnique } } }));

import { getEmpresaFromCache, invalidateEmpresaCache } from '../src/config/empresaCache.js';

describe('empresaCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna empresa do cache no segundo acesso', async () => {
    findUnique.mockResolvedValue({ id: 1, slug: 'test', nome: 'Test' });

    const e1 = await getEmpresaFromCache('test');
    const e2 = await getEmpresaFromCache('test');

    expect(e1.id).toBe(1);
    expect(e2.id).toBe(1);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('retorna null para slug inexistente', async () => {
    findUnique.mockResolvedValue(null);

    const result = await getEmpresaFromCache('naoexiste');

    expect(result).toBeNull();
  });

  it('invalida cache corretamente', async () => {
    // slug único p/ evitar colisão de cache module-level entre testes
    findUnique.mockResolvedValue({ id: 1, slug: 'test-3', nome: 'Test' });

    await getEmpresaFromCache('test-3');
    invalidateEmpresaCache('test-3');
    await getEmpresaFromCache('test-3');

    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
