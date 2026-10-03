const { PrismaClient } = require('@prisma/client');

function withPoolParams(url) {
  if (!url) return url;
  const limit = process.env.DB_CONNECTION_LIMIT || '5';
  const timeout = process.env.DB_POOL_TIMEOUT || '20';
  const u = new URL(url);
  if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', limit);
  if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', timeout);
  return u.toString();
}

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
  datasources: {
    db: {
      url: withPoolParams(process.env.DATABASE_URL),
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
