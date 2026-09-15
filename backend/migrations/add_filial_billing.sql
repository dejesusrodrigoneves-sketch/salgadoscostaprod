-- backend/migrations/add_filial_billing.sql
-- Filial billing consent: suspensão por pendência de aceite de reajuste (X) + outbox Asaas
-- Aplicado via `prisma db push`; arquivado aqui para reprodução/auditoria.
-- Additive-only: nenhum drop/alter destrutivo.

-- 1) Colunas de suspensão em empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS suspended_by_pricing_version INTEGER;

-- 2) Config de reajuste por filial (X)
CREATE TABLE IF NOT EXISTS pricing_filial_configs (
  id SERIAL PRIMARY KEY,
  versao INTEGER NOT NULL,
  valor_x DECIMAL(10,2) NOT NULL,
  effective_date TIMESTAMP(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_by_id INTEGER NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP(3) NOT NULL,
  applied_at TIMESTAMP(3),
  cancelled_at TIMESTAMP(3),
  settlement_completed_at TIMESTAMP(3),
  termos_texto TEXT
);

-- 3) Termo de consentimento (aceite/rejeição do reajuste)
CREATE TABLE IF NOT EXISTS termo_consent (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  filial_id INTEGER,
  pricing_filial_config_id INTEGER,
  tipo TEXT NOT NULL,
  valor_filial_x DECIMAL(10,2),
  valor_mensalidade DECIMAL(10,2),
  n_filiais_snapshot INTEGER,
  valor_total_projetado DECIMAL(10,2),
  status TEXT NOT NULL,
  termos_versao INTEGER,
  termos_texto TEXT,
  termos_copy_id TEXT,
  usuario_id INTEGER,
  ip TEXT,
  user_agent TEXT,
  request_id TEXT,
  agreed_at TIMESTAMP(3),
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4) Snapshot de billing por empresa/versão
CREATE TABLE IF NOT EXISTS billing_snapshots (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  pricing_version INTEGER NOT NULL,
  valor_base DECIMAL(10,2) NOT NULL,
  valor_por_filial DECIMAL(10,2) NOT NULL,
  n_filiais_ativas INTEGER NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  effective_date TIMESTAMP(3) NOT NULL,
  generated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT billing_snapshots_empresa_id_pricing_version_key UNIQUE (empresa_id, pricing_version)
);

-- 5) Outbox de operações de billing (consumido pelo worker Asaas)
CREATE TABLE IF NOT EXISTS billing_operations (
  id TEXT PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  billing_snapshot_id INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING',
  idempotency_key TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP(3),
  next_retry_at TIMESTAMP(3),
  external_id TEXT,
  external_reference TEXT,
  error_code TEXT,
  error_message TEXT,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP(3) NOT NULL,
  CONSTRAINT billing_operations_idempotency_key_key UNIQUE (idempotency_key)
);

-- 6) Índices
CREATE INDEX IF NOT EXISTS termo_consent_empresa_id_tipo_idx ON termo_consent (empresa_id, tipo);
CREATE INDEX IF NOT EXISTS billing_operations_status_idx ON billing_operations (status);
CREATE INDEX IF NOT EXISTS billing_operations_empresa_id_status_idx ON billing_operations (empresa_id, status);

-- 7) Foreign keys (com DROP IF EXISTS para re-run idempotente)
ALTER TABLE termo_consent DROP CONSTRAINT IF EXISTS termo_consent_empresa_id_fkey;
ALTER TABLE termo_consent ADD CONSTRAINT termo_consent_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE termo_consent DROP CONSTRAINT IF EXISTS termo_consent_filial_id_fkey;
ALTER TABLE termo_consent ADD CONSTRAINT termo_consent_filial_id_fkey FOREIGN KEY (filial_id) REFERENCES empresas(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE termo_consent DROP CONSTRAINT IF EXISTS termo_consent_pricing_filial_config_id_fkey;
ALTER TABLE termo_consent ADD CONSTRAINT termo_consent_pricing_filial_config_id_fkey FOREIGN KEY (pricing_filial_config_id) REFERENCES pricing_filial_configs(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE termo_consent DROP CONSTRAINT IF EXISTS termo_consent_usuario_id_fkey;
ALTER TABLE termo_consent ADD CONSTRAINT termo_consent_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE billing_snapshots DROP CONSTRAINT IF EXISTS billing_snapshots_empresa_id_fkey;
ALTER TABLE billing_snapshots ADD CONSTRAINT billing_snapshots_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE billing_operations DROP CONSTRAINT IF EXISTS billing_operations_empresa_id_fkey;
ALTER TABLE billing_operations ADD CONSTRAINT billing_operations_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE billing_operations DROP CONSTRAINT IF EXISTS billing_operations_billing_snapshot_id_fkey;
ALTER TABLE billing_operations ADD CONSTRAINT billing_operations_billing_snapshot_id_fkey FOREIGN KEY (billing_snapshot_id) REFERENCES billing_snapshots(id) ON DELETE SET NULL ON UPDATE CASCADE;