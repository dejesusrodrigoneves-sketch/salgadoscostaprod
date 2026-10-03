const nodeCrypto = require('node:crypto');
const { getCryptoKeys } = require('../config/cryptoKeys');

const FORMAT = 'v1';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

class CryptoIntegrityError extends Error {
  constructor(msg) { super(msg); this.name = 'CryptoIntegrityError'; this.http = 500; }
}
class CryptoConfigError extends Error {
  constructor(msg) { super(msg); this.name = 'CryptoConfigError'; this.http = 503; }
}
class CryptoUnavailableError extends Error {
  constructor(msg) { super(msg); this.name = 'CryptoUnavailableError'; this.http = 503; }
}

function keyFor(keyId) {
  const cfg = getCryptoKeys();
  const raw = cfg.encryptionKeys[keyId];
  if (!raw) throw new CryptoConfigError(`[crypto] keyId desconhecido: ${keyId}`);
  return nodeCrypto.createHash('sha256').update(raw).digest(); // 32 bytes
}

function aadOf({ model, field, scopeId }) {
  if (!model || !field) throw new CryptoConfigError('[crypto] model/field obrigatórios no AAD');
  return Buffer.from(`${FORMAT}|${model}|${field}|${scopeId ?? 'global'}`, 'utf8');
}

function encryptField(value, ctx) {
  const cfg = getCryptoKeys();
  const iv = nodeCrypto.randomBytes(IV_LENGTH);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyFor(cfg.activeKeyId), iv);
  cipher.setAAD(aadOf(ctx));
  const ct = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
  return `${FORMAT}|${cfg.activeKeyId}|${payload}`;
}

function decryptField(payload, ctx) {
  if (typeof payload !== 'string' || !payload.startsWith(`${FORMAT}|`)) {
    throw new CryptoIntegrityError('[crypto] payload malformado');
  }
  const [, keyId, b64] = payload.split('|');
  const key = keyFor(keyId); // valida keyId (CryptoConfigError) antes de checar tamanho
  const buf = Buffer.from(b64 || '', 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) throw new CryptoIntegrityError('[crypto] payload curto');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aadOf(ctx));
  decipher.setAuthTag(tag);
  try {
    return decipher.update(ct, undefined, 'utf8') + decipher.final('utf8');
  } catch (e) {
    throw new CryptoIntegrityError('[crypto] falha de autenticação (AAD/chave/dados)');
  }
}

function encryptWithLegacy(value) {
  const cfg = getCryptoKeys();
  if (!cfg.legacyAsaasKey) throw new CryptoConfigError('[crypto] LEGACY_ASAAS_SUBCONTA_KEY ausente');
  const key = nodeCrypto.createHash('sha256').update(cfg.legacyAsaasKey).digest();
  const iv = nodeCrypto.randomBytes(IV_LENGTH);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

function decryptLegacy(payload) {
  const cfg = getCryptoKeys();
  if (!cfg.legacyAsaasKey) throw new CryptoConfigError('[crypto] LEGACY_ASAAS_SUBCONTA_KEY ausente');
  const key = nodeCrypto.createHash('sha256').update(cfg.legacyAsaasKey).digest();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  try { return d.update(ct, undefined, 'utf8') + d.final('utf8'); }
  catch { throw new CryptoIntegrityError('[crypto] falha ao decifrar legado'); }
}

const isEncrypted = (v) => typeof v === 'string' && v.startsWith(`${FORMAT}|`);
const keyIdOf = (v) => (typeof v === 'string' && v.startsWith(`${FORMAT}|`) ? v.split('|')[1] : null);

module.exports = {
  encryptField, decryptField, encryptWithLegacy, decryptLegacy,
  isEncrypted, keyIdOf, aadOf,
  CryptoIntegrityError, CryptoConfigError, CryptoUnavailableError,
  // retrocompatibilidade temporária (Tasks 8/12 migram os chamadores)
  encrypt: encryptWithLegacy, decrypt: decryptLegacy,
};
