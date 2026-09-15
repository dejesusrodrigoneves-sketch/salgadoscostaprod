const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
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
