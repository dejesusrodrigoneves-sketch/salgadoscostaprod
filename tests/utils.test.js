import { describe, it, expect } from 'vitest';

// Simula o DOM necessário para utils.js
globalThis.document = {
  createElement: (tag) => {
    const el = { tagName: tag, style: {}, innerHTML: '', onclick: null };
    el.remove = () => {};
    return el;
  },
  body: { appendChild: () => {}, removeChild: () => {} },
};

// Carrega utils.js (CommonJS, precisa do require)
const utils = require('../js/utils.js');

describe('escapeHtml', () => {
  it('escapa & < > " \'', () => {
    expect(utils.escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
  it('retorna string vazia para input vazio', () => {
    expect(utils.escapeHtml('')).toBe('');
  });
  it('mantém texto normal', () => {
    expect(utils.escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('fmtMoeda', () => {
  it('formata número como moeda BRL', () => {
    const result = utils.fmtMoeda(25.9);
    expect(result).toContain('R$');
    expect(result).toContain('25');
  });
  it('retorna R$ 0,00 para null', () => {
    expect(utils.fmtMoeda(null)).toBe('R$ 0,00');
  });
  it('retorna R$ 0,00 para undefined', () => {
    expect(utils.fmtMoeda(undefined)).toBe('R$ 0,00');
  });
});

describe('debounce', () => {
  it('retorna uma função', () => {
    const fn = utils.debounce(() => {}, 100);
    expect(typeof fn).toBe('function');
  });
  it('executa a função após o delay', async () => {
    let called = false;
    const fn = utils.debounce(() => { called = true; }, 50);
    fn();
    expect(called).toBe(false);
    await new Promise(r => setTimeout(r, 100));
    expect(called).toBe(true);
  });
});
