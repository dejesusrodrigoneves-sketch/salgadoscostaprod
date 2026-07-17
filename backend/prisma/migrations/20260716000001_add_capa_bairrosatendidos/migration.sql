-- AlterTable
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "capa" TEXT;
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "bairros_atendidos" JSONB NOT NULL DEFAULT '[]';
