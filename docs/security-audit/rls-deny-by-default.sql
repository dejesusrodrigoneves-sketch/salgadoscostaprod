-- =============================================================================
-- RLS Deny-by-Default — Supabase
-- Generated from schema.prisma (35 tables)
--
-- Purpose:  Block anon/authenticated roles from direct DB access.
--           Enables RLS + revokes ALL on all public tables and sequences.
--           NO policies created. NO FORCE ROW LEVEL SECURITY.
--
-- Usage:    Run in Supabase SQL Editor AFTER code deploy.
-- Rollback: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY; (per table)
-- =============================================================================

-- ── PRECHECK ─────────────────────────────────────────────────────────────────
-- Verify you're running as the owner (should return postgres/<ref>).
SELECT current_user, session_user;

-- ── ENABLE RLS (idempotent) ─────────────────────────────────────────────────
ALTER TABLE "empresas"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categorias"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "produtos"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedidos"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "itens_pedido"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagamentos"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processed_webhooks"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entregadores"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entregas_diarias"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "caixa_diario"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "horarios"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "counters"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clientes"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cupons"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_logs"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_logs"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_instances"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklySettlement"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_connections"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_entries"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settlements"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reconciliations"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_closings"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_states"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pricing_configs"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "termo_consent"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pricing_filial_configs"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_snapshots"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_operations"         ENABLE ROW LEVEL SECURITY;

-- ── REVOKE DEFAULT ACCESS ───────────────────────────────────────────────────
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ── NOTES ───────────────────────────────────────────────────────────────────
-- • No FORCE ROW LEVEL SECURITY — table owners bypass RLS by default.
-- • No CREATE POLICY — application-layer auth only (Supabase service_role).
-- • ROLLBACK per table:
--     ALTER TABLE "<table_name>" DISABLE ROW LEVEL SECURITY;
