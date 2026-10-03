require('dotenv').config();
require('../src/config/cryptoKeys').validateAtBoot();
const prisma = require('../src/config/prisma');
const flags = require('../src/repositories/systemFlagsRepository');

const LOCK_KEY = 987654321;

// xact_lock numa tx única: libera sozinho no fim (pool do Prisma pode trocar
// conexão entre lock/unlock soltos → lock órfão)
async function withAdvisoryLock(fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', LOCK_KEY);
    return fn();
  });
}

async function rotation(on) {
  await flags.setFlag('rotation_in_progress', on ? '1' : '0');
}

async function rotateEncryption({ toKeyId }) {
  return withAdvisoryLock(async () => {
    await rotation(true);
    try {
      await flags.setFlag('active_key_id', toKeyId);
      // re-encrypt: node scripts/encryptBackfill.js --apply (com ENCRYPTION_ACTIVE_KEY_ID=<toKeyId> no env)
      console.log(`[rotate] active_key_id=${toKeyId} — executar encryptBackfill --apply para re-cifrar`);
    } finally {
      await rotation(false);
    }
  });
}

async function rotateBidx({ toVersion }) {
  return withAdvisoryLock(async () => {
    await rotation(true);
    try {
      await flags.setFlag('active_bidx_version', toVersion);
      // re-index: re-calcular bidx (com BLIND_INDEX_ACTIVE_VERSION=<toVersion> no env) + rodar verifyEncryptionState
      console.log(`[rotate] active_bidx_version=${toVersion} — executar backfill de bidx para re-indexar`);
    } finally {
      await rotation(false);
    }
  });
}

if (require.main === module) {
  const [cmd, value] = process.argv.slice(2);
  const run = cmd === 'bidx'
    ? rotateBidx({ toVersion: value })
    : rotateEncryption({ toKeyId: value });
  run
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { rotateEncryption, rotateBidx, withAdvisoryLock, rotation };
