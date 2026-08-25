const crypto = require('node:crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'base64';

function getKey() {
  const raw = env.asaasSubcontaKey;
  if (!raw) throw new Error('ASAAS_SUBCONTA_KEY not configured');
  // Hash to 32 bytes for AES-256
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64 string: iv (12) + authTag (16) + ciphertext
 */
function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString(ENCODING);
}

/**
 * Decrypt base64 string produced by encrypt().
 */
function decrypt(encrypted) {
  const key = getKey();
  const buf = Buffer.from(encrypted, ENCODING);
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
