-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "public_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_public_id_key" ON "pedidos"("public_id");
