
ALTER TABLE "clientes" ADD COLUMN     "cep_enc" TEXT,
ADD COLUMN     "endereco_enc" TEXT,
ADD COLUMN     "numero_enc" TEXT,
ADD COLUMN     "ponto_referencia_enc" TEXT,
ADD COLUMN     "telefone_bidx" TEXT,
ADD COLUMN     "telefone_bidx_key_ver" TEXT,
ADD COLUMN     "telefone_enc" TEXT;

ALTER TABLE "empresas" ADD COLUMN     "cpf_cnpj_enc" TEXT,
ADD COLUMN     "email_bidx" TEXT,
ADD COLUMN     "pix_key_enc" TEXT;

ALTER TABLE "entregadores" ADD COLUMN     "chave_pix_enc" TEXT,
ADD COLUMN     "endereco_enc" TEXT,
ADD COLUMN     "fcm_token_enc" TEXT,
ADD COLUMN     "telefone_bidx" TEXT,
ADD COLUMN     "telefone_bidx_key_ver" TEXT,
ADD COLUMN     "telefone_enc" TEXT,
ADD COLUMN     "whatsapp_enc" TEXT;

ALTER TABLE "login_logs" ADD COLUMN     "ip_enc" TEXT;

ALTER TABLE "pedidos" ADD COLUMN     "cliente_endereco_enc" TEXT,
ADD COLUMN     "cliente_nome_enc" TEXT,
ADD COLUMN     "cliente_numero_enc" TEXT,
ADD COLUMN     "cliente_whatsapp_bidx" TEXT,
ADD COLUMN     "cliente_whatsapp_bidx_key_ver" TEXT,
ADD COLUMN     "cliente_whatsapp_enc" TEXT;

ALTER TABLE "termo_consent" ADD COLUMN     "ip_enc" TEXT;

ALTER TABLE "usuarios" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "whatsapp_instances" ADD COLUMN     "qr_code_enc" TEXT;

-- CreateTable
CREATE TABLE "cliente_otp" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_flags" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_flags_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "cliente_otp_empresa_id_cliente_id_idx" ON "cliente_otp"("empresa_id", "cliente_id");

-- CreateIndex
CREATE INDEX "cliente_otp_expires_at_idx" ON "cliente_otp"("expires_at");

