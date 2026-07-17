const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['warn', 'error'],
});
globalForPrisma.prisma = prisma;

const ensureColumns = require('../../prisma/ensureColumns');

// Ensure columns exist before first query (blocks any query until done)
globalForPrisma.columnsReady = globalForPrisma.columnsReady || ensureColumns(prisma).catch(function(e) {
  console.warn('[ensureColumns] Aviso (nao fatal):', e.message);
});

prisma.$use(async function(params, next) {
  await globalForPrisma.columnsReady;
  return next(params);
});

module.exports = prisma;
