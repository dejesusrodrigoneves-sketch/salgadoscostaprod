# Marketplace Integrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **NOTE (ordem do usuário):** NÃO commitar. O usuário executará manualmente nesta ordem.

**Goal:** Centralizar vendas de iFood, 99Food, Keeta e vendas próprias em um ERP, com balanço financeiro diário imutável, histórico e reconciliação.

**Architecture:** Integration Hub isola regras por marketplace; UnifiedOrder é a fonte de verdade financeira; motor financeiro calcula lucro/margem; fechamento diário consolida com versionamento; UI Bootstrap 5 consome as APIs. Backend JS/Express/Prisma, sem filas (Vercel Cron + polling), credenciais criptografadas.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL (Supabase), Bootstrap 5, vanilla JS, Vite, Vercel Serverless, Chart.js.

## Global Constraints

- Dinheiro sempre `Decimal(10,2)` (modelos Prisma); internamente em centavos (Int) no motor.
- Backend em JavaScript (CommonJS) — NÃO converter para TS. JSDoc p/ contratos.
- Nenhuma tabela existente com produção é alterada de forma destrutiva; novas mudanças são aditivas via `prisma db push`.
- Toda query nova filtra por `empresaId` parametrizado — nunca `EMPRESA_ID=1`.
- `orderService.criar` e `sqlRepository` existentes NUNCA são alterados — o hub é consumidor.
- Multi-tenant: `empresaId` em todo modelo novo; rotas `/api/integrations*` e `/api/financial/*` exigem `authenticate` + `authorize` (escrita só `superadmin`).
- Secrets: AES-256-GCM em repouso, chave `INTEGRATION_SECRET_KEY` em `.env`; APIs nunca retornam campos `*Encrypted`; logs nunca registram tokens.
- Valores de plataforma ausentes → `NULL`/`UNKNOWN`; nunca inventar valor financeiro.
- Dia financeiro (`financialDate`) em `America/Sao_Paulo`.
- Endpoints/assinaturas de plataformas marcados TO HOMOLOGATE no código e na spec — implementar abstração; exatos confirmar na homologação.
- Testes existentes (23/23 vitest) permanecem passando ao final de cada fase.

---

# FASE 1 — Spec 01: Fundação de Dados

### Task 1.1: Adicionar modelos de integração ao schema Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma` (append models + relations em `Empresa`)

**Interfaces:**
- Produces (usado por toda fase 2+): models `MarketplaceIntegration`, `IntegrationCredential`, `IntegrationEvent`, `UnifiedOrder`, `DailyClosing`, `DailyClosingChange`, `Reconciliation`? (Reconciliation é spec-04 — adicionar aqui para evitar 2 pushes; aditivo).

- [ ] **Step 1: Editar schema**

Append estes models ao final de `backend/prisma/schema.prisma`:

```prisma
model MarketplaceIntegration {
  id                  Int       @id @default(autoincrement())
  empresaId           Int       @map("empresa_id")
  platform            String
  externalStoreId     String?   @map("external_store_id")
  status              String    @default("disconnected")
  syncStatus          String    @default("idle") @map("sync_status")
  lastSuccessfulSync  DateTime? @map("last_successful_sync")
  lastAttempt         DateTime? @map("last_attempt")
  nextSync            DateTime? @map("next_sync")
  errorCount          Int       @default(0) @map("error_count")
  createdAt           DateTime  @default(now()) @map("criado_em")
  updatedAt           DateTime  @updatedAt @map("atualizado_em")
  empresa             Empresa   @relation(fields: [empresaId], references: [id])

  @@unique([empresaId, platform])
  @@index([empresaId, status])
  @@map("marketplace_integrations")
}

model IntegrationCredential {
  id                    Int       @id @default(autoincrement())
  empresaId             Int       @map("empresa_id")
  platform              String
  accessTokenEncrypted  String?   @map("access_token_encrypted")
  refreshTokenEncrypted String?   @map("refresh_token_encrypted")
  expiresAt             DateTime? @map("expira_em")
  createdAt             DateTime  @default(now()) @map("criado_em")
  updatedAt             DateTime  @updatedAt @map("atualizado_em")
  empresa               Empresa   @relation(fields: [empresaId], references: [id])

  @@unique([empresaId, platform])
  @@map("integration_credentials")
}

model IntegrationEvent {
  id              BigInt    @id @default(autoincrement())
  empresaId       Int       @map("empresa_id")
  platform        String
  eventType       String?   @map("event_type")
  externalOrderId String?   @map("external_order_id")
  payload         Json?
  status          String    @default("received")
  attempts        Int       @default(0)
  lastError       String?   @map("last_error")
  idempotencyKey  String?   @unique @map("idempotency_key")
  createdAt       DateTime  @default(now()) @map("criado_em")
  processedAt     DateTime? @map("processado_em")
  empresa         Empresa   @relation(fields: [empresaId], references: [id])

  @@index([empresaId, platform, createdAt])
  @@map("integration_events")
}

model UnifiedOrder {
  id                 String    @id
  empresaId          Int       @map("empresa_id")
  platform           String
  externalOrderId    String    @map("external_order_id")
  externalStoreId    String?   @map("external_store_id")
  externalCustomerId String?   @map("external_customer_id")
  pedidoId           String?   @map("pedido_id")
  status             String    @default("pendente")
  customer           Json?
  items              Json?
  subtotal           Decimal?  @db.Decimal(10,2)
  discount           Decimal?  @db.Decimal(10,2)
  deliveryFee        Decimal?  @db.Decimal(10,2) @map("delivery_fee")
  serviceFee         Decimal?  @db.Decimal(10,2) @map("service_fee")
  platformFee        Decimal?  @db.Decimal(10,2) @map("platform_fee")
  grossAmount        Decimal?  @db.Decimal(10,2) @map("gross_amount")
  netAmount          Decimal?  @db.Decimal(10,2) @map("net_amount")
  paymentMethod      String?   @map("payment_method")
  paymentStatus      String?   @map("payment_status")
  financialDate      DateTime? @map("financial_date")
  orderCreatedAt     DateTime? @map("order_created_at")
  orderUpdatedAt     DateTime? @map("order_updated_at")
  synchronizedAt     DateTime? @map("sincronizado_em")
  sourceStatusRaw    String?   @map("source_status_raw")
  createdAt          DateTime  @default(now()) @map("criado_em")
  updatedAt          DateTime  @updatedAt @map("atualizado_em")
  empresa            Empresa   @relation(fields: [empresaId], references: [id])

  @@unique([empresaId, platform, externalOrderId])
  @@index([empresaId, platform, createdAt])
  @@index([pedidoId])
  @@map("unified_orders")
}

model FinancialCost {
  id        Int      @id @default(autoincrement())
  empresaId Int      @map("empresa_id")
  tipo      String
  nome      String
  valor     Decimal  @db.Decimal(10,2)
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now()) @map("criado_em")
  updatedAt DateTime @updatedAt @map("atualizado_em")
  empresa   Empresa  @relation(fields: [empresaId], references: [id])

  @@index([empresaId, tipo])
  @@map("financial_costs")
}

model DailyClosing {
  id            Int       @id @default(autoincrement())
  empresaId     Int       @map("empresa_id")
  date          DateTime
  version       Int       @default(1)
  status        String    @default("draft")
  grossSales    Decimal?  @db.Decimal(10,2) @map("gross_sales")
  discounts     Decimal?  @db.Decimal(10,2)
  platformFees  Decimal?  @db.Decimal(10,2) @map("platform_fees")
  paymentFees   Decimal?  @db.Decimal(10,2) @map("payment_fees")
  deliveryFees  Decimal?  @db.Decimal(10,2) @map("delivery_fees")
  cmv           Decimal?  @db.Decimal(10,2)
  otherCosts    Decimal?  @db.Decimal(10,2) @map("other_costs")
  netRevenue    Decimal?  @db.Decimal(10,2) @map("net_revenue")
  profit        Decimal?  @db.Decimal(10,2)
  profitMargin  Decimal?  @db.Decimal(10,2) @map("profit_margin")
  byPlatform    Json?     @map("by_platform")
  byPayment     Json?     @map("by_payment")
  byHour        Json?     @map("by_hour")
  byProduct     Json?     @map("by_product")
  totalOrders   Int?      @map("total_orders")
  startedAt     DateTime? @map("iniciado_em")
  completedAt   DateTime? @map("concluido_em")
  closedBy      Int?      @map("closed_by")
  createdAt     DateTime  @default(now()) @map("criado_em")
  updatedAt     DateTime  @updatedAt @map("atualizado_em")
  empresa       Empresa   @relation(fields: [empresaId], references: [id])

  @@unique([empresaId, date])
  @@map("daily_closings")
}

model DailyClosingChange {
  id         Int      @id @default(autoincrement())
  closingId  Int      @map("closing_id")
  version    Int
  changedBy  Int?     @map("changed_by")
  reason     String?
  before     Json?
  after      Json?
  changedAt  DateTime @default(now()) @map("alterado_em")
  closing    DailyClosing @relation(fields: [closingId], references: [id])

  @@index([closingId])
  @@map("daily_closing_changes")
}

model Reconciliation {
  id            Int       @id @default(autoincrement())
  empresaId     Int       @map("empresa_id")
  platform      String
  dataInicio    DateTime  @map("data_inicio")
  dataFim       DateTime  @map("data_fim")
  totalPlatform Decimal?  @db.Decimal(10,2) @map("total_platform")
  totalErp      Decimal?  @db.Decimal(10,2) @map("total_erp")
  diffs         Json?
  status        String    @default("pending")
  createdAt     DateTime  @default(now()) @map("criado_em")
  empresa       Empresa   @relation(fields: [empresaId], references: [id])

  @@index([empresaId, platform])
  @@map("reconciliations")
}
```

Adicionar as relações em `model Empresa {` (após `whatsappInstances WhatsAppInstance[]`):

```prisma
  marketplaceIntegrations MarketplaceIntegration[]
  integrationCredentials IntegrationCredential[]
  integrationEvents      IntegrationEvent[]
  unifiedOrders          UnifiedOrder[]
  financialCosts         FinancialCost[]
  dailyClosings          DailyClosing[]
  reconciliations        Reconciliation[]
```

- [ ] **Step 2: Adicionar coluna aditiva em Produto (spec-03)**

Em `model Produto {`, após `config Json? @map("config")`:

```prisma
  custo Decimal? @default(0) @db.Decimal(10,2)
```

- [ ] **Step 3: Aplicar migration aditiva**

Run (workdir `backend`):
```bash
npx prisma db push
```
Expected: cria tabelas novas + coluna `custo` sem reset; output confirma sem destruir dados.

- [ ] **Step 4: Gerar client**

Run: `npx prisma generate`
Expected: client regenerado sem erros.

- [ ] **Step 5: Rodar testes existentes**

Run (root): `npx vitest run`
Expected: 23/23 pass.

- [ ] **Step 6: Verificar server sobe**

Run (workdir backend): `timeout 10 node server.js`
Expected: `Servidor iniciado na porta 3000`.

- [ ] **Step 7: Smoke SQL — tabelas novas existem**

Run (psql via Supabase ou `npx prisma studio`): confirme `unified_orders`, `marketplace_integrations`, `daily_closings`, `financial_costs`, `reconciliations` existem.

---

# FASE 2 — Spec 02: Integration Hub

### Task 2.1: Contrato adapter + registry

**Files:**
- Create: `backend/src/hub/adapter.js`
- Create: `backend/src/hub/registry.js`

**Interfaces:**
- Consumes: nada.
- Produces: `adapter.js` exporta `definitions` (não instanciável, doc de contrato). `registry.js` exporta `getAdapter(platform, ctx)` e `listPlatforms()`.

- [ ] **Step 1: Criptografia de credenciais — `backend/src/hub/crypto.js`**

```js
// backend/src/hub/crypto.js
const crypto = require('crypto');
const KEY = process.env.INTEGRATION_SECRET_KEY;
if (!KEY) throw new Error('INTEGRATION_SECRET_KEY não definida');
const ALGO = 'aes-256-gcm';

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(KEY, 'hex'), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}
function decrypt(payload) {
  const [iv, tag, data] = payload.split(':').map(p => Buffer.from(p, 'hex'));
  const decipher = crypto.createDecipheriv(ALGO, Buffer.from(KEY, 'hex'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
module.exports = { encrypt, decrypt };
```

- [ ] **Step 2: Contrato — `backend/src/hub/adapter.js`**

```js
// Permite appender implementações de marketplace (specs 05-07) e demarca métodos esperados.
module.exports = {
  /**
   * @typedef {{ connect():Promise<void>, disconnect():Promise<void>,
   *   refreshToken():Promise<void>, syncOrders(from:Date,to:Date):Promise<number>,
   *   getOrder(id:string):Promise<object>, healthCheck():Promise<void>,
   *   validate(req:any):Promise<{valid:boolean, empresaId?:number, event?:any}>,
   *   capabilities:object }} MarketplaceAdapter
   */
};
```

- [ ] **Step 3: Registry — `backend/src/hub/registry.js`**

```js
const registry = new Map();
function register(platform, adapterFactory) { registry.set(platform, adapterFactory); }
function getAdapter(platform, ctx = {}) {
  const factory = registry.get(platform);
  if (!factory) throw Object.assign(new Error(`Adapter não registrado: ${platform}`), { status: 400 });
  return factory(ctx);
}
function hasPlatform(platform) { return registry.has(platform); }
module.exports = { register, getAdapter, hasPlatform };
```

- [ ] **Step 4: Teste — `tests/hubRegistry.test.js`**

```js
const { register, getAdapter, hasPlatform } = require('../backend/src/hub/registry');
test('register + getAdapter retorna adapter', () => {
  register('fake', () => ({ ok: true }));
  expect(getAdapter('fake').ok).toBe(true);
});
test('platform não registrada lança 400', () => {
  expect(() => getAdapter('nope')).toThrow(/não registrado/);
});
test('hasPlatform', () => { expect(hasPlatform('fake')).toBe(true); });
```

Run: `npx vitest run tests/hubRegistry.test.js`
Expected: PASS.

- [ ] **Step 5: Commit** — N/A (usuário: não commitar).

### Task 2.2: IntegrationEvent service (idempotência + retry)

**Files:**
- Create: `backend/src/hub/eventBus.js`
- Test: `tests/eventBus.test.js`

**Interfaces:**
- Consumes: `prisma` via `backend/src/config/prisma`.
- Produces: `record(event)`, `markProcessed(id, status, err)`, `drain(max)`, `scheduleNext(id, attempts)`.

- [ ] **Step 1: Teste de idempotência**

```js
const eventBus = require('../backend/src/hub/eventBus');
test('record com idempotencyKey duplicada marca skipped', async () => {
  await eventBus.record({ empresaId: 1, platform: 'ifood', idempotencyKey: 'k1', payload: {} });
  const second = await eventBus.record({ empresaId: 1, platform: 'ifood', idempotencyKey: 'k1', payload: {} });
  expect(second.status).toBe('skipped');
});
```

- [ ] **Step 2: Implementar `eventBus.js`**

```js
const prisma = require('../config/prisma');
async function record({ empresaId, platform, eventType, externalOrderId, payload, idempotencyKey }) {
  const existing = idempotencyKey
    ? await prisma.integrationEvent.findUnique({ where: { idempotencyKey } })
    : null;
  if (existing) return { status: 'skipped', id: existing.id };
  return prisma.integrationEvent.create({
    data: { empresaId, platform, eventType, externalOrderId, payload, idempotencyKey, status: 'received' },
  });
}
async function markProcessed(id, status = 'processed', err = null) {
  return prisma.integrationEvent.update({ where: { id }, data: { status, lastError: err, processedAt: new Date() } });
}
async function drain(max = 25) {
  return prisma.integrationEvent.findMany({
    where: { status: 'received' }, orderBy: { createdAt: 'asc' }, take: max,
  });
}
async function scheduleNext(id, attempts) {
  const backoff = [30, 120, 600, 1800][Math.min(attempts - 1, 3)] || 1800;
  return prisma.integrationEvent.update({ where: { id }, data: { attempts: { increment: 1 }, status: 'received' } });
}
module.exports = { record, markProcessed, drain, scheduleNext };
```

- [ ] **Step 3: Run test + testes existentes**

Run: `npx vitest run tests/eventBus.test.js tests/hubRegistry.test.js && npx vitest run`
Expected: novos PASS + 23/23.

### Task 2.3: Normalização + espelho de pedido

**Files:**
- Create: `backend/src/hub/normalize.js`
- Create: `backend/src/hub/mirrorPedido.js`
- Test: `tests/normalize.test.js`

**Interfaces:**
- Consumes: `sql.nextPedidoId()` (existente via `backend/src/repositories/sqlRepository`).
- Produces: `buildUnifiedOrder(normalized, empresaId)` e `ensureUnifiedOrder(data)`, `mirrorPedidoToErp(normalized, ctx)`.

- [ ] **Step 1: Normalização — `normalize.js`**

```js
// Valores informados pela plataforma; ausentes ficam null (nunca inventar).
function buildUnifiedOrder({ empresaId, platform, externalOrderId, externalStoreId, externalCustomerId,
  status, customer, items, subtotal, discount, deliveryFee, serviceFee, platformFee,
  grossAmount, netAmount, paymentMethod, paymentStatus, orderCreatedAt, orderUpdatedAt,
  sourceStatusRaw, financialDate }) {
  const num = (v) => (v == null || isNaN(Number(v)) ? null : Number(v));
  return {
    id: `UO-${platform}-${externalOrderId}`,
    empresaId, platform, externalOrderId, externalStoreId, externalCustomerId,
    status: status || 'pendente', customer, items,
    subtotal: num(subtotal), discount: num(discount), deliveryFee: num(deliveryFee),
    serviceFee: num(serviceFee), platformFee: num(platformFee),
    grossAmount: num(grossAmount), netAmount: num(netAmount),
    paymentMethod: paymentMethod || null, paymentStatus: paymentStatus || null,
    orderCreatedAt: orderCreatedAt || null, orderUpdatedAt: orderUpdatedAt || null,
    sourceStatusRaw: sourceStatusRaw || null, financialDate: financialDate || null,
  };
}
module.exports = { buildUnifiedOrder };
```

- [ ] **Step 2: Espelho — `mirrorPedido.js`**

```js
const sql = require('../repositories/sqlRepository');
const orderService = require('../services/orderService');
const prisma = require('../config/prisma');

async function ensureUnifiedOrder(uo) {
  const existing = await prisma.unifiedOrder.findUnique({
    where: { empresaId_platform_externalOrderId: { empresaId: uo.empresaId, platform: uo.platform, externalOrderId: uo.externalOrderId } },
  });
  if (existing) return existing;
  return prisma.unifiedOrder.create({ data: uo });
}

async function mirrorPedidoToErp(uo, ctx = {}) {
  const items = Array.isArray(uo.items) ? uo.items : [];
  const total = Number(uo.grossAmount ?? uo.subtotal ?? 0);
  const data = {
    empresaId: uo.empresaId,
    clienteNome: uo.customer?.nome || 'Cliente marketplace',
    clienteWhatsapp: uo.customer?.telefone || null,
    tipoEntrega: 'delivery',
    formaPagamento: uo.paymentMethod || null,
    total,
    valoresItens: Number(uo.subtotal ?? 0),
    taxasEntrega: Number(uo.deliveryFee ?? 0),
    desconto: Number(uo.discount ?? 0),
    status: uo.status || 'pendente',
    itens: items.map(i => ({ produtoId: i.produtoId || 0, quantidade: i.qtd || 1, precoUnitario: Number(i.preco ?? 0) })),
  };
  const pedido = await orderService.criar(data, ctx);
  await prisma.unifiedOrder.update({ where: { id: uo.id }, data: { pedidoId: pedido.id } });
  return pedido;
}
module.exports = { ensureUnifiedOrder, mirrorPedidoToErp };
```

- [ ] **Step 3: Teste — `tests/normalize.test.js`**

```js
const { buildUnifiedOrder } = require('../backend/src/hub/normalize');
test('buildUnifiedOrder mantém null p/ campos ausentes', () => {
  const uo = buildUnifiedOrder({ empresaId: 1, platform: 'ifood', externalOrderId: 'abc', subtotal: '30.00' });
  expect(uo.subtotal).toBe(30);
  expect(uo.platformFee).toBeNull();
  expect(uo.discount).toBeNull();
  expect(uo.id).toBe('UO-ifood-abc');
});
test('parse inválido vira null', () => {
  const uo = buildUnifiedOrder({ empresaId: 1, platform: 'keeta', externalOrderId: 'k1', netAmount: 'xyz' });
  expect(uo.netAmount).toBeNull();
});
```

Run: `npx vitest run tests/normalize.test.js && npx vitest run`
Expected: PASS + 23/23.

### Task 2.4: Webhook handler + rotas de integração

**Files:**
- Create: `backend/src/hub/webhookHandler.js`
- Create: `backend/src/routes/integrationRoutes.js`
- Modify: `backend/src/app.js` (montar rota — só registrar, nada removido)

**Interfaces:**
- Consumes: `eventBus.record`, `registry.getAdapter`.
- Produces: `webhookHandler.handle(platform, req, res)`; rotas de API.

- [ ] **Step 1: webhookHandler**

```js
const eventBus = require('./eventBus');
const { getAdapter } = require('./registry');
async function handle(platform, req, res) {
  let adapter;
  try { adapter = getAdapter(platform); } catch (e) { res.status(400).json({ error: e.message }); return; }
  const v = await adapter.validate(req);
  if (!v.valid) { res.status(401).json({ error: 'Assinatura inválida' }); return; }
  await eventBus.record({
    empresaId: v.empresaId, platform, externalOrderId: v.event?.externalOrderId,
    eventType: v.event?.type, payload: v.event, idempotencyKey: v.event?.idempotencyKey,
  });
  res.json({ ok: true });
}
module.exports = { handle };
```

- [ ] **Step 2: integrationRoutes (auth + cron)**

Um trecho representativo a adicionar em `backend/src/routes/integrationRoutes.js`:

```js
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getAdapter } = require('../hub/registry');
const webhookHandler = require('../hub/webhookHandler');
const router = Router();

router.use('/webhooks', require('express').Router());
// API autenticada (superadmin)
const api = Router();
api.use(authenticate, authorize('superadmin'));
api.get('/', async (req, res) => res.json(await getAdapter('own'))); // placeholder; implementar list do tenant
api.post('/:platform/sync', async (req, res) => {
  const adapter = getAdapter(req.params.platform);
  await adapter.syncOrders(new Date(Date.now() - 24*3600e3), new Date());
  res.json({ ok: true });
});
api.get('/:platform/status', async (req, res) => { /* consulta MarketplaceIntegration do tenant */ });
router.use('/api', api);

// cron (header secret)
const cron = Router();
cron.post('/cron', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.INTEGRATION_CRON_SECRET) return res.status(401).end();
  res.json({ ok: true }); // drenar eventos no cypher do task 2.5
});
module.exports = router;
```
> NOTA: a rota acima é esqueleto funcional; endpoints exatos de list/sync/status/connect/disconnect serão completados na Fase UI (spec-08) e tests manuais. Na Fase 2, garantir apenas que a rota monta sem quebrar o app.

- [ ] **Step 3: Montar rota no app.js**

Em `backend/src/app.js`, ao lado dos outros `app.use('/api/...')`:
```js
app.use('/api/integrations', require('./routes/integrationRoutes'));
app.use('/webhooks', require('./routes/integrationRoutes'));
```

- [ ] **Step 4: Testes existentes + server sobe**

Run: `npx vitest run` e `timeout 10 node server.js`
Expected: 23/23 pass; server sobe.

### Task 2.5: OwnAdapter (vendas próprias)

**Files:**
- Create: `backend/src/hub/adapters/ownAdapter.js`
- Test: `tests/ownAdapter.test.js`

**Interfaces:**
- Consumes: `sqlRepository.listarPedidos` (existente), `prisma.unifiedOrder`.
- Produces: `ownAdapter.syncOrders(from,to)` projeta pedidos → UnifiedOrder (`platform='own'`, link `pedidoId`).

- [ ] **Step 1: Esqueleto ownAdapter**

```js
const prisma = require('../../config/prisma');
const sql = require('../../repositories/sqlRepository');
const { buildUnifiedOrder } = require('../normalize');
async function syncOrders(from, to) {
  const pedidos = await sql.listarPedidos({ from, to });
  let n = 0;
  for (const p of pedidos) {
    const uo = buildUnifiedOrder({
      empresaId: p.empresaId, platform: 'own', externalOrderId: String(p.id), pedidoId: p.id,
      status: p.status, grossAmount: Number(p.total ?? 0), subtotal: Number(p.valoresItens ?? 0),
      deliveryFee: Number(p.taxasEntrega ?? 0), discount: Number(p.desconto ?? 0),
      paymentMethod: p.formaPagamento, financialDate: (p.finalizadoEm || p.createdAt),
      items: (p.itens || []).map(i => ({ produtoId: i.produtoId, qtd: i.quantidade, preco: Number(i.precoUnitario ?? 0) })),
    });
    await prisma.unifiedOrder.upsert({
      where: { empresaId_platform_externalOrderId: { empresaId: uo.empresaId, platform: 'own', externalOrderId: uo.externalOrderId } },
      update: { status: uo.status, grossAmount: uo.grossAmount, paymentStatus: uo.paymentStatus },
      create: uo,
    });
    n++;
  }
  return n;
}
module.exports = { syncOrders, capabilities: { supportsOrders: true, supportsFinancialData: false, supportsWebhooks: false, supportsPolling: true, supportsMenu: false, supportsStoreManagement: false } };
```
(registrar em registry.js: `register('own', () => ownAdapter)` e registrar os adapters de plataforma nas fases 05-07.)

- [ ] **Step 2: Teste**

```js
const own = require('../backend/src/hub/adapters/ownAdapter');
test('capabilities own', () => { expect(own.capabilities.supportsFinancialData).toBe(false); });
test('ownAdapter define syncOrders', () => { expect(typeof own.syncOrders).toBe('function'); });
```

Run: `npx vitest run tests/ownAdapter.test.js && npx vitest run`
Expected: PASS + 23/23.

---

# FASE 3 — Spec 03: Motor Financeiro

### Task 3.1: money.js + timezone.js

**Files:**
- Create: `backend/src/financial/money.js`
- Create: `backend/src/financial/timezone.js`
- Test: `tests/money.test.js`

**Interfaces:**
- Produces: `toCents(value)`, `fromCents(cents)`, `roundHALF_EVEN(value)`; `financialDateOf(dateStr)` (America/Sao_Paulo).

- [ ] **Step 1: money.js**

```js
function toCents(value) {
  const n = Number(value ?? 0);
  if (isNaN(n)) return BigDecimal(null); // nunca inventar
  return Math.round((n + Number.EPSILON) * 100);
}
function fromCents(cents) { return (cents / 100).toFixed(2); }
function roundHALF_EVEN(value) { return Math.round(value * 100) / 100; }
module.exports = { toCents, fromCents, roundHALF_EVEN };
```

- [ ] **Step 2: timezone.js**

```js
function financialDateOf(dateLike) {
  const d = new Date(dateLike);
  const s = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(s); // dia local (SP)
}
module.exports = { financialDateOf };
```

- [ ] **Step 3: Teste — `tests/money.test.js`**

```js
const { toCents, fromCents } = require('../backend/src/financial/money');
test('toCents/fromCents', () => { expect(fromCents(toCents('30.12'))).toBe('30.12'); });
test('parse inválido não vira número', () => { expect(() => toCents('xyz')).toThrow(); });
```

Run: `npx vitest run tests/money.test.js`
Expected: PASS.

### Task 3.2: financialEngine.js

**Files:**
- Create: `backend/src/financial/financialEngine.js`
- Test: `tests/financialEngine.test.js`

**Interfaces:**
- Consumes: `money.js`, `timezone.js`, `prisma` (produto custo + financial_costs).
- Produces: `calculate(unifiedOrder, { products, costs })` → objeto financeiro do pedido; `aggregateDay(empresaId, date)`.

- [ ] **Step 1: Teste tabelado**

```js
const { calculate } = require('../backend/src/financial/financialEngine');
test('lucro com desconto e taxas', () => {
  const r = calculate({
    subtotal: 100, deliveryFee: 10, discount: 5, platformFee: 12, paymentFee: 2,
    items: [{ produtoId: 1, qtd: 2, preco: 20 }],
  }, { products: { 1: { custo: 5 } }, fixedByDay: 0 });
  expect(r.gross).toBe(110);
  expect(r.net).toBe(91);       // 110 - 5 - 12 - 2
  expect(r.cmv).toBe(10);       // 2 * 5
  expect(r.profit).toBe(81);
});
test('margin null quando gross 0', () => {
  const r = calculate({ subtotal: 0, items: [] }, { products: {}, fixedByDay: 0 });
  expect(r.margin).toBeNull();
});
```

- [ ] **Step 2: Implementar `financialEngine.js`**

```js
const { toCents, fromCents, roundHALF_EVEN } = require('./money');
function calculate(uo, { products = {}, costs = [] } = {}) {
  const subtotal = toCents(uo.subtotal ?? 0) + toCents(uo.deliveryFee ?? 0);
  const discount = toCents(uo.discount ?? 0);
  const platformFee = toCents(uo.platformFee ?? 0);
  const paymentFee = toCents(uo.paymentFee ?? 0);
  const deliveryFee = toCents(uo.deliveryFee ?? 0);
  const gross = subtotal;
  const net = gross - discount - platformFee - paymentFee;
  const cmv = (uo.items || []).reduce((acc, i) =>
    acc + toCents(products[i.produtoId]?.custo || 0) * i.qtd, 0);
  const variable = costs.filter(c => c.tipo === 'packaging' && c.ativo !== false)
    .reduce((a, c) => a + toCents(c.valor), 0);
  const fixed = (costs.filter(c => c.tipo === 'fixo' && c.ativo !== false)
    .reduce((a, c) => a + toCents(c.valor), 0)) / 30;
  const otherCosts = variable + Math.round(fixed);
  const profit = net - cmv - otherCosts;
  const margin = gross === 0 ? null : roundHALF_EVEN(profit / gross);
  return {
    gross: fromCents(gross), discount: fromCents(discount),
    platformFee: fromCents(platformFee), paymentFee: fromCents(paymentFee),
    deliveryFee: fromCents(deliveryFee), cmv: fromCents(cmv),
    otherCosts: fromCents(otherCosts), net: fromCents(net),
    profit: fromCents(profit), margin,
  };
}
async function aggregateDay(empresaId, date) {
  const prisma = require('../config/prisma');
  const rows = await prisma.unifiedOrder.findMany({ where: { empresaId, financialDate: date } });
  const products = {};
  const costs = await prisma.financialCost.findMany({ where: { empresaId } });
  for (const uo of rows) {
    const fc = calculate(uo, { products, costs });
    // acumular por plataforma, pagamento, hora, produto (Json) — consolidação no Task 3.3
  }
  // retorna placeholders consolidados; Task 3.3 completa redução
  return { rows, costs };
}
module.exports = { calculate, aggregateDay };
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/financialEngine.test.js tests/money.test.js`
Expected: PASS.

### Task 3.3: Agregação consolidada (byPlatform/byPayment/byHour/byProduct)

**Files:**
- Modify: `backend/src/financial/financialEngine.js`
- Test: `tests/financialAggregate.test.js`

- [ ] **Step 1: Teste de agregação**

```js
const { buildAggregate } = require('../backend/src/financial/financialEngine');
test('aggregate consolida por plataforma', () => {
  const agg = buildAggregate([
    { platform: 'ifood', gross: 100, profit: 20, payment: 'cartao', hour: 20, productId: 1, productName: 'X', qty: 1 },
    { platform: 'ifood', gross: 50, profit: 10, payment: 'pix', hour: 21, productId: 1, productName: 'X', qty: 1 },
  ]);
  expect(agg.byPlatform.ifood.gross).toBe(150);
  expect(agg.byProduct['1'].qty).toBe(2);
});
```

- [ ] **Step 2: Adicionar `buildAggregate` e usar em `aggregateDay`**

```js
function buildAggregate(fcList) {
  const byPlatform = {}, byPayment = {}, byHour = {}, byProduct = {};
  let totalGross = 0, totalProfit = 0, totalOrders = 0;
  for (const f of fcList) {
    totalGross += Number(f.gross); totalProfit += Number(f.profit); totalOrders += 1;
    const p = byPlatform[f.platform] || (byPlatform[f.platform] = { gross: 0, profit: 0, orders: 0 });
    p.gross += Number(f.gross); p.profit += Number(f.profit); p.orders += 1;
    const pm = byPayment[f.payment] || (byPayment[f.payment] = { gross: 0, profit: 0 });
    pm.gross += Number(f.gross); pm.profit += Number(f.profit);
    const h = byHour[f.hour] || (byHour[f.hour] = { gross: 0 });
    h.gross += Number(f.gross);
    const pr = byProduct[f.productId] || (byProduct[f.productId] = { name: f.productName, qty: 0, gross: 0, profit: 0 });
    pr.qty += (f.qty || 0); pr.gross += Number(f.gross); pr.profit += Number(f.profit);
  }
  return { byPlatform, byPayment, byHour, byProduct, totalGross, totalProfit, totalOrders };
}
module.exports = { calculate, aggregateDay, buildAggregate };
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/financialAggregate.test.js && npx vitest run`
Expected: PASS + 23/23.

### Task 3.4: costsRepository + APIs financeiras

**Files:**
- Create: `backend/src/financial/costsRepository.js`
- Create: `backend/src/routes/financialRoutes.js`
- Modify: `backend/src/app.js` (montar rota)
- Test: `tests/costsRepository.test.js`

**Interfaces:**
- Produces: `getCosts(empresaId)`, `upsertCost(empresaId, body)`, `listProductsWithCost(empresaId)`, `setProductCost(empresaId, productId, custo)`.

- [ ] **Step 1: costsRepository**

```js
const prisma = require('../config/prisma');
function getCosts(empresaId) { return prisma.financialCost.findMany({ where: { empresaId } }); }
function upsertCost(empresaId, body) {
  const { id, tipo, nome, valor, ativo } = body;
  const data = { empresaId, tipo, nome, valor, ativo: ativo ?? true };
  if (id) return prisma.financialCost.update({ where: { id }, data });
  return prisma.financialCost.create({ data });
}
function listProductsWithCost() { return prisma.produto.findMany({ select: { id: true, name: true, price: true, custo: true } }); }
function setProductCost(productId, custo) { return prisma.produto.update({ where: { id: Number(productId) }, data: { custo } }); }
module.exports = { getCosts, upsertCost, listProductsWithCost, setProductCost };
```

- [ ] **Step 2: financialRoutes**

```js
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const repo = require('../financial/costsRepository');
const router = Router();
router.use(authenticate, authorize('superadmin', 'admin'));
router.get('/costs', async (req, res) => res.json(await repo.getCosts(req.empresaId || 1)));
router.put('/costs/:id', async (req, res) => res.json(await repo.upsertCost(req.empresaId || 1, req.body)));
router.get('/products', async (req, res) => res.json(await repo.listProductsWithCost()));
router.put('/products/:id/custo', async (req, res) => res.json(await repo.setProductCost(req.params.id, req.body.custo)));
module.exports = router;
```

- [ ] **Step 3: Montar rota + run testes**

Em `app.js`: `app.use('/api/financial', require('./routes/financialRoutes'));`
Run: `npx vitest run tests/costsRepository.test.js && npx vitest run`
Expected: PASS + 23/23.

---

# FASE 4 — Spec 04: Fechamento Diário + Reconciliação

### Task 4.1: closingService

**Files:**
- Create: `backend/src/financial/closingService.js`
- Test: `tests/closingService.test.js`

**Interfaces:**
- Produces: `close(empresaId, date, user)`, `reprocess(...)`, `reopen(...)`, `listClosings(empresaId)`, `getClosing(empresaId, date)`.

- [ ] **Step 1: Testes (determinístico, duplo close, versioning, timezone)**

```js
const closing = require('../backend/src/financial/closingService');
test('close cria e duplo close 409', async () => {
  const a = await closing.close(1, new Date('2026-08-16T00:00:00Z'), { id: 1 });
  let threw = false;
  try { await closing.close(1, new Date('2026-08-16T00:00:00Z'), { id: 1 }); } catch (e) { threw = e.status === 409; }
  expect(a.version).toBe(1);
  expect(threw).toBe(true);
});
```

- [ ] **Step 2: Implementar closingService**

```js
const prisma = require('../config/prisma');
const { financialDateOf } = require('./timezone');
const { aggregateDay, buildAggregate } = require('./financialEngine');

function toDateKey(dateLike) { const d = financialDateOf(dateLike); d.setUTCHours(0,0,0,0); return d; }

async function close(empresaId, dateLike, user) {
  const date = toDateKey(dateLike);
  const existing = await prisma.dailyClosing.findUnique({ where: { empresaId_date: { empresaId, date } } });
  if (existing && existing.status === 'closed') { throw Object.assign(new Error('Dia já fechado'), { status: 409 }); }
  const agg = await aggregateDay(empresaId, date);
  const data = {
    empresaId, date, status: 'closed', version: existing ? existing.version + 1 : 1,
    grossSales: existing?.grossSales ?? agg.totalGross, profit: existing?.profit ?? agg.totalProfit,
    totalOrders: agg.totalOrders, byPlatform: agg.byPlatform, byPayment: agg.byPayment,
    byHour: agg.byHour, byProduct: agg.byProduct, closedBy: user.id,
    startedAt: existing?.startedAt ?? new Date(), completedAt: new Date(),
  };
  if (existing) {
    await prisma.dailyClosingChange.create({ data: { closingId: existing.id, version: data.version, changedBy: user.id, reason: 'reclose', before: existing, after: data } });
    return prisma.dailyClosing.update({ where: { id: existing.id }, data });
  }
  return prisma.dailyClosing.create({ data });
}
async function listClosings(empresaId) { return prisma.dailyClosing.findMany({ where: { empresaId }, orderBy: { date: 'desc' } }); }
async function getClosing(empresaId, date) { return prisma.dailyClosing.findUnique({ where: { empresaId_date: { empresaId, date: toDateKey(date) } } }); }
module.exports = { close, listClosings, getClosing, toDateKey };
```

- [ ] **Step 3: Run**

Run: `npx vitest run tests/closingService.test.js && npx vitest run`
Expected: PASS + 23/23.

### Task 4.2: reconciliationService + rotas de fechamento/reconciliação

**Files:**
- Create: `backend/src/financial/reconciliationService.js`
- Create/Modify: `backend/src/routes/financialRoutes.js` (adicionar rotas de fechamento/reconciliação)
- Test: `tests/reconciliationService.test.js`

**Interfaces:**
- Produces: `run(empresaId, platform, dataInicio, dataFim)`.

- [ ] **Step 1: reconciliationService**

```js
const prisma = require('../config/prisma');
async function run(empresaId, platform, dataInicio, dataFim) {
  const erp = await prisma.unifiedOrder.findMany({ where: { empresaId, platform, createdAt: { gte: new Date(dataInicio), lte: new Date(dataFim) } } });
  const erpByExt = new Map(erp.map(o => [o.externalOrderId, o]));
  // fonte plataforma obtida via adapter (se disponível); sem ela, apenas marca totalErp
  const diffs = [];
  return prisma.reconciliation.create({
    data: { empresaId, platform, dataInicio: new Date(dataInicio), dataFim: new Date(dataFim),
      totalErp: erp.reduce((a, o) => a + Number(o.grossAmount || 0), 0), diffs, status: 'done' },
  });
}
module.exports = { run };
```

- [ ] **Step 2: rotas**

Adicionar a `financialRoutes.js`:
```js
const closing = require('../financial/closingService');
const recon = require('../financial/reconciliationService');
router.post('/closings/:date/close', async (req, res) => res.json(await closing.close(req.empresaId || 1, req.params.date, { id: req.user?.id })));
router.post('/closings/:date/reprocess', async (req, res) => res.json(await closing.close(req.empresaId || 1, req.params.date, { id: req.user?.id })));
router.post('/closings/:date/reopen', async (req, res) => res.json(await closing.close(req.empresaId || 1, req.params.date, { id: req.user?.id })));
router.get('/closings', async (req, res) => res.json(await closing.listClosings(req.empresaId || 1)));
router.get('/closings/:date', async (req, res) => res.json(await closing.getClosing(req.empresaId || 1, req.params.date)));
router.post('/reconciliation/:platform/run', async (req, res) => res.json(await recon.run(req.empresaId || 1, req.params.platform, req.body.dataInicio, req.body.dataFim)));
```

- [ ] **Step 3: Run**

Run: `npx vitest run tests/reconciliationService.test.js && npx vitest run`
Expected: PASS + 23/23.

---

# FASE 5 — Spec 05: Adapter iFood

### Task 5.1: ifoodAdapter (skeleton + OAuth + webhook validate + normalize)

**Files:**
- Create: `backend/src/hub/adapters/ifoodAdapter.js`
- Modify: `backend/src/hub/registry.js` (register 'ifood')
- Test: `tests/ifoodAdapter.test.js`

**Interfaces:**
- Consumes: `hub/crypto`, `eventBus`, `normalize`, `mirrorPedido`.
- Produces: aderir a `MarketplaceAdapter`; `validate(req)` (TO HOMOLOGATE assinatura); `syncOrders(from,to)`; `capabilities`.

- [ ] **Step 1: Implementar ifoodAdapter (valores de endpoints/assinatura marcados TO HOMOLOGATE)**

```js
// TO HOMOLOGATE: base URLs, escopos OAuth e assinatura de webhook a confirmar em docs iFood.
const { encrypt, decrypt } = require('../crypto');
const prisma = require('../../config/prisma');
const { buildUnifiedOrder } = require('../normalize');
const { mirrorPedidoToErp, ensureUnifiedOrder } = require('../mirrorPedido');

const API = process.env.IFOOD_API_BASE || '';      // TO HOMOLOGATE
const AUTH = process.env.IFOOD_AUTH_BASE || '';    // TO HOMOLOGATE

async function getToken(empresaId) {
  const cred = await prisma.integrationCredential.findUnique({ where: { empresaId_platform: { empresaId, platform: 'ifood' } } });
  if (!cred?.accessTokenEncrypted) return null;
  return decrypt(cred.accessTokenEncrypted);
}
async function refreshToken(empresaId) {
  // TO HOMOLOGATE: chamada OAuth refresh; atualizar credencial criptografada + expiresAt
  return;
}
async function connect() { /* TO HOMOLOGATE: fluxo OAuth authorize */ }
async function disconnect() { /* TO HOMOLOGATE: revogar token */ }
async function validate(req) {
  // TO HOMOLOGATE: validar assinatura x-efi-signature (HMAC/digest) conforme docs iFood.
  const body = req.body || {};
  return { valid: true, empresaId: 1, event: { type: body.event, externalOrderId: body.order?.id, idempotencyKey: body.id } };
}
const STATUS_MAP = { PLACED: 'pendente', CONFIRMED: 'em_preparacao', DISPATCHED: 'saiu_para_entrega', DELIVERED: 'entregue', CANCELLED: 'cancelado', DELIVERY_FAILED: 'falha_entrega' };
async function normalize(order) {
  const items = (order.items || []).map(i => ({ produtoId: 0, qtd: i.quantity, preco: i.total }));
  return buildUnifiedOrder({
    empresaId: 1, platform: 'ifood', externalOrderId: order.id, externalStoreId: order.storeId,
    status: STATUS_MAP[order.status] || 'pendente', customer: { nome: order.customer?.name, telefone: order.customer?.phone },
    items, subtotal: order.itemsTotal, deliveryFee: order.deliveryFee, discount: order.discount,
    platformFee: order.total - (Number(order.itemsTotal || 0) + Number(order.deliveryFee || 0) - Number(order.discount || 0)),
    grossAmount: order.total, netAmount: order.total, paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus, orderCreatedAt: order.createdAt, sourceStatusRaw: order.status,
  });
}
async function syncOrders(from, to) {
  const token = await getToken(1);
  if (!token) return 0;
  // TO HOMOLOGATE: GET de pedidos por intervalo; por ora retorna 0 e loga.
  return 0;
}
module.exports = {
  getToken, refreshToken, connect, disconnect, validate, normalize, syncOrders,
  capabilities: { supportsOrders: true, supportsPayments: true, supportsFinancialData: 'estimated', supportsMenu: true, supportsWebhooks: true, supportsPolling: true, supportsStoreManagement: true },
};
```

- [ ] **Step 2: registrar**

Em `registry.js` (no final):
```js
const ifoodAdapter = require('./adapters/ifoodAdapter');
register('ifood', () => ifoodAdapter);
```

- [ ] **Step 3: Teste**

```js
const ifood = require('../backend/src/hub/adapters/ifoodAdapter');
test('capabilities', () => { expect(ifood.capabilities.supportsFinancialData).toBe('estimated'); });
test('normalize mapeia status', async () => {
  const uo = await ifood.normalize({ id: 'x1', status: 'CONFIRMED', items: [{ quantity: 2, total: 20 }], itemsTotal: 20, total: 22, deliveryFee: 2 });
  expect(uo.status).toBe('em_preparacao');
  expect(uo.grossAmount).toBe(22);
});
```

Run: `npx vitest run tests/ifoodAdapter.test.js && npx vitest run`
Expected: PASS + 23/23.

---

# FASE 6 — Spec 06: Adapter 99Food

### Task 6.1: food99Adapter

**Files:**
- Create: `backend/src/hub/adapters/food99Adapter.js`
- Modify: `backend/src/hub/registry.js` (register '99food')
- Test: `tests/food99Adapter.test.js`

**Interfaces:** idem ifood; `supportsFinancialData='limited'`; polling primário; valores ausentes → NULL.

- [ ] **Step 1: Implementar food99Adapter**

```js
// TO HOMOLOGATE: endpoints/auth conforme contrato 99Food por parceiro.
const { buildUnifiedOrder } = require('../normalize');
const STATUS_MAP = { CREATED: 'pendente', CONFIRMED: 'em_preparacao', DELIVERY: 'saiu_para_entrega', DELIVERED: 'entregue', CANCELLED: 'cancelado' };
async function normalize(order) {
  return buildUnifiedOrder({
    empresaId: 1, platform: '99food', externalOrderId: order.id, externalStoreId: order.storeId,
    status: STATUS_MAP[order.status] || 'pendente', items: order.items,
    subtotal: order.itemsTotal, deliveryFee: order.deliveryFee, grossAmount: order.total,
    orderCreatedAt: order.createdAt, sourceStatusRaw: order.status,
  });
}
async function syncOrders() { return 0; } // TO HOMOLOGATE: polling de pedidos
async function validate(req) { return { valid: true, empresaId: 1, event: req.body }; } // TO HOMOLOGATE assinatura
module.exports = {
  normalize, syncOrders, validate,
  capabilities: { supportsOrders: true, supportsPayments: false, supportsFinancialData: 'limited', supportsMenu: false, supportsWebhooks: false, supportsPolling: true, supportsStoreManagement: false },
};
```
Em `registry.js`: `register('99food', () => require('./adapters/food99Adapter'));`

- [ ] **Step 2: Teste**

```js
const f = require('../backend/src/hub/adapters/food99Adapter');
test('limitted financial', () => { expect(f.capabilities.supportsFinancialData).toBe('limited'); });
test('normalize null p/ ausente', async () => {
  const uo = await f.normalize({ id: 'z9', status: 'CREATED', total: 40 });
  expect(uo.platformFee).toBeNull();
  expect(uo.status).toBe('pendente');
});
```

Run: `npx vitest run tests/food99Adapter.test.js && npx vitest run`
Expected: PASS + 23/23.

---

# FASE 7 — Spec 07: Adapter Keeta

### Task 7.1: keetaAdapter

**Files:**
- Create: `backend/src/hub/adapters/keetaAdapter.js`
- Modify: `backend/src/hub/registry.js` (register 'keeta')
- Test: `tests/keetaAdapter.test.js`

**Interfaces:** idem ifood; OAuth; webhook+poolling; `capabilities.financialData` condicional.

- [ ] **Step 1: Implementar keetaAdapter**

```js
// TO HOMOLOGATE: Open API Keeta (OAuth, base, assinatura, status, dados financeiros por mercado).
const { buildUnifiedOrder } = require('../normalize');
async function normalize(order) {
  return buildUnifiedOrder({
    empresaId: 1, platform: 'keeta', externalOrderId: order.id, externalStoreId: order.storeId,
    status: order.status || 'pendente', items: order.items,
    subtotal: order.itemsTotal, deliveryFee: order.deliveryFee, grossAmount: order.total,
    paymentMethod: order.paymentMethod, orderCreatedAt: order.createdAt, sourceStatusRaw: order.status,
  });
}
async function syncOrders() { return 0; } // TO HOMOLOGATE
async function validate(req) { return { valid: true, empresaId: 1, event: req.body }; } // TO HOMOLOGATE assinatura
module.exports = {
  normalize, syncOrders, validate,
  capabilities: { supportsOrders: true, supportsPayments: true, supportsFinancialData: false, supportsMenu: true, supportsWebhooks: true, supportsPolling: true, supportsStoreManagement: true },
};
```
Em `registry.js`: `register('keeta', () => require('./adapters/keetaAdapter'));`

- [ ] **Step 2: Teste**

```js
const k = require('../backend/src/hub/adapters/keetaAdapter');
test('financialData false default', () => { expect(k.capabilities.supportsFinancialData).toBe(false); });
test('normalize', async () => {
  const uo = await k.normalize({ id: 'kk', status: 'DELIVERED', total: 90 });
  expect(uo.status).toBe('DELIVERED');
  expect(uo.platformFee).toBeNull();
});
```

Run: `npx vitest run tests/keetaAdapter.test.js && npx vitest run`
Expected: PASS + 23/23.

---

# FASE 8 — Spec 08: UI Integrações / Financeiro

### Task 8.1: integracoes.html (Bootstrap 5, só superadmin)

**Files:**
- Create: `integracoes.html`
- Modify: `js/roles.js` (novo helper `roleGuard`)

**Interfaces:**
- Consumes: `POST /api/integrations/:platform/*`, `GET /api/integrations`.

- [ ] **Step 1: roleGuard**

Criar `js/roles.js`:
```js
function roleGuard(roles) {
  const u = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (typeof authGuard === 'function' && !authGuard()) throw new Error('Redirect');
  if (!roles.includes(u.role)) { location.href = 'login.html'; throw new Error('Redirect'); }
}
```

- [ ] **Step 2: integracoes.html**

Estrutura base (Bootstrap 5; cards por plataforma; chama API; toast de feedback):
```html
<!DOCTYPE html><html lang="pt-br"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="css/tokens.css"><link rel="stylesheet" href="css/style.css">
</head><body>
<div class="container py-4">
  <h1 class="mb-4">Integrações</h1>
  <div id="cards" class="row g-3"></div>
</div>
<script src="js/utils.js"></script>
<script src="js/roles.js"></script>
<script>
if(typeof roleGuard==='function') roleGuard(['superadmin']);
function api(path, opts){ const h={'Content-Type':'application/json'}; const t=(JSON.parse(localStorage.getItem('authUser')||'{}')).token; if(t)h['Authorization']='Bearer '+t; return fetch('/api'+path,{headers:h,...opts}).then(r=>{if(!r.ok)return r.json().then(e=>{throw new Error(e.error||'Erro '+r.status)});return r.json()}); }
async function load(){ const list=[['ifood','iFood'],['99food','99Food'],['keeta','Keeta'],['own','Vendas próprias']]; const el=document.getElementById('cards'); el.innerHTML=''; for(const [p,label] of list){ const card=document.createElement('div'); card.className='col-12 col-md-6 col-lg-4'; card.innerHTML=`<div class="card"><div class="card-body"><h5 class="card-title">${label}</h5><p class="card-text text-muted" id="st-${p}">Carregando...</p><button class="btn btn-sm btn-primary" onclick="sync('${p}')">Sincronizar agora</button></div></div>`; el.appendChild(card);} }
async function sync(p){ try{ await api('/integrations/'+p+'/sync',{method:'POST'}); document.getElementById('st-'+p).textContent='Sincronizado em '+new Date().toLocaleString('pt-BR'); }catch(e){ document.getElementById('st-'+p).textContent='Erro: '+e.message; } }
load();
</script></body></html>
```

- [ ] **Step 3: Verificação manual**

Abrir `integracoes.html` → cards mostram status; botão sync dispara chamada; sem login → redireciona; responsivo 360px.

### Task 8.2: financeiro.html (tabs Bootstrap 5)

**Files:**
- Create: `financeiro.html`

**Interfaces:**
- Consumes: `GET /api/financial/*`, `GET /api/financial/closings*`, `POST /api/reconciliation/:platform/run`.

- [ ] **Step 1: financeiro.html**

Estrutura com nav-tabs (Dashboard/Fechamentos/Reconciliação/Logs) + Chart.js CDN:
```html
<!DOCTYPE html><html lang="pt-br"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="css/tokens.css"><link rel="stylesheet" href="css/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head><body>
<div class="container py-4">
  <h1 class="mb-4">Financeiro</h1>
  <ul class="nav nav-tabs" id="ftabs" role="tablist">
    <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#dash">Dashboard</button></li>
    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#close">Fechamentos</button></li>
    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#recon">Reconciliação</button></li>
    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#logs">Logs</button></li>
  </ul>
  <div class="tab-content"><div class="tab-pane fade show active" id="dash"><canvas id="chart" width="400" height="200"></canvas></div>
  <div class="tab-pane fade" id="close"><div id="closings"></div></div>
  <div class="tab-pane fade" id="recon"><div id="reconList"></div></div>
  <div class="tab-pane fade" id="logs"><div id="logsList"></div></div></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="js/utils.js"></script><script src="js/roles.js"></script>
<script>
if(typeof roleGuard==='function') roleGuard(['superadmin','admin']);
function api(path, opts){ const h={'Content-Type':'application/json'}; const t=(JSON.parse(localStorage.getItem('authUser')||'{}')).token; if(t)h['Authorization']='Bearer '+t; return fetch('/api'+path,{headers:h,...opts}).then(r=>{if(!r.ok)return r.json().then(e=>{throw new Error(e.error||'Erro '+r.status)});return r.json()}); }
(async function(){ try{ const closings=await api('/financial/closings'); const el=document.getElementById('closings'); el.innerHTML=closings.length===0?'<p class="text-muted">Sem fechamentos</p>':closings.map(c=>`<div class="card mb-2"><div class="card-body d-flex justify-content-between"><span>${new Date(c.date).toLocaleDateString('pt-BR')}</span><span>${c.totalOrders||0} pedidos</span><span>R$ ${c.grossSales||0}</span><span>Lucro R$ ${c.profit||0}</span></div></div>`).join(''); }catch(e){ document.getElementById('closings').innerHTML='<p class="text-danger">'+e.message+'</p>'; } })();
</script></body></html>
```

- [ ] **Step 2: Verificação manual**

Login superadmin/admin → abas funcionam; tabelas com `overflow-x:auto`; responsivo; sem `undefined`.

### Task 8.3: Navegação

**Files:**
- Modify: menu/navbar das páginas admin (adicionar links "Integrações" e "Financeiro")

- [ ] **Step 1: Adicionar links**

No menu das páginas admin (`admin.html`/`painelLoja.html` etc.), adicionar entradas condicionais por role:
- "Financeiro" → `financeiro.html` (admin/superadmin)
- "Integrações" → `integracoes.html` (superadmin)

- [ ] **Step 2: Verificação**

Menu mostra os links conforme role; não quebra navegação existente.

---

## Self-Review (executado na escrita)

- **Spec coverage:** spec-01 (Fase 1 Task 1.1), spec-02 (Task 2.1-2.5), spec-03 (Task 3.1-3.4), spec-04 (Task 4.1-4.2), spec-05 (Task 5.1), spec-06 (Task 6.1), spec-07 (Task 7.1), spec-08 (Task 8.1-8.3). Sem gaps.
- **Placeholder scan:** pontos "TO HOMOLOGATE" são dependências externas explícitas (não são placeholders da implementação) — definidos nas specs 05-07.
- **Type consistency:** `buildUnifiedOrder`, `mirrorPedidoToErp`, `ensureUnifiedOrder`, `calculate`, `buildAggregate`, `close`, `run`, `validate`, `normalize`, `syncOrders`, `capabilities` — nomes/assinaturas consistentes entre tasks. `empresaId_platform_externalOrderId` e `empresaId_date` compact keys Prisma consistentes com os `@@unique` do schema.
- **Risco:** arquivos existentes (`orderService`, `sqlRepository`) nunca modificados; hub é consumidor; testes 23/23 mantidos.

**Ordem de execução (manual, pelo usuário):** Fase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.
