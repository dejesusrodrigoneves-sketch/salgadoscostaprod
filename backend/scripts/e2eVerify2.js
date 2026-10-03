#!/usr/bin/env node
// E2E final: rollback de dedup do webhook (N2/E12) + fixture pedido pago (E5/kanban)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
const results = [];
const out = [];

function assert(c, m) { if (!c) throw new Error(m); }

async function check(name, fn) {
  try { const d = await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}${d ? ' — ' + d : ''}`); }
  catch (e) { results.push({ name, ok: false }); console.log(`FAIL  ${name} — ${e.message}`); }
}

async function main() {
  // ---- fixture pagamento: pedido recente (dinâmico; ids sim removidos no cleanup) ----
  const pedido = await prisma.pedido.findFirst({
    where: { empresaId: 1 },
    orderBy: { createdAt: 'desc' },
  });
  assert(pedido, 'nenhum pedido disponivel para fixture');
  console.log(`fixture pedido=${pedido.id} (${pedido.clienteNome})`);
  const FAKE = 'pay_e2e_rollback_' + Date.now();
  await prisma.pagamento.create({
    data: {
      pedidoId: pedido.id,
      empresaId: pedido.empresaId,
      asaasPaymentId: FAKE,
      valor: Number(pedido.total),
      status: 'aguardando_pagamento',
      metodo: 'pix',
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  const EVT = 'e2e-rb-' + Date.now();
  const payload = { id: EVT, event: 'PAYMENT_RECEIVED', payment: { id: FAKE }, dateCreated: new Date().toISOString() };
  const headers = { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN, 'Content-Type': 'application/json' };

  await check('E2E-H1 webhook: processamento falha no Asaas → erro repassado (>=400)', async () => {
    const r = await axios.post(`${BASE}/webhooks/asaas`, payload, { headers, validateStatus: () => true });
    assert(r.status >= 400, `status ${r.status} (esperado 404/401/5xx): ${JSON.stringify(r.data).slice(0, 200)}`);
    return `status=${r.status}`;
  });

  await check('E2E-H2 dedup ROLLBACK: processedWebhook removido após falha', async () => {
    const row = await prisma.processedWebhook.findUnique({ where: { eventId: EVT } });
    assert(!row, `dedup persistiu: ${JSON.stringify(row)}`);
    return 'evento nao permaneceu (retry-safe)';
  });

  await check('E2E-H3 retry: segundo envio NAO vira DUPLICATE (reprocessa)', async () => {
    const r = await axios.post(`${BASE}/webhooks/asaas`, payload, { headers, validateStatus: () => true });
    assert(r.status !== 200, `status ${r.status} — 200 indica DUPLICATE precoce (dedup preso)`);
    const row = await prisma.processedWebhook.findUnique({ where: { eventId: EVT } });
    assert(!row, 'dedup ficou preso apos retry');
    return `retry=${r.status}, dedup ausente`;
  });

  await check(`E2E-K fixture: pedido ${pedido.id} → status pago (kanban)`, async () => {
    await prisma.pedido.update({ where: { id: pedido.id }, data: { status: 'pago', paymentStatus: 'pago' } });
    const dir = path.join(process.env.TEMP || '/tmp', 'opencode');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'e2e-paid.json'), JSON.stringify({ id: pedido.id, clienteNome: pedido.clienteNome, status: 'pago' }));
    return `${pedido.id} pago + e2e-paid.json`;
  });

  // limpa fixture pagamento fake
  await prisma.pagamento.deleteMany({ where: { asaasPaymentId: FAKE } });

  const failed = results.filter((r) => !r.ok);
  console.log(`\nE2E2: PASS ${results.length - failed.length}/${results.length}`);
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => { console.error('fatal', e); await prisma.$disconnect(); process.exit(1); });
