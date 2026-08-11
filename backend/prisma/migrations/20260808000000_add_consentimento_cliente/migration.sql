-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "consentimento_em" TIMESTAMP(3),
ADD COLUMN     "consentimento_revogado_em" TIMESTAMP(3),
ADD COLUMN     "politica_versao" TEXT;