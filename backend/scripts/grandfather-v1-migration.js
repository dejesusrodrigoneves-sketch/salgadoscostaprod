// backend/scripts/grandfather-v1-migration.js (CJS)
// Script de grandfather — cria PricingFilialConfig v1 inicial
// Uso: node scripts/grandfather-v1-migration.js
// Requer DATABASE_URL configurada
const prisma = require('../src/config/prisma.js');

async function main() {
  console.log('[Grandfather V1] Creating initial PricingFilialConfig...');

  const existing = await prisma.pricingFilialConfig.findFirst({
    where: { versao: 1 }
  });

  if (existing) {
    console.log('[Grandfather V1] V1 already exists, skipping...');
    return;
  }

  const config = await prisma.pricingFilialConfig.create({
    data: {
      versao: 1,
      valorX: 20, // Replace with actual value
      effectiveDate: new Date(),
      status: 'ACTIVE',
      createdById: 1, // Superadmin ID
      appliedAt: new Date(),
      settlementCompletedAt: new Date()
    }
  });

  console.log('[Grandfather V1] Created:', config);
  console.log('[Grandfather V1] IMPORTANT: Do NOT create TermoConsent in bulk');
  console.log('[Grandfather V1] IMPORTANT: Do NOT open overlay for v1');
  console.log('[Grandfather V1] IMPORTANT: Do NOT suspend filiais');
  console.log('[Grandfather V1] IMPORTANT: NENHUM lojista verá overlay até v2 ser criada.');
  console.log('[Grandfather V1] IMPORTANT: Quando v2 for criada, overlay aparecerá PELA PRIMEIRA VEZ (transição v1→v2).');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());