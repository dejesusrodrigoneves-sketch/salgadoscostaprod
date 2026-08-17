async function ensureColumns(prisma) {
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS empresas ADD COLUMN IF NOT EXISTS capa TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS empresas ADD COLUMN IF NOT EXISTS bairros_atendidos JSONB NOT NULL DEFAULT \'[]\'');
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS produtos ADD COLUMN IF NOT EXISTS config JSONB');

  // PIX via Asaas
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "pagamentos" ("id" SERIAL PRIMARY KEY, "pedido_id" TEXT NOT NULL, "empresa_id" INTEGER NOT NULL, "asaas_payment_id" TEXT NOT NULL UNIQUE, "asaas_customer_id" TEXT, "metodo" TEXT NOT NULL DEFAULT \'pix\', "valor" DECIMAL(10,2) NOT NULL, "pix_code" TEXT, "pix_qr_code" TEXT, "status" TEXT NOT NULL DEFAULT \'aguardando_pagamento\', "expira_em" TIMESTAMPTZ, "pago_em" TIMESTAMPTZ, "rejeitado_em" TIMESTAMPTZ, "refund_id" TEXT, "refund_status" TEXT, "refund_reason" TEXT, "refundado_em" TIMESTAMPTZ, "criado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "pagamentos_pedido_id_idx" ON "pagamentos" ("pedido_id")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "pagamentos_empresa_status_idx" ON "pagamentos" ("empresa_id", "status")');
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "processed_webhooks" ("event_id" TEXT PRIMARY KEY, "criado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS "pedidos" ADD COLUMN IF NOT EXISTS "payment_status" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS "pedidos" ADD COLUMN IF NOT EXISTS "payment_method" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS "pedidos" ADD COLUMN IF NOT EXISTS "payment_id" INTEGER');
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS "clientes" ADD COLUMN IF NOT EXISTS "asaas_customer_id" TEXT');
}

module.exports = ensureColumns;
