import { describe, it, expect, beforeEach } from 'vitest';

// Override env before importing crypto
process.env.ASAAS_SUBCONTA_KEY = 'test-secret-key-for-unit-tests';

const { encrypt, decrypt } = require('../src/utils/crypto.js');

describe('crypto', () => {
  it('encrypts and decrypts round-trips', () => {
    const plaintext = 'sk_live_abc123xyz';
    const enc = encrypt(plaintext);
    expect(typeof enc).toBe('string');
    expect(enc).not.toBe(plaintext);
    expect(decrypt(enc)).toBe(plaintext);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const enc1 = encrypt('hello');
    const enc2 = encrypt('hello');
    expect(enc1).not.toBe(enc2); // different IVs → different ciphertext
  });

  it('decrypts empty string', () => {
    const enc = encrypt('');
    expect(decrypt(enc)).toBe('');
  });

  it('decrypts unicode', () => {
    const text = 'UTF-8 café résumé 中文';
    expect(decrypt(encrypt(text))).toBe(text);
  });

  // NOTE: getKey() throw path not tested here because env.js captures
  // ASAAS_SUBCONTA_KEY at require-time. Testing the throw requires a
  // fresh module load with env unset, which needs module isolation
  // (e.g. dynamic import with env manipulation or a dedicated test file).

  it('throws on tampered ciphertext', () => {
    const enc = encrypt('secret');
    const tampered = enc.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered)).toThrow();
  });
});
