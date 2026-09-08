import { registerProvider } from './core/registry.js';
import saasProvider from './saas/SaasFinancialProvider.js';
import ifoodProvider from './ifood/IfoodFinancialProvider.js';
import keetaProvider from './keeta/KeetaFinancialProvider.js';
import ninefoodProvider from './99food/99FoodFinancialProvider.js';

export function registerAllProviders() {
  [saasProvider, ifoodProvider, keetaProvider, ninefoodProvider].forEach(registerProvider);
}

export default { registerAllProviders };
