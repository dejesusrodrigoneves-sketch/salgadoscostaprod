// Reset/bootstrap de hashes para Argon2id (Task 8 do plano de proteção de dados)
// Uso: ADMIN_BOOTSTRAP_PASSWORD='...' node scripts/seedAdminArgon2.js
require('dotenv').config();
require('../src/config/cryptoKeys').validateAtBoot();
const { hashPassword } = require('../src/utils/password');
const prisma = require('../src/config/prisma');

async function buildAdminHash(pw) { return hashPassword(pw); }

async function main() {
  const pw = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!pw) throw new Error('Defina ADMIN_BOOTSTRAP_PASSWORD');
  const hash = await buildAdminHash(pw);
  const usuarios = await prisma.usuario.findMany({ where: { role: { in: ['admin', 'superadmin'] } } });
  for (const u of usuarios) {
    await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: hash, mustChangePassword: true } });
  }
  await prisma.cliente.updateMany({ data: { passwordHash: null } });         // O1=b: primeiro acesso
  await prisma.entregador.updateMany({ data: { passwordHash: null, mustChangePassword: true } });
  console.log(`[seedArgon2] usuarios=${usuarios.length} clientes/entregadores resetados`);
  await prisma.$disconnect();
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { buildAdminHash };
