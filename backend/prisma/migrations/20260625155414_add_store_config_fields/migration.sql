-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "telefone" TEXT;
