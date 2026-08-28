import prisma from '../config/prisma.js';
import auditService from './auditService.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { generateNonce } from '../integrations/core/oauthClient.js';
import { getProvider } from '../integrations/core/registry.js';
import { CONNECTION_STATUS } from '../integrations/core/types.js';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function iniciarConexao(empresaId, usuarioId, platform) {
  const provider = getProvider(platform);
  if (!provider || !provider.isConfigured()) {
    throw Object.assign(new Error('Integração não configurada'), { status: 503 });
  }
  const nonce = generateNonce();
  await prisma.oAuthState.create({
    data: { nonce, empresaId, usuarioId, platform, expiresAt: new Date(Date.now() + STATE_TTL_MS) },
  });
  const url = provider.buildAuthorizeUrl(nonce);
  if (!url) throw Object.assign(new Error('Integração não configurada'), { status: 503 });
  return { url };
}

export async function processarCallback(platform, code, stateNonce) {
  if (!stateNonce) throw Object.assign(new Error('state ausente'), { status: 400 });
  const st = await prisma.oAuthState.findUnique({ where: { nonce: stateNonce } });
  if (!st) throw Object.assign(new Error('state inválido'), { status: 400 });
  if (st.usedAt) throw Object.assign(new Error('state já utilizado'), { status: 400 });
  if (st.expiresAt.getTime() < Date.now()) throw Object.assign(new Error('state expirado'), { status: 400 });
  if (st.platform !== platform) throw Object.assign(new Error('state de plataforma incorreta'), { status: 403 });
  if (!code) throw Object.assign(new Error('code ausente'), { status: 400 });

  await prisma.oAuthState.update({ where: { nonce: stateNonce }, data: { usedAt: new Date() } });

  const provider = getProvider(platform);
  if (!provider || !provider.isConfigured()) {
    throw Object.assign(new Error('Integração não configurada'), { status: 503 });
  }
  const tokens = await provider.exchangeCode(code);
  const accessTokenEnc = tokens.accessToken ? encrypt(tokens.accessToken) : null;
  const refreshTokenEnc = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;
  const tokenExpiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null;

  await prisma.platformConnection.upsert({
    where: { empresaId_platform: { empresaId: st.empresaId, platform } },
    update: { status: CONNECTION_STATUS.CONNECTED, externalAccountId: tokens.externalAccountId, accessTokenEnc, refreshTokenEnc, tokenExpiresAt, lastError: null },
    create: { empresaId: st.empresaId, platform, status: CONNECTION_STATUS.CONNECTED, externalAccountId: tokens.externalAccountId, accessTokenEnc, refreshTokenEnc, tokenExpiresAt },
  });

  auditService.audit({
    action: 'financial.integration.connected',
    module: 'financeiro',
    actorType: 'admin',
    actorId: st.usuarioId,
    targetType: 'platform_connection',
    targetId: `${st.empresaId}:${platform}`,
    after: { empresaId: st.empresaId, platform },
    severity: 'info',
  });

  return { empresaId: st.empresaId };
}

export async function desconectar(empresaId, platform) {
  const provider = getProvider(platform);
  const connection = await prisma.platformConnection.findUnique({
    where: { empresaId_platform: { empresaId, platform } },
  });
  if (!connection) throw Object.assign(new Error('Conexão não encontrada'), { status: 404 });

  if (provider && provider.isConfigured() && connection.accessTokenEnc) {
    try {
      await provider.revoke(decrypt(connection.accessTokenEnc));
    } catch (e) { /* best-effort */ }
  }
  await prisma.platformConnection.update({
    where: { empresaId_platform: { empresaId, platform } },
    data: { status: CONNECTION_STATUS.DISCONNECTED, accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null },
  });
  auditService.audit({
    action: 'financial.integration.disconnected',
    module: 'financeiro',
    actorType: 'admin',
    targetType: 'platform_connection',
    targetId: `${empresaId}:${platform}`,
    severity: 'info',
  });
  return { success: true };
}

export async function listarIntegracoes(empresaId) {
  const platforms = ['IFOOD', 'KEETA', 'NINEFOOD'];
  const connections = await prisma.platformConnection.findMany({ where: { empresaId } });
  const byPlatform = new Map(connections.map(c => [c.platform, c]));
  return platforms.map(platform => {
    const provider = getProvider(platform);
    const configured = Boolean(provider && provider.isConfigured());
    const conn = byPlatform.get(platform);
    return {
      platform,
      configured,
      status: conn ? conn.status : 'NOT_CONNECTED',
      externalAccountId: conn ? conn.externalAccountId : null,
      lastSyncAt: conn ? conn.lastSyncAt : null,
      lastError: conn ? conn.lastError : null,
    };
  });
}

export async function statusGlobal() {
  const platforms = ['IFOOD', 'KEETA', 'NINEFOOD'];
  const grupos = await prisma.platformConnection.groupBy({
    by: ['platform', 'status'],
    _count: { _all: true },
  });
  return platforms.map(platform => {
    const provider = getProvider(platform);
    const configured = Boolean(provider && provider.isConfigured());
    const rows = grupos.filter(g => g.platform === platform);
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    const comErro = rows.filter(r => r.status === 'ERROR' || r.status === 'TOKEN_EXPIRED').reduce((s, r) => s + r._count._all, 0);
    return { platform, configured, empresasConectadas: total, comErro };
  });
}

export async function statusPlataforma(platform) {
  const provider = getProvider(platform);
  const connections = await prisma.platformConnection.findMany({ where: { platform } });
  return {
    platform,
    configured: Boolean(provider && provider.isConfigured()),
    empresasConectadas: connections.length,
    comErro: connections.filter(c => c.status === 'ERROR' || c.status === 'TOKEN_EXPIRED').length,
    ultimaSync: connections.map(c => c.lastSyncAt).sort((a, b) => (b ? b.getTime() : 0) - (a ? a.getTime() : 0))[0] || null,
  };
}

export async function handleWebhook(platform, payload) {
  const provider = getProvider(platform);
  if (!provider || !provider.isConfigured()) return false;
  // idempotência via unique(platform, externalEventId)
  const externalEventId = payload?.id || payload?.eventId || payload?.externalId;
  if (!externalEventId) return true;
  await prisma.webhookEvent.upsert({
    where: { platform_externalEventId: { platform, externalEventId: String(externalEventId) } },
    update: {},
    create: { empresaId: payload?.empresaId || 1, platform, externalEventId: String(externalEventId), eventType: payload?.type || 'unknown' },
  });
  try {
    await provider.handleWebhook(payload);
    await prisma.webhookEvent.update({ where: { platform_externalEventId: { platform, externalEventId: String(externalEventId) } }, data: { status: 'PROCESSED', processedAt: new Date() } });
  } catch (err) {
    await prisma.webhookEvent.update({ where: { platform_externalEventId: { platform, externalEventId: String(externalEventId) } }, data: { status: 'FAILED', error: err.message } });
  }
  return true;
}

export default { iniciarConexao, processarCallback, desconectar, listarIntegracoes, statusGlobal, statusPlataforma, handleWebhook };
