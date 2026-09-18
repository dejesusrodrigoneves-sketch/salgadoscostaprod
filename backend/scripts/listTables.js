const prisma = require('../src/config/prisma');
(async () => {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log('Tabelas no DB:');
  tables.forEach(t => console.log(' -', t.tablename));
  console.log('\nTotal:', tables.length);
  await prisma.$disconnect();
})();
