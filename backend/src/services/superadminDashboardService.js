// backend/src/services/superadminDashboardService.js (ESM)
import prisma from '../config/prisma.js';

// Table names from @@map in schema.prisma
// Pedido → "pedidos", Empresa → "empresas", FinancialEntry → "financial_entries"
// Column names: snake_case per @map

export async function getSummary(empresaId = null) {
  if (empresaId) {
    const id = parseInt(empresaId);
    // Single empresa
    const row = await prisma.$queryRaw`
      SELECT
        e.id as "empresaId",
        e.nome as "empresaNome",
        e.slug as "empresaSlug",
        COALESCE(p."pedidosMes", 0)::int as "pedidosMes",
        COALESCE(r."recebidoMes", 0)::float as "recebidoMes",
        COALESCE(a."aReceber", 0)::float as "aReceber"
      FROM "empresas" e
      LEFT JOIN (
        SELECT "empresa_id", COUNT(*)::int as "pedidosMes"
        FROM "pedidos"
        WHERE "criado_em" >= date_trunc('month', NOW())
          AND "empresa_id" = ${id}
          AND "deleted_em" IS NULL
        GROUP BY "empresa_id"
      ) p ON p."empresa_id" = e.id
      LEFT JOIN (
        SELECT "empresa_id", SUM("received_amount")::float as "recebidoMes"
        FROM "financial_entries"
        WHERE status = 'PAID'
          AND "transaction_date" >= date_trunc('month', NOW())
          AND "empresa_id" = ${id}
        GROUP BY "empresa_id"
      ) r ON r."empresa_id" = e.id
      LEFT JOIN (
        SELECT "empresa_id", SUM("expected_amount")::float as "aReceber"
        FROM "financial_entries"
        WHERE status IN ('PENDING', 'OVERDUE')
          AND "empresa_id" = ${id}
        GROUP BY "empresa_id"
      ) a ON a."empresa_id" = e.id
      WHERE e.id = ${id}
    `;
    if (!row.length) return null;
    const r = row[0];
    return {
      empresaId: r.empresaId,
      empresaNome: r.empresaNome,
      empresaSlug: r.empresaSlug,
      pedidosMes: r.pedidosMes,
      recebidoMes: r.recebidoMes,
      aReceber: r.aReceber,
      ticketMedio: r.pedidosMes > 0 ? r.recebidoMes / r.pedidosMes : 0,
    };
  }

  // Global summary — single query to avoid pool exhaustion
  const row = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM "empresas") as "totalEmpresas",
      (SELECT COUNT(DISTINCT "empresa_id")::int FROM "pedidos" WHERE "criado_em" > NOW() - INTERVAL '30 days' AND "deleted_em" IS NULL) as "empresasAtivas",
      (SELECT COUNT(*)::int FROM "pedidos" WHERE "criado_em" >= date_trunc('month', NOW()) AND "deleted_em" IS NULL) as "pedidosMes",
      (SELECT COUNT(*)::int FROM "pedidos" WHERE "criado_em" >= CURRENT_DATE AND "deleted_em" IS NULL) as "pedidosHoje",
      (SELECT COALESCE(SUM("received_amount"), 0)::float FROM "financial_entries" WHERE status = 'PAID' AND "transaction_date" >= date_trunc('month', NOW())) as "recebidoMes",
      (SELECT COALESCE(SUM("expected_amount"), 0)::float FROM "financial_entries" WHERE status IN ('PENDING', 'OVERDUE')) as "aReceber"
  `;
  const r = row[0];
  const pedidosMesCount = r.pedidosMes || 0;
  const recebidoMesVal = r.recebidoMes || 0;

  return {
    totalEmpresas: r.totalEmpresas,
    empresasAtivas: r.empresasAtivas || 0,
    pedidosMes: pedidosMesCount,
    pedidosHoje: r.pedidosHoje || 0,
    recebidoMes: recebidoMesVal,
    aReceber: r.aReceber || 0,
    ticketMedio: pedidosMesCount > 0 ? recebidoMesVal / pedidosMesCount : 0,
  };
}

export async function getEmpresas() {
  const rows = await prisma.$queryRaw`
    SELECT
      e.id,
      e.nome,
      e.slug,
      COALESCE(p."pedidosMes", 0)::int as "pedidosMes",
      COALESCE(r."recebidoMes", 0)::float as "recebidoMes",
      COALESCE(a."aReceber", 0)::float as "aReceber",
      CASE WHEN EXISTS (
        SELECT 1 FROM "pedidos" WHERE "empresa_id" = e.id AND "criado_em" > NOW() - INTERVAL '30 days' AND "deleted_em" IS NULL
      ) THEN 'ativa' ELSE 'inativa' END as status
    FROM "empresas" e
    LEFT JOIN (
      SELECT "empresa_id", COUNT(*)::int as "pedidosMes"
      FROM "pedidos"
      WHERE "criado_em" >= date_trunc('month', NOW())
        AND "deleted_em" IS NULL
      GROUP BY "empresa_id"
    ) p ON p."empresa_id" = e.id
    LEFT JOIN (
      SELECT "empresa_id", SUM("received_amount")::float as "recebidoMes"
      FROM "financial_entries"
      WHERE status = 'PAID' AND "transaction_date" >= date_trunc('month', NOW())
      GROUP BY "empresa_id"
    ) r ON r."empresa_id" = e.id
    LEFT JOIN (
      SELECT "empresa_id", SUM("expected_amount")::float as "aReceber"
      FROM "financial_entries"
      WHERE status IN ('PENDING', 'OVERDUE')
      GROUP BY "empresa_id"
    ) a ON a."empresa_id" = e.id
    ORDER BY e.nome
  `;
  return rows.map(r => ({
    id: r.id,
    nome: r.nome,
    slug: r.slug,
    pedidosMes: r.pedidosMes,
    recebidoMes: r.recebidoMes,
    aReceber: r.aReceber,
    status: r.status,
  }));
}
