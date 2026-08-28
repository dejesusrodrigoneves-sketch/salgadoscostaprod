import { describe, it, expect } from 'vitest';
import ifoodProvider from '../src/integrations/ifood/IfoodFinancialProvider.js';
import keetaProvider from '../src/integrations/keeta/KeetaFinancialProvider.js';
import ninefoodProvider from '../src/integrations/ninefood/NineFoodFinancialProvider.js';

describe('providers dormentes', () => {
  it('isConfigured é false sem credenciais no env', () => {
    expect(ifoodProvider.isConfigured()).toBe(false);
    expect(keetaProvider.isConfigured()).toBe(false);
    expect(ninefoodProvider.isConfigured()).toBe(false);
  });

  it('sync retorna [] sem erro', async () => {
    expect(await ifoodProvider.syncFinancialData()).toEqual([]);
    expect(await ifoodProvider.syncSettlements()).toEqual([]);
  });

  it('buildAuthorizeUrl retorna null sem endpoints', () => {
    expect(ifoodProvider.buildAuthorizeUrl('state')).toBeNull();
  });
});
