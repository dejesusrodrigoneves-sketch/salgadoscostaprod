// Backfill cifrado + bidx (Task 12 — plano proteção de dados)
// Uso: node scripts/encryptBackfill.js [--apply]
const prisma = require('../src/config/prisma');
const { normalizeTelefone } = require('../src/utils/pii');
const { mapClienteIn } = require('../src/repositories/piiRepository');

function analyzeRows(rows) {
  const seen = new Map();
  let duplicates = 0;
  for (const r of rows) {
    const key = `${r.empresaId}:${normalizeTelefone(r.telefone)}`;
    if (seen.has(key)) duplicates++;
    else seen.set(key, true);
  }
  return { total: rows.length, duplicates };
}

async function runBackfill({ apply = false } = {}) {
  // validação só na execução (import no vitest não tem .env — evita crash no teste)
  require('../src/config/cryptoKeys').validateAtBoot();
  const clientes = await prisma.cliente.findMany({ select: { id: true, empresaId: true, telefone: true, endereco: true, numero: true, cep: true, pontoReferencia: true, nome: true, bairro: true } });
  const report = analyzeRows(clientes);
  console.log('[backfill] clientes', report);
  if (report.duplicates > 0) throw new Error('[backfill] colisões detectadas — abortar');
  if (!apply) { console.log('[backfill] DRY-RUN'); return report; }
  for (const c of clientes) {
    await prisma.cliente.update({ where: { id: c.id }, data: mapClienteIn(c) });
  }
  console.log('[backfill] aplicado', clientes.length);
  return report;
}

if (require.main === module) {
  require('dotenv').config();
  runBackfill({ apply: process.argv.includes('--apply') })
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e.message); prisma.$disconnect(); process.exit(1); });
}
module.exports = { runBackfill, analyzeRows };
