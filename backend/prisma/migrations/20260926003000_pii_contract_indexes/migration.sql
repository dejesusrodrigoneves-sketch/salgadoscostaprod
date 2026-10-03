-- PII contract (aditivo) — Task 13
-- DROP de colunas claras + WeeklySettlement.asaas_transfer_id DEFERIDO (pendente aprovação)
-- AlterTable

-- CreateIndex
CREATE INDEX "clientes_empresa_id_telefone_bidx_key_ver_telefone_bidx_idx" ON "clientes"("empresa_id", "telefone_bidx_key_ver", "telefone_bidx");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_empresa_id_telefone_bidx_key" ON "clientes"("empresa_id", "telefone_bidx");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_email_bidx_key" ON "empresas"("email_bidx");

-- CreateIndex
CREATE INDEX "entregadores_empresa_id_telefone_bidx_key_ver_telefone_bidx_idx" ON "entregadores"("empresa_id", "telefone_bidx_key_ver", "telefone_bidx");

-- CreateIndex
CREATE UNIQUE INDEX "entregadores_empresa_id_telefone_bidx_key" ON "entregadores"("empresa_id", "telefone_bidx");

-- CreateIndex
CREATE INDEX "pedidos_empresa_id_cliente_whatsapp_bidx_key_ver_cliente_wh_idx" ON "pedidos"("empresa_id", "cliente_whatsapp_bidx_key_ver", "cliente_whatsapp_bidx");

