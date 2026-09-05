-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "request_id" TEXT NOT NULL,
    "session_id" TEXT,
    "empresa_id" INTEGER NOT NULL DEFAULT 1,
    "actor_type" TEXT NOT NULL DEFAULT 'admin',
    "actor_id" INTEGER,
    "actor_username" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "changed_fields" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "reason" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_empresa_id_action_idx" ON "audit_logs"("empresa_id", "action");

-- CreateIndex
CREATE INDEX "audit_logs_empresa_id_actor_id_criado_em_idx" ON "audit_logs"("empresa_id", "actor_id", "criado_em");

-- CreateIndex
CREATE INDEX "audit_logs_empresa_id_criado_em_idx" ON "audit_logs"("empresa_id", "criado_em");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateTable
CREATE TABLE "app_logs" (
    "id" BIGSERIAL NOT NULL,
    "request_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "module" TEXT,
    "stack" TEXT,
    "meta" JSONB,
    "empresa_id" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_logs_empresa_id_level_criado_em_idx" ON "app_logs"("empresa_id", "level", "criado_em");

-- CreateIndex
CREATE INDEX "app_logs_request_id_idx" ON "app_logs"("request_id");
