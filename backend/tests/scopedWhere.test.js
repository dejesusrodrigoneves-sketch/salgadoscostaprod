import { describe, it, expect } from 'vitest';

describe('scopedWhere', () => {
  it('adiciona empresaId do ctx', () => {
    const scopedWhere = require('../src/utils/scopedWhere');
    const where = scopedWhere({ empresaId: 1 }, { deletedAt: null });
    expect(where).toEqual({ empresaId: 1, deletedAt: null });
  });

  it('superadmin global não filtra por empresa', () => {
    const scopedWhere = require('../src/utils/scopedWhere');
    const where = scopedWhere({ role: 'superadmin', empresaId: null }, { deletedAt: null });
    expect(where).toEqual({ deletedAt: null });
  });

  it('inclui extra sem empresa quando superadmin em empresa específica', () => {
    const scopedWhere = require('../src/utils/scopedWhere');
    const where = scopedWhere({ role: 'superadmin', empresaId: 2 }, { status: 'pendente' });
    expect(where).toEqual({ empresaId: 2, status: 'pendente' });
  });
});
