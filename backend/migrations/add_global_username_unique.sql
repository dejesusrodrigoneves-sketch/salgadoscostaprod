-- Migration: Change Usuario unique constraint from composite to global username
-- Date: 2026-08-26
-- Purpose: Allow same username across empresas (remove empresaId from unique)
-- WARNING: Run in a maintenance window — locks usuarios table

-- Step 1: Drop old composite unique constraint
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_empresa_id_username_key;

-- Step 2: Add new global unique constraint on username alone
ALTER TABLE usuarios ADD CONSTRAINT usuarios_username_key UNIQUE (username);
