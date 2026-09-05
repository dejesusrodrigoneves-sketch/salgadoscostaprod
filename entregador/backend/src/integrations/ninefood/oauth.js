import env from '../../config/env.js';
import { buildAuthorizeUrl, exchangeCode, refreshToken, revokeToken } from '../core/oauthClient.js';

function redirectUri() {
  return `${env.oauthRedirectBase}/api/financeiro/integrations/NINEFOOD/callback`;
}
export function authorizeUrl(state) {
  return buildAuthorizeUrl({ authorizeUrl: env.ninefoodAuthorizeUrl, clientId: env.ninefoodClientId, redirectUri: redirectUri(), state, scope: env.ninefoodScope || null });
}
export function exchange(code) {
  return exchangeCode({ tokenUrl: env.ninefoodTokenUrl, clientId: env.ninefoodClientId, clientSecret: env.ninefoodClientSecret, redirectUri: redirectUri(), code });
}
export function refresh(rt) {
  return refreshToken({ tokenUrl: env.ninefoodTokenUrl, clientId: env.ninefoodClientId, clientSecret: env.ninefoodClientSecret, refreshToken: rt });
}
export function revoke(at) {
  return revokeToken({ revokeUrl: env.ninefoodRevokeUrl || null, token: at });
}
