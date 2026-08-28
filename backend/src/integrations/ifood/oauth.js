import env from '../../config/env.js';
import { buildAuthorizeUrl, exchangeCode, refreshToken, revokeToken } from '../core/oauthClient.js';

function redirectUri() {
  return `${env.oauthRedirectBase}/api/financeiro/integrations/IFOOD/callback`;
}

export function authorizeUrl(state) {
  return buildAuthorizeUrl({ authorizeUrl: env.ifoodAuthorizeUrl, clientId: env.ifoodClientId, redirectUri: redirectUri(), state, scope: env.ifoodScope || null });
}
export function exchange(code) {
  return exchangeCode({ tokenUrl: env.ifoodTokenUrl, clientId: env.ifoodClientId, clientSecret: env.ifoodClientSecret, redirectUri: redirectUri(), code });
}
export function refresh(rt) {
  return refreshToken({ tokenUrl: env.ifoodTokenUrl, clientId: env.ifoodClientId, clientSecret: env.ifoodClientSecret, refreshToken: rt });
}
export function revoke(at) {
  return revokeToken({ revokeUrl: env.ifoodRevokeUrl || null, token: at });
}
