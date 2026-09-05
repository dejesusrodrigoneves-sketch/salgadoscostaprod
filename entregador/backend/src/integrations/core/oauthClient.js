import crypto from 'node:crypto';

export function buildAuthorizeUrl({ authorizeUrl, clientId, redirectUri, state, scope }) {
  if (!authorizeUrl || !clientId || !redirectUri || !state) return null;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  if (scope) params.set('scope', scope);
  return `${authorizeUrl}?${params.toString()}`;
}

export async function exchangeCode({ tokenUrl, clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw Object.assign(new Error(`token exchange failed: ${res.status}`), { status: 502 });
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || null,
    externalAccountId: data.merchant_id || data.account_id || data.user_id || null,
  };
}

export async function refreshToken({ tokenUrl, clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw Object.assign(new Error(`refresh failed: ${res.status}`), { status: 502 });
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || null,
  };
}

export async function revokeToken({ revokeUrl, token }) {
  if (!revokeUrl) return;
  const body = new URLSearchParams({ token });
  await fetch(revokeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

export function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

export default { buildAuthorizeUrl, exchangeCode, refreshToken, revokeToken, generateNonce };
