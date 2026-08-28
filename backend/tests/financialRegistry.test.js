import { describe, it, expect } from 'vitest';
import { registerProvider, getProvider, listProviders } from '../src/integrations/core/registry.js';

describe('FinancialProviderRegistry', () => {
  it('registra e recupera provider', () => {
    const p = { platform: 'IFOOD', isConfigured: () => false };
    registerProvider(p);
    expect(getProvider('IFOOD')).toBe(p);
    expect(listProviders()).toContain(p);
  });

  it('retorna null para plataforma não registrada', () => {
    expect(getProvider('RAPPI')).toBeNull();
  });

  it('rejeita provider sem platform', () => {
    expect(() => registerProvider({})).toThrow('Provider sem platform');
  });
});
