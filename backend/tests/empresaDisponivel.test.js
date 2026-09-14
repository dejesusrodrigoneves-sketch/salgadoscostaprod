import { describe, it, expect } from 'vitest';
import { isEmpresaDisponivel } from '../src/config/empresaCache.js';

describe('isEmpresaDisponivel (fail-closed)', () => {
  it('active => true', () => expect(isEmpresaDisponivel({ status: 'active', deletedAt: null })).toBe(true));
  it('suspended => false', () => expect(isEmpresaDisponivel({ status: 'suspended', deletedAt: null })).toBe(false));
  it('deleted => false', () => expect(isEmpresaDisponivel({ status: 'active', deletedAt: new Date() })).toBe(false));
  it('pending => false', () => expect(isEmpresaDisponivel({ status: 'pending' })).toBe(false));
  it('blocked => false', () => expect(isEmpresaDisponivel({ status: 'blocked' })).toBe(false));
  it('status desconhecido => false', () => expect(isEmpresaDisponivel({ status: 'weird' })).toBe(false));
  it('status null => false', () => expect(isEmpresaDisponivel({ status: null })).toBe(false));
  it('empresa null/undefined => false', () => { expect(isEmpresaDisponivel(null)).toBe(false); expect(isEmpresaDisponivel(undefined)).toBe(false); });
});
