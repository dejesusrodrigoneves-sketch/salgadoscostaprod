const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Log pool warnings and errors
if (!globalForPrisma.prisma) {
  prisma.$on('warn', (e) => {
    console.warn('[Prisma] warn:', e.message);
  });
  prisma.$on('error', (e) => {
    console.error('[Prisma] error:', e.message);
  });
}

globalForPrisma.prisma = prisma;

module.exports = prisma;
