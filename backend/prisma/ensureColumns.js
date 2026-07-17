async function ensureColumns(prisma) {
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS empresas ADD COLUMN IF NOT EXISTS capa TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS empresas ADD COLUMN IF NOT EXISTS bairros_atendidos JSONB NOT NULL DEFAULT \'[]\'');
}

module.exports = ensureColumns;
