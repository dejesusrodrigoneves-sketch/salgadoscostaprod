// Script de transformação: JSON exportado do Firestore → SQL (INSERTs)
// Uso: node scripts/transformToSql.js
// Lê de ./export/*.json, escreve ./export/import.sql

const fs = require('fs');
const path = require('path');

const EMPRESA_ID = 1; // empresa padrão para dados legados
const OUT = [];

function q(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function parseDate(ts) {
  if (!ts) return 'NOW()';
  if (ts._seconds) return `TO_TIMESTAMP(${ts._seconds})`;
  return `'${new Date(ts).toISOString().split('T')[0]}'`;
}

// Produtos
function transformProducts(data) {
  const rows = data.map(p => {
    const vals = [
      p.id, EMPRESA_ID, p.type ?? 0, q(p.name), q(p.description || null),
      p.price ?? 0, q(p.img || null), q(p.status || 'active'),
      p.congelado ?? false, p.controlaEstoque ?? false,
      p.estoqueAtual ?? 0, p.estoqueMinimo ?? 0,
    ].join(', ');
    return `INSERT INTO produtos (id, empresa_id, type, name, description, price, img, status, congelado, controla_estoque, estoque_atual, estoque_minimo) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;`;
  });
  OUT.push(`-- Produtos (${rows.length})`, ...rows, '');
}

// Pedidos
function transformPedidos(data) {
  const rows = data.map(p => {
    const vals = [
      q(p.id), EMPRESA_ID, q(p.cliente?.nome || p.clienteNome || ''),
      q(p.cliente?.whatsapp || p.clienteWhatsapp || null),
      q(p.cliente?.endereco || p.clienteEndereco || null),
      q(p.cliente?.numero || p.clienteNumero || null),
      q(p.cliente?.bairro || p.clienteBairro || null),
      q(p.cliente?.cep || p.clienteCep || null),
      q(p.cliente?.referencia || p.clienteReferencia || null),
      q(p.tipoEntrega || 'delivery'), q(p.formaPagamento || null),
      p.troco ?? 'NULL', q(p.status || 'pendente'),
      p.valores?.itens ?? 'NULL', p.valores?.entrega ?? 'NULL',
      p.valores?.taxaCartao ?? 'NULL', p.valores?.desconto ?? 'NULL',
      p.valores?.total ?? 'NULL',
      q(p.entregadorId || null), p.lat ?? 'NULL', p.lon ?? 'NULL',
      parseDate(p.createdAt), p.finalizadoEm ? parseDate(p.finalizadoEm) : 'NULL',
    ].join(', ');
    return `INSERT INTO pedidos (id, empresa_id, cliente_nome, cliente_whatsapp, cliente_endereco, cliente_numero, cliente_bairro, cliente_cep, cliente_referencia, tipo_entrega, forma_pagamento, troco, status, valores_itens, taxas_entrega, taxas_cartao, desconto, total, entregador_id, lat, lon, criado_em, finalizado_em) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;`;
  });
  OUT.push(`-- Pedidos (${rows.length})`, ...rows, '');
}

function transformUsuarios(data) {
  data.forEach(u => {
    const vals = [EMPRESA_ID, q(u.username), q(u.passwordHash), q(u.lojaNome || null), q(u.role || 'user')].join(', ');
    OUT.push(`INSERT INTO usuarios (empresa_id, username, password_hash, loja_nome, role) VALUES (${vals}) ON CONFLICT (empresa_id, username) DO NOTHING;`);
  });
  OUT.push('');
}

function transformEntregadores(data) {
  data.forEach(e => {
    const vals = [EMPRESA_ID, q(e.nome), q(e.endereco || null), q(e.whatsapp || null), q(e.chavePix || null), e.ativo ?? true].join(', ');
    OUT.push(`INSERT INTO entregadores (empresa_id, nome, endereco, whatsapp, chave_pix, ativo) VALUES (${vals});`);
  });
  OUT.push('');
}

function transformSettings(data) {
  const horarios = data.find(s => s.id === 'horarios');
  if (horarios) {
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    DIAS.forEach(dia => {
      const h = horarios[dia] || {};
      const vals = [EMPRESA_ID, q(dia), h.fechado ?? false, q(h.inicio || null), q(h.fim || null)].join(', ');
      OUT.push(`INSERT INTO horarios (empresa_id, dia, fechado, inicio, fim) VALUES (${vals});`);
    });
  }
  OUT.push('');
}

function transformCounters(data) {
  const counter = data.find(c => c.id === 'pedidoId');
  if (counter) {
    OUT.push(`INSERT INTO counters (nome, empresa_id, last_value) VALUES ('pedidoId', ${EMPRESA_ID}, ${counter.last || 0}) ON CONFLICT (nome, empresa_id) DO UPDATE SET last_value = EXCLUDED.last_value;`);
  }
  OUT.push('');
}

// Main
async function main() {
  const exportDir = path.join(__dirname, '..', 'export');
  if (!fs.existsSync(exportDir)) {
    console.error('Diretório ./export não encontrado. Execute exportFirestore.js primeiro.');
    process.exit(1);
  }

  const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(exportDir, file), 'utf-8');
    const data = JSON.parse(raw);
    const name = file.replace('.json', '');

    switch (name) {
      case 'products': transformProducts(data); break;
      case 'pedidos': transformPedidos(data); break;
      case 'usuarios': transformUsuarios(data); break;
      case 'entregadores': transformEntregadores(data); break;
      case 'settings': transformSettings(data); break;
      case 'counters': transformCounters(data); break;
      default: console.log(`Pulando ${name} (sem transformador)`);
    }
  }

  const outPath = path.join(exportDir, 'import.sql');
  fs.writeFileSync(outPath, [
    '-- SQL de importação — Gerado automaticamente',
    '-- Fonte: Exportação Firestore',
    `-- Data: ${new Date().toISOString().split('T')[0]}`,
    `-- Empresa padrão ID: ${EMPRESA_ID}`,
    '',
    'BEGIN;',
    '',
    ...OUT,
    'COMMIT;',
  ].join('\n'));

  console.log(`Arquivo gerado: ${outPath}`);
}

main().catch(console.error);
