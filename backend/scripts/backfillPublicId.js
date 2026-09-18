const prisma = require('../src/config/prisma');

(async () => {
  const n = await prisma.$executeRawUnsafe(
    `UPDATE pedidos SET public_id = gen_random_uuid()::text WHERE public_id IS NULL`
  );
  console.log('Backfilled', n);
  await prisma.$disconnect();
})();
