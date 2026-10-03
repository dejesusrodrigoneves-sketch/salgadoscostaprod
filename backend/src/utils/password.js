const argon2 = require('@node-rs/argon2');

const ARGON2_PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

async function hashPassword(plain) { return argon2.hash(String(plain), ARGON2_PARAMS); }
async function verifyPassword(plain, phc) {
  if (!phc || typeof phc !== 'string') return false;
  try { return await argon2.verify(phc, String(plain)); } catch { return false; }
}

module.exports = { hashPassword, verifyPassword, ARGON2_PARAMS };
