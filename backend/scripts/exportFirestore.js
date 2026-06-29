// Script de exportação do Firestore para JSON
// Uso: node scripts/exportFirestore.js
// Gera arquivos ./export/*.json

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const COLLECTIONS = [
  'products', 'pedidos', 'historico', 'usuarios',
  'entregadores', 'entregaRegistro', 'caixa',
  'relatoriosdeCaixa', 'settings', 'cupons', 'counters',
];

async function exportAll() {
  const outDir = path.join(__dirname, '..', 'export');
  fs.mkdirSync(outDir, { recursive: true });

  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();

  for (const col of COLLECTIONS) {
    console.log(`Exportando ${col}...`);
    const snap = await db.collection(col).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    fs.writeFileSync(path.join(outDir, `${col}.json`), JSON.stringify(docs, null, 2));
    console.log(`  ${docs.length} documentos`);
  }
  console.log('Exportação concluída!');
}

exportAll().catch(console.error);
