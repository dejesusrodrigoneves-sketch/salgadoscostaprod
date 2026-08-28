import env from '../../config/env.js';
import { PLATFORMS } from '../core/types.js';
import { authorizeUrl, exchange, refresh, revoke } from './oauth.js';

const ninefoodProvider = {
  platform: PLATFORMS.NINEFOOD,
  isConfigured() {
    return Boolean(env.ninefoodClientId && env.ninefoodClientSecret && env.ninefoodAuthorizeUrl && env.ninefoodTokenUrl);
  },
  buildAuthorizeUrl(state) { return authorizeUrl(state); },
  exchangeCode(code) { return exchange(code); },
  refreshToken(rt) { return refresh(rt); },
  revoke(at) { return revoke(at); },
  async syncFinancialData() { return []; },
  async syncSettlements() { return []; },
  async handleWebhook() { return; },
};

export default ninefoodProvider;
