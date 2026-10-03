// Verifica cobertura do backfill (Task 12)
require('dotenv').config();
require('../src/config/cryptoKeys').validateAtBoot();
const prisma = require('../src/config/prisma');
const { mapClienteOut } = require('../src/repositories/piiRepository');

(async () => {
  const total = await prisma.cliente.count();
  const enc = await prisma.cliente.count({ where: { NOT: { telefoneEnc: null } } });
  const sample = await prisma.cliente.findFirst({ where: { NOT: { telefoneEnc: null } } });
  if (sample) mapClienteOut(sample); // lança se não decifrar
  console.log(`[verify] clientes=${total} cifrados=${enc}`);
  if (total !== enc) { console.error('[verify] FALHA: cobertura incompleta'); process.exit(1); }
  await prisma.$disconnect();
})();
