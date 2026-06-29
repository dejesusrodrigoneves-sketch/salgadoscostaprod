-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "closing_time" TEXT,
ADD COLUMN     "is_open" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manual_override" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opening_time" TEXT,
ADD COLUMN     "working_days" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
CREATE SEQUENCE produtos_id_seq;
ALTER TABLE "produtos" ADD COLUMN     "category_id" INTEGER,
ADD COLUMN     "hide_when_out_of_stock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_price" DECIMAL(10,2),
ALTER COLUMN "id" SET DEFAULT nextval('produtos_id_seq');
ALTER SEQUENCE produtos_id_seq OWNED BY "produtos"."id";

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "type" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_instances" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "instance_id" TEXT NOT NULL,
    "connection_status" TEXT NOT NULL DEFAULT 'disconnected',
    "phone_number" TEXT,
    "qr_code" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_empresa_id_nome_key" ON "categorias"("empresa_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instances_empresa_id_instance_id_key" ON "whatsapp_instances"("empresa_id", "instance_id");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
