// Script de seed — cria dados iniciais
// Uso: node scripts/seed.js
// Requer DATABASE_URL configurada

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Criando empresa padrão...');
  const empresa = await prisma.empresa.upsert({
    where: { slug: 'salgadoscosta' },
    update: {},
    create: { nome: 'Fábrica de Salgados Costa', slug: 'salgadoscosta' },
  });

  console.log('Criando superadmin...');
  const senha = process.env.SUPERADMIN_PASSWORD || 'tsa110594';
  const hash = await bcrypt.hash(senha, 10);
  await prisma.usuario.upsert({
    where: { empresaId_username: { empresaId: empresa.id, username: 'djesus' } },
    update: {},
    create: { empresaId: empresa.id, username: 'djesus', passwordHash: hash, role: 'superadmin', lojaNome: 'Administrador' },
  });

  console.log('Seed concluído!');
  console.log(`  Empresa: ${empresa.nome} (slug: ${empresa.slug})`);
  console.log('  Usuário: djesus / senha via SUPERADMIN_PASSWORD ou fallback (role: superadmin)');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
