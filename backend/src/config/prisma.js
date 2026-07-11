const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['warn', 'error'],
});
globalForPrisma.prisma = prisma;

module.exports = prisma;
