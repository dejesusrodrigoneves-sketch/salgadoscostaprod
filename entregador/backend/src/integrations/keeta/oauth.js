import env from '../../config/env.js';
import { buildAuthorizeUrl, exchangeCode, refreshToken, revokeToken } from '../core/oauthClient.js';

function redirectUri() {
  return `${env.oauthRedirectBase}/api/financeiro/integrations/KEETA/callback`;
}
export function authorizeUrl(state) {
  return buildAuthorizeUrl({ authorizeUrl: env.keetaAuthorizeUrl, clientId: env.keetaClientId, redirectUri: redirectUri(), state, scope: env.keetaScope || null });
}
export function exchange(code) {
  return exchangeCode({ tokenUrl: env.keetaTokenUrl, clientId: env.keetaClientId, clientSecret: env.keetaClientSecret, redirectUri: redirectUri(), code });
}
export function refresh(rt) {
  return refreshToken({ tokenUrl: env.keetaTokenUrl, clientId: env.keetaClientId, clientSecret: env.keetaClientSecret, refreshToken: rt });
}
export function revoke(at) {
  return revokeToken({ revokeUrl: env.keetaRevokeUrl || null, token: at });
}
