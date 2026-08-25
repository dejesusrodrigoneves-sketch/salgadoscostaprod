import { describe, it, expect } from 'vitest';
import { normalizarSlug } from '../src/utils/slug.js';

describe('normalizarSlug', () => {
  it('lowercases and trims', () => {
    expect(normalizarSlug('  Fabrica De Salgados  ')).toBe('fabrica-de-salgados');
  });
  it('replaces non-alphanumerics with dashes', () => {
    expect(normalizarSlug('Loja & Cia!')).toBe('loja-cia');
  });
  it('collapses multiple dashes', () => {
    expect(normalizarSlug('a---b--c')).toBe('a-b-c');
  });
  it('strips leading/trailing dashes', () => {
    expect(normalizarSlug('--abc--')).toBe('abc');
  });
  it('returns empty for non-string', () => {
    expect(normalizarSlug(undefined)).toBe('');
    expect(normalizarSlug(null)).toBe('');
    expect(normalizarSlug(123)).toBe('');
  });
  it('keeps existing dashes', () => {
    expect(normalizarSlug('fabrica-salgados')).toBe('fabrica-salgados');
  });
});
