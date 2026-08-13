// tests/comboConfig.test.js
import { describe, test, expect } from 'vitest';
import ComboConfig from '../js/comboConfig.js';

describe('calcularPrecoAcai', () => {
  const cfg = { tipo: 'combo_acai', acrescimosGratis: 3, maxAcrescimos: 5,
    acrescimos: [{ nome: 'Oreo', preco: 2 }, { nome: 'Aveia', preco: 1 }, { nome: 'Paçoca', preco: 1.5 }] };

  test('primeiros N escolhidos sao gratis, demais pagam', () => {
    // Ordem: Leite Ninho, Granola (sem preço), X, Oreo, Paçoca
    // Grátis (3 primeiros): Leite Ninho, Granola, X
    // Pagos: Oreo (2), Paçoca (1.5) = 3.5
    const r = ComboConfig.calcularPrecoAcai(cfg, ['Leite Ninho', 'Granola', 'X', 'Oreo', 'Paçoca']);
    expect(r.extra).toBe(3.5);
    expect(r.gratis).toEqual(['Leite Ninho', 'Granola', 'X']);
    expect(r.pagos).toEqual(['Oreo', 'Paçoca']);
  });

  test('exatamente N escolhidos => extra zero', () => {
    const r = ComboConfig.calcularPrecoAcai(cfg, ['Oreo', 'Aveia', 'Paçoca']);
    expect(r.extra).toBe(0);
    expect(r.pagos).toEqual([]);
    expect(r.gratis).toEqual(['Oreo', 'Aveia', 'Paçoca']);
  });

  test('acrescimo sem preco configurado soma zero (nao quebra)', () => {
    const r = ComboConfig.calcularPrecoAcai(cfg, ['X', 'Y', 'Z', 'Oreo']);
    // Grátis: X, Y, Z | Pagos: Oreo (2)
    expect(r.extra).toBe(2);
  });
});

describe('tipoDe', () => {
  test('reconhece combo_salgado e combo_acai', () => {
    expect(ComboConfig.tipoDe({ tipo: 'combo_salgado' })).toBe('combo_salgado');
    expect(ComboConfig.tipoDe({ tipo: 'combo_acai' })).toBe('combo_acai');
    expect(ComboConfig.tipoDe(null)).toBe(null);
    expect(ComboConfig.tipoDe({ tipo: 'outro' })).toBe(null);
  });
});

describe('validarConfig', () => {
  test('combo_salgado invalido sem unidades', () => {
    const r = ComboConfig.validarConfig('combo_salgado', { tipo: 'combo_salgado', sabores: [] });
    expect(r.ok).toBe(false);
  });
  test('combo_acai invalido quando max < gratis', () => {
    const r = ComboConfig.validarConfig('combo_acai', { tipo: 'combo_acai', acrescimosGratis: 5, maxAcrescimos: 2, acrescimos: [] });
    expect(r.ok).toBe(false);
  });
  test('combo_acai invalido com preco negativo', () => {
    const r = ComboConfig.validarConfig('combo_acai', { tipo: 'combo_acai', acrescimosGratis: 1, maxAcrescimos: 3, acrescimos: [{ nome: 'Oreo', preco: -1 }] });
    expect(r.ok).toBe(false);
  });
});