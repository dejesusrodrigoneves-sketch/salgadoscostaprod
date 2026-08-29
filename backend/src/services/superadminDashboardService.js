// backend/src/services/superadminDashboardService.js (ESM)
import prisma from '../config/prisma.js';

export async function getSummary(empresaId = null) {
  if (empresaId) {
    // Single empresa
    const row = await prisma.$queryRaw`
      SELECT
        e.id as "empresaId",
        e.nome as "empresaNome",
        e.slug as "empresaSlug",
        COALESCE(p."pedidosMes", 0)::int as "pedidosMes",
        COALESCE(r."recebidoMes", 0)::float as "recebidoMes",
        COALESCE(a."aReceber", 0)::float as "aReceber"
      FROM "Empresa" e
      LEFT JOIN (
        SELECT "empresaId", COUNT(*)::int as "pedidosMes"
        FROM "Pedido"
        WHERE "criadoEm" >= date_trunc('month', NOW())
          AND "empresaId" = ${parseInt(empresaId)}
        GROUP BY "empresaId"
      ) p ON p."empresaId" = e.id
      LEFT JOIN (
        SELECT "empresaId", SUM(valor)::float as "recebidoMes"
        FROM "FinancialEntry"
        WHERE status = 'paid'
          AND "paidAt" >= date_trunc('month', NOW())
          AND "empresaId" = ${parseInt(empresaId)}
        GROUP BY "empresaId"
      ) r ON r."empresaId" = e.id
      LEFT JOIN (
        SELECT "empresaId", SUM(valor)::float as "aReceber"
        FROM "FinancialEntry"
        WHERE status IN ('pending', 'overdue')
          AND "empresaId" = ${parseInt(empresaId)}
        GROUP BY "empresaId"
      ) a ON a."empresaId" = e.id
      WHERE e.id = ${parseInt(empresaId)}
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

  // Global summary
  const totalEmpresas = await prisma.empresa.count();
  const empresasAtivas = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT p."empresaId")::int as count
    FROM "Pedido" p
    WHERE p."criadoEm" > NOW() - INTERVAL '30 days'
  `;
  const pedidosMes = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Pedido"
    WHERE "criadoEm" >= date_trunc('month', NOW())
  `;
  const pedidosHoje = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Pedido"
    WHERE "criadoEm" >= CURRENT_DATE
  `;
  const recebidoMes = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0)::float as total
    FROM "FinancialEntry"
    WHERE status = 'paid'
      AND "paidAt" >= date_trunc('month', NOW())
  `;
  const aReceber = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0)::float as total
    FROM "FinancialEntry"
    WHERE status IN ('pending', 'overdue')
  `;

  const pedidosMesCount = pedidosMes[0]?.count || 0;
  const recebidoMesVal = recebidoMes[0]?.total || 0;

  return {
    totalEmpresas,
    empresasAtivas: empresasAtivas[0]?.count || 0,
    pedidosMes: pedidosMesCount,
    pedidosHoje: pedidosHoje[0]?.count || 0,
    recebidoMes: recebidoMesVal,
    aReceber: aReceber[0]?.total || 0,
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
        SELECT 1 FROM "Pedido" WHERE "empresaId" = e.id AND "criadoEm" > NOW() - INTERVAL '30 days'
      ) THEN 'ativa' ELSE 'inativa' END as status
    FROM "Empresa" e
    LEFT JOIN (
      SELECT "empresaId", COUNT(*)::int as "pedidosMes"
      FROM "Pedido"
      WHERE "criadoEm" >= date_trunc('month', NOW())
      GROUP BY "empresaId"
    ) p ON p."empresaId" = e.id
    LEFT JOIN (
      SELECT "empresaId", SUM(valor)::float as "recebidoMes"
      FROM "FinancialEntry"
      WHERE status = 'paid' AND "paidAt" >= date_trunc('month', NOW())
      GROUP BY "empresaId"
    ) r ON r."empresaId" = e.id
    LEFT JOIN (
      SELECT "empresaId", SUM(valor)::float as "aReceber"
      FROM "FinancialEntry"
      WHERE status IN ('pending', 'overdue')
      GROUP BY "empresaId"
    ) a ON a."empresaId" = e.id
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