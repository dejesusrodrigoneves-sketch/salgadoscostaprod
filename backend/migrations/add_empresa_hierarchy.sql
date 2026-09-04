-- backend/migrations/add_empresa_hierarchy.sql
-- Adiciona suporte a hierarquia matriz/filiais

ALTER TABLE empresas 
  ADD COLUMN parent_empresa_id INT REFERENCES empresas(id),
  ADD COLUMN empresa_tipo VARCHAR(20) DEFAULT 'independente',
  ADD COLUMN pending_theme_settings JSONB,
  ADD COLUMN theme_approved BOOLEAN DEFAULT true;

-- Índices para performance
CREATE INDEX idx_empresas_parent_empresa_id ON empresas(parent_empresa_id);
CREATE INDEX idx_empresas_empresa_tipo ON empresas(empresa_tipo);
