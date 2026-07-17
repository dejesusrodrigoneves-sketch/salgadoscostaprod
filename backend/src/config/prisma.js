const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['warn', 'error'],
});
globalForPrisma.prisma = prisma;

// Ensure new columns exist on first cold start (safe, idempotent)
const ensureColumns = require('../../prisma/ensureColumns');
ensureColumns(prisma).catch(function(e) {
  console.warn('[ensureColumns] Aviso (nao fatal):', e.message);
});

module.exports = prisma;
