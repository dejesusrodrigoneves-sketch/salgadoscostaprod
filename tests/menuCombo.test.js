import { describe, it, expect } from 'vitest';
import { totalSelecionado, podeIncrementar } from '../js/comboLimite.js';

describe('comboLimite', () => {
  it('soma quantidades selecionadas', () => {
    expect(totalSelecionado({ 1: 2, 2: 3 })).toBe(5);
    expect(totalSelecionado({})).toBe(0);
  });
  it('permite incrementar enquanto total < unidades', () => {
    expect(podeIncrementar({ 1: 24 }, 25)).toBe(true);
    expect(podeIncrementar({ 1: 25 }, 25)).toBe(false);
  });
});
