require('dotenv').config();

// Conecta ao NEON (banco original - DATABASE_URL original)
const neonUrl = 'postgresql://neondb_owner:npg_Odx3kwGqc8eW@ep-floral-breeze-ac92m14j.sa-east-1.aws.neon.tech/neondb?sslmode=require';

// Conecta ao SUPABASE via non-pooling direct connection (sem verificação SSL)
const supabaseUrl = 'postgres://postgres.lfuhqoujzgenwwvuabez:u6K4WPZyVsrziTzp@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true';

// Tables in dependency order (parents first)
const TABLES = [
  'empresas',
  'categorias',
  'usuarios',
  'produtos',
  'pedidos',
  'itens_pedido',
  'entregadores',
  'entregas_diarias',
  'caixa_diario',
  'horarios',
  'counters',
  'clientes',
  'cupons',
  'whatsapp_instances'
];

async function run() {
  const { Pool } = require('pg');

  const sslCfg = { rejectUnauthorized: false };

  console.log('Conectando ao NEON...');
  const neon = new Pool({ connectionString: neonUrl, max: 1, ssl: sslCfg });

  console.log('Conectando ao SUPABASE...');
  const supabase = new Pool({ connectionString: supabaseUrl, max: 1, ssl: sslCfg });

  try {
    for (const table of TABLES) {
      console.log(`Migrando ${table}...`);
      
      const { rows } = await neon.query(`SELECT * FROM ${table}`);
      if (rows.length === 0) {
        console.log(`  ${table}: 0 linhas, pulando.`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      const insertSQL = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      for (const row of rows) {
        const values = columns.map(c => row[c]);
        await supabase.query(insertSQL, values);
      }

      console.log(`  ${table}: ${rows.length} linhas migradas.`);
    }

    console.log('\nMigração concluída com sucesso!');
  } catch (err) {
    console.error('Erro na migração:', err);
    process.exit(1);
  } finally {
    await neon.end();
    await supabase.end();
  }
}

run();