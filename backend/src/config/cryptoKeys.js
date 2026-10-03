const MIN_BYTES = 32;

function parseMap(raw, name) {
  let obj;
  try { obj = JSON.parse(raw || '{}'); }
  catch { throw new Error(`[cryptoKeys] ${name} não é JSON válido`); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error(`[cryptoKeys] ${name} deve ser objeto JSON`);
  }
  for (const [id, val] of Object.entries(obj)) {
    if (typeof val !== 'string' || Buffer.byteLength(val, 'utf8') < MIN_BYTES) {
      throw new Error(`[cryptoKeys] ${name}.${id} precisa de >= 32 bytes`);
    }
  }
  return obj;
}

function loadCryptoKeys(env = process.env) {
  const encryptionKeys = parseMap(env.ENCRYPTION_KEYS, 'ENCRYPTION_KEYS');
  const activeKeyId = env.ENCRYPTION_ACTIVE_KEY_ID;
  if (!activeKeyId || !encryptionKeys[activeKeyId]) {
    throw new Error('[cryptoKeys] ENCRYPTION_ACTIVE_KEY_ID ausente no ENCRYPTION_KEYS');
  }
  const bidxKeys = parseMap(env.BLIND_INDEX_KEYS, 'BLIND_INDEX_KEYS');
  const activeBidxVersion = env.BLIND_INDEX_ACTIVE_VERSION;
  if (!activeBidxVersion || !bidxKeys[activeBidxVersion]) {
    throw new Error('[cryptoKeys] BLIND_INDEX_ACTIVE_VERSION ausente no BLIND_INDEX_KEYS');
  }
  return {
    encryptionKeys, activeKeyId, bidxKeys, activeBidxVersion,
    legacyAsaasKey: env.LEGACY_ASAAS_SUBCONTA_KEY || null,
  };
}

let cached = null;
function getCryptoKeys() { if (!cached) cached = loadCryptoKeys(); return cached; }
function resetCryptoKeysCache() { cached = null; }

function validateAtBoot() {
  const cfg = getCryptoKeys();
  // self-test: roundtrip AES + determinismo HMAC
  const crypto = require('node:crypto');
  const key = crypto.createHash('sha256').update(cfg.encryptionKeys[cfg.activeKeyId]).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from('v1|Selftest|x|global', 'utf8'));
  const ct = Buffer.concat([c.update('ok', 'utf8'), c.final()]);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAAD(Buffer.from('v1|Selftest|x|global', 'utf8'));
  d.setAuthTag(c.getAuthTag());
  const out = d.update(ct, undefined, 'utf8') + d.final('utf8');
  if (out !== 'ok') throw new Error('[cryptoKeys] self-test AES falhou');
  console.log(`[cryptoKeys] OK active=${cfg.activeKeyId} bidx=${cfg.activeBidxVersion}`);
}

module.exports = { loadCryptoKeys, getCryptoKeys, resetCryptoKeysCache, validateAtBoot };
