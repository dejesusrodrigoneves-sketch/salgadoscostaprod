const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url });

async function runMigrations() {
  const dir = path.join(__dirname, 'prisma', 'migrations');
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  for (const d of dirs) {
    const sqlFile = path.join(dir, d, 'migration.sql');
    if (!fs.existsSync(sqlFile)) continue;
    console.log('Running migration:', d);
    const sql = fs.readFileSync(sqlFile, 'utf8');
    const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      try { await pool.query(stmt + ';'); }
      catch (e) { if (!e.message.includes('already exists')) console.error('  Error:', d, e.message); }
    }
    console.log('  OK');
  }
}

async function seed() {
  console.log('\nRunning seed...');
  const empresa = await pool.query(
    `INSERT INTO "empresas" ("nome","slug","criado_em") VALUES ($1,$2,NOW())
     ON CONFLICT ("slug") DO UPDATE SET "nome"=$1 RETURNING "id"`,
    ['Fábrica de Salgados Costa', 'salgadoscosta']
  );
  const eid = empresa.rows[0].id;
  console.log('  Empresa ID:', eid);
  const senha = process.env.SUPERADMIN_PASSWORD || 'tsa110594';
  const hash = await bcrypt.hash(senha, 10);
  await pool.query(
    `INSERT INTO "usuarios" ("empresa_id","username","password_hash","role","loja_nome","criado_em")
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT ("empresa_id","username") DO UPDATE SET "password_hash"=$3`,
    [eid, 'djesus', hash, 'superadmin', 'Administrador']
  );
  console.log('  Usuario: djesus /', senha, '(role: superadmin)');
}

async function main() {
  try {
    const test = await pool.query('SELECT 1 as ok');
    console.log('Conectado ao banco:', test.rows[0].ok === 1 ? 'OK' : 'FALHA');
    await runMigrations();
    await seed();
    console.log('\nDeploy concluido!');
  } catch (e) { console.error('ERRO:', e.message); }
  finally { await pool.end(); }
}
main();
