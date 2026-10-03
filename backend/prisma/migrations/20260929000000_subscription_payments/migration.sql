-- CreateTable: subscription_payments (extrato de mensalidades)
CREATE TABLE "subscription_payments" (
  "id" SERIAL NOT NULL,
  "empresa_id" INTEGER NOT NULL,
  "mes_ref" TEXT NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "base" DECIMAL(10,2) NOT NULL,
  "interest" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "asaas_payment_id" TEXT,
  "paid_at" TIMESTAMP(3),
  "receipt_path" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_empresa_id_mes_ref_key" ON "subscription_payments"("empresa_id", "mes_ref");
CREATE UNIQUE INDEX "subscription_payments_asaas_payment_id_key" ON "subscription_payments"("asaas_payment_id");
CREATE INDEX "subscription_payments_empresa_id_status_idx" ON "subscription_payments"("empresa_id", "status");

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
