const prisma = require('../src/config/prisma');
(async () => {
  try {
    const cols = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'public_id'"
    );
    console.log('Coluna public_id:', cols.length > 0 ? 'EXISTE' : 'NAO EXISTE');
    const count = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int c FROM pedidos');
    console.log('Total pedidos:', count[0].c);
    const nulls = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int c FROM pedidos WHERE public_id IS NULL');
    console.log('Pedidos sem public_id:', nulls[0].c);
  } catch(e) {
    console.log('Erro:', e.message);
  }
  await prisma.$disconnect();
})();
