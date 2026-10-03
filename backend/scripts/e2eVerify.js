#!/usr/bin/env node
// backend/scripts/e2eVerify.js — E2E API (fase de verificação; remover após uso)
// Uso: node scripts/e2eVerify.js   (exit 1 = FAIL)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
const SLUG = 'salgadoscosta';
const OUT = path.join(process.env.TEMP || '/tmp', 'opencode');
const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
    console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
    console.log(`FAIL  ${name} — ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const api = axios.create({ baseURL: BASE, validateStatus: () => true });

function sseProbeOnce(url) {
  return new Promise((resolve) => {
    const agent = new http.Agent({ keepAlive: false });
    let done = false;
    let timer = null;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const req = http.get(url, { agent }, (res) => {
      const ct = res.headers['content-type'] || '';
      const code = res.statusCode;
      finish({ ok: code === 200 && ct.includes('text/event-stream'), code, ct });
      req.destroy();
    });
    req.on('error', (e) => finish({ ok: false, code: 0, ct: e.message }));
    timer = setTimeout(() => { req.destroy(); finish({ ok: false, code: 0, ct: 'timeout' }); }, 10000);
  });
}

async function sseProbe(url) {
  let r = await sseProbeOnce(url);
  if (!r.ok && (r.code === 0)) r = await sseProbeOnce(url);
  return r;
}

async function main() {
  // ---------- Auth ----------
  const login = await api.post('/api/auth/login', { username: 'simone', password: 'Costa@2026' });
  assert(login.status === 200 && login.data.token, `login simone → ${login.status}`);
  const tokAdmin = login.data.token;

  let tokSuper = null;
  const loginS = await api.post('/api/auth/login', { username: 'djesus', password: '123456' });
  if (loginS.status === 200 && loginS.data.token) tokSuper = loginS.data.token;
  console.log(`INFO  djesus/superadmin: ${tokSuper ? 'logado' : 'sem credencial (fallback service direto)'}`);

  const H = (t) => ({ Authorization: `Bearer ${t}` });

  // ---------- T7/E1: PDV ignora total do cliente, normaliza balcao→retirada ----------
  await check('E2E-A pdv dinheiro: total server-side + enum retirada + troco', async () => {
    const r = await api.post('/api/pedidos', {
      clienteNome: 'E2E PDV', clienteWhatsapp: '21999990100',
      tipoEntrega: 'balcao', formaPagamento: 'dinheiro', troco: 50,
      itens: [{ produtoId: 6, quantidade: 2 }],
      taxasEntrega: 0, taxasCartao: 0, desconto: 0, total: 999,
    }, { headers: H(tokAdmin) });
    assert(r.status === 201, `status ${r.status}: ${JSON.stringify(r.data)}`);
    const db = await prisma.pedido.findUnique({ where: { id: r.data.id } });
    assert(db, 'pedido não gravado');
    assert(Number(db.total) === 1, `total DB=${db.total} (esperado 1.00, cliente mandou 999)`);
    assert(db.tipoEntrega === 'retirada', `tipoEntrega=${db.tipoEntrega} (esperado retirada)`);
    assert(Number(db.troco) === 50, `troco=${db.troco}`);
    return `id=${r.data.id} total=${db.total}`;
  });

  // ---------- T8/N6: delivery fee via pricingPolicy ----------
  await check('E2E-B delivery: taxasEntrega=3 (bairro Sargento roncalle)', async () => {
    const r = await api.post('/api/pedidos', {
      clienteNome: 'E2E Delivery', clienteWhatsapp: '21999990101',
      clienteBairro: 'Sargento roncalle', tipoEntrega: 'delivery', formaPagamento: 'dinheiro',
      itens: [{ produtoId: 7, quantidade: 1 }],
      taxasEntrega: 0, taxasCartao: 0, desconto: 0, total: 10,
    }, { headers: H(tokAdmin) });
    assert(r.status === 201, `status ${r.status}: ${JSON.stringify(r.data)}`);
    const db = await prisma.pedido.findUnique({ where: { id: r.data.id } });
    assert(Number(db.taxasEntrega) === 3, `taxasEntrega=${db.taxasEntrega} (esperado 3)`);
    assert(Number(db.total) === 13, `total=${db.total} (esperado 13)`);
    return `id=${r.data.id} taxa=${db.taxasEntrega} total=${db.total}`;
  });

  // ---------- T1/N1: criarPix real sandbox (não-chamada inexistente) ----------
  let pixPedidoId = null;
  let pixAsaasId = null;
  await check('E2E-C public PIX: criarPix sandbox → 201 + pixCode', async () => {
    const r = await api.post(`/api/public/pedidos?slug=${SLUG}`, {
      clienteNome: 'E2E PIX', clienteWhatsapp: '21999990102',
      tipoEntrega: 'retirada', formaPagamento: 'pix', cpf: '52998224725',
      itens: [{ produtoId: 21, quantidade: 1 }],
    });
    assert(r.status === 201, `status ${r.status}: ${JSON.stringify(r.data)}`);
    assert(r.data.pagamento && r.data.pagamento.pixCode, `sem pixCode: ${JSON.stringify(r.data.pagamento || {})}`);
    pixPedidoId = r.data.id;
    const pg = await prisma.pagamento.findFirst({ where: { pedidoId: r.data.id } });
    pixAsaasId = pg && pg.asaasPaymentId;
    assert(pixAsaasId, 'sem asaasPaymentId no banco');
    return `pedido=${r.data.id} asaas=${pixAsaasId}`;
  });

  // ---------- T11/E8: taxa cartao credito 6% server-side ----------
  await check('E2E-D public credito: taxasCartao=6% (0.90) + total 15.90', async () => {
    const r = await api.post(`/api/public/pedidos?slug=${SLUG}`, {
      clienteNome: 'E2E CREDITO', clienteWhatsapp: '21999990103',
      tipoEntrega: 'retirada', formaPagamento: 'credito',
      itens: [{ produtoId: 21, quantidade: 1 }],
    });
    assert(r.status === 201, `status ${r.status}: ${JSON.stringify(r.data)}`);
    const db = await prisma.pedido.findUnique({ where: { id: r.data.id } });
    assert(Number(db.taxasCartao) === 0.9, `taxasCartao=${db.taxasCartao} (esperado 0.90)`);
    assert(Math.abs(Number(db.total) - 15.9) < 0.001, `total=${db.total} (esperado 15.90)`);
    return `id=${r.data.id} taxaCartao=${db.taxasCartao} total=${db.total}`;
  });

  // ---------- T10/E7: cliente + SSE com ?token= ----------
  // telefone rand: cliente legado ficou com passwordHash=null (T8) → login 401;
  // rand sempre cai no register 201 (evita 409→login)
  const W2 = '+55219' + Date.now().toString().slice(-9);
  let tokCliente = null;
  await check('E2E-E registrar cliente (consentimento)', async () => {
    let r = await api.post(`/api/public/clientes/register?slug=${SLUG}`, {
      nome: 'E2E SSE', telefone: W2, password: 'e2e12345',
      aceitePoliticas: true, consentVersion: 'v1',
    });
    if (r.status === 409) {
      r = await api.post(`/api/public/clientes/login?slug=${SLUG}`, { telefone: W2, password: 'e2e12345' });
    }
    assert((r.status === 200 || r.status === 201) && r.data.token, `register/login → ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    tokCliente = r.data.token;
    return `cliente token len=${tokCliente.length}`;
  });

  let ssePedidoId = null;
  await check('E2E-F pedido public para cliente (SSE target)', async () => {
    const r = await api.post(`/api/public/pedidos?slug=${SLUG}`, {
      clienteNome: 'E2E SSE', clienteWhatsapp: W2,
      tipoEntrega: 'retirada', formaPagamento: 'dinheiro', troco: 50,
      itens: [{ produtoId: 6, quantidade: 1 }],
    });
    assert(r.status === 201, `status ${r.status}: ${JSON.stringify(r.data)}`);
    ssePedidoId = r.data.id;
    return `id=${ssePedidoId}`;
  });

  await check('E2E-G SSE /api/payment/status?token= → 200 event-stream', async () => {
    assert(tokCliente, 'sem token cliente');
    const probe = await sseProbe(`${BASE}/api/payment/status/${ssePedidoId}?token=${encodeURIComponent(tokCliente)}`);
    assert(probe.ok, `code=${probe.code} ct=${probe.ct}`);
    return `stream ok (${probe.ct})`;
  });

  // ---------- T4/E12 + T2/E5: webhook → status pago + dedup ----------
  await check('E2E-H webhook PAYMENT_RECEIVED → pedido.status=pago (E5 live)', async () => {
    assert(pixPedidoId && pixAsaasId, 'sem pedido PIX da E2E-C');
    const evt = `e2e-evt-${Date.now()}`;
    const payload = {
      id: evt, event: 'PAYMENT_RECEIVED',
      payment: { id: pixAsaasId }, dateCreated: new Date().toISOString(),
    };
    const wh = await api.post('/webhooks/asaas', payload, {
      headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN, 'Content-Type': 'application/json' },
    });
    assert(wh.status === 200, `webhook → ${wh.status}: ${JSON.stringify(wh.data).slice(0, 300)}`);
    const db = await prisma.pedido.findUnique({ where: { id: pixPedidoId } });
    assert(db.status === 'pago', `status=${db.status} (esperado pago)`);
    assert(db.paymentStatus === 'pago', `paymentStatus=${db.paymentStatus}`);
    const dedup = await prisma.processedWebhook.findUnique({ where: { eventId: evt } });
    assert(dedup, 'dedup não gravado');
    // replay mesmo eventId → duplicate tratado (não duplica efeito)
    const wh2 = await api.post('/webhooks/asaas', payload, {
      headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN, 'Content-Type': 'application/json' },
    });
    assert(wh2.status === 200, `replay → ${wh2.status}`);
    const db2 = await prisma.pedido.findUnique({ where: { id: pixPedidoId } });
    assert(db2.status === 'pago', 'status alterado no replay');
    const dedupCount = await prisma.processedWebhook.count({ where: { eventId: evt } });
    assert(dedupCount === 1, `dedup count=${dedupCount}`);
    return `pedido pago + dedup ${evt}`;
  });

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'e2e-paid.json'), JSON.stringify({
    id: pixPedidoId, clienteNome: 'E2E PIX', status: 'pago',
  }));

  // ---------- T14/E11: POST /settlement/run ----------
  await check('E2E-I settlement run: admin→403, superadmin→200', async () => {
    const neg = await api.post('/api/empresa/settlement/run', {}, { headers: H(tokAdmin) });
    assert(neg.status === 403, `admin deveria 403, veio ${neg.status}`);
    if (tokSuper) {
      const pos = await api.post('/api/empresa/settlement/run', {}, { headers: H(tokSuper) });
      assert(pos.status === 200, `superadmin → ${pos.status}: ${JSON.stringify(pos.data).slice(0, 200)}`);
      assert(Array.isArray(pos.data.results), 'sem results[]');
      return `superadmin processed=${pos.data.processed}`;
    }
    // fallback: serviço direto (sem credencial superadmin)
    const ss = require('../src/services/settlementService.js');
    const fn = ss.processarTodasEmpresas || (ss.default && ss.default.processarTodasEmpresas);
    assert(typeof fn === 'function', 'processarTodasEmpresas ausente');
    const results2 = await fn();
    assert(Array.isArray(results2) && results2.length > 0, 'results vazio');
    return `service processed=${results2.length} (admin 403 ok)`;
  });

  // ---------- T16/N9: authorize em POST /api/pedidos ----------
  await check('E2E-J authorize: sem token → 401', async () => {
    const r = await api.post('/api/pedidos', { clienteNome: 'X', itens: [{ produtoId: 6, quantidade: 1 }] });
    assert(r.status === 401, `esperado 401, veio ${r.status}`);
    return '401 ok';
  });

  const failed = results.filter((r) => !r.ok);
  console.log('\n===== E2E RESULT =====');
  console.log(`PASS ${results.length - failed.length}/${results.length}`);
  for (const f of failed) console.log(`  FAIL: ${f.name} — ${f.detail}`);
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('E2E fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
