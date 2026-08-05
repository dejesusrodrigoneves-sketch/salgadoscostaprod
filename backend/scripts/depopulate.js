// Script de depopulação — limpa dados de TESTE do banco
// Uso:
//   node scripts/depopulate.js --dry-run          # mostra contagens, não apaga
//   node scripts/depopulate.js                     # apaga apenas tabelas de LOG
//   node scripts/depopulate.js --tudo              # logs + dados de teste (confirma Y/n)
//   node scripts/depopulate.js --tudo --incluir-whatsapp  # + whatsapp_instances
// Protegidas SEMPRE: empresas, usuarios, clientes, produtos, categorias, entregadores (reais)

require('dotenv').config();
const readline = require('readline');
const { Pool } = require('pg');

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/(\?.*)$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const PROTEGIDAS = ['empresas', 'usuarios', 'clientes', 'produtos', 'categorias', 'entregadores'];
const LOGS = ['login_logs', 'audit_logs', 'app_logs'];
const TESTE = [
  'entregas_diarias', 'caixa_diario', 'counters',
  'horarios', 'cupons', 'pedidos', 'itens_pedido',
];
const OPCIONAL = ['whatsapp_instances'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tudo = args.includes('--tudo');
const incluirWhatsapp = args.includes('--incluir-whatsapp');

let alvo = LOGS.slice();
if (tudo) alvo = alvo.concat(TESTE);
if (incluirWhatsapp) alvo = alvo.concat(OPCIONAL);
for (const p of PROTEGIDAS) {
  if (alvo.includes(p)) throw new Error('Tabela protegida (dados reais) nao pode ser limpa: ' + p);
}

async function contagem(tabela) {
  const r = await pool.query('SELECT count(*)::int c FROM "' + tabela + '"');
  return r.rows[0].c;
}

async function pedirConfirmacao(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(texto + ' (s/N): ', (resp) => { rl.close(); resolve(/^s$/i.test(resp.trim())); }));
}

(async () => {
  console.log('Alvo' + (dryRun ? ' (DRY-RUN — nada sera apagado)' : '') + ': ' + alvo.join(', '));
  const antes = {};
  for (const t of alvo) antes[t] = await contagem(t);
  const total = Object.values(antes).reduce((a, b) => a + b, 0);
  for (const t of alvo) console.log('  ' + t.padEnd(20) + antes[t]);
  console.log('TOTAL: ' + total + ' linhas');

  if (dryRun) { await pool.end(); process.exit(0); }
  if (tudo && total > 0) {
    const ok = await pedirConfirmacao('Apagar ' + total + ' linhas de dados de teste + logs?');
    if (!ok) { console.log('Cancelado.'); await pool.end(); process.exit(0); }
  }
  if (total === 0) { console.log('Nada a apagar.'); await pool.end(); process.exit(0); }

  for (const t of alvo) {
    const r = await pool.query('DELETE FROM "' + t + '"');
    console.log('  limpa: ' + t + ' (' + r.rowCount + ' linhas)');
  }
  console.log('Depopulacao concluida.');
  await pool.end();
})().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
