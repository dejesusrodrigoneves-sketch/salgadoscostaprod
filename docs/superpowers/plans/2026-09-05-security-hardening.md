# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden 13 security vulnerabilities across authentication, rate limiting, data exposure, and webhook security.

**Architecture:** Add rate limiters to unprotected endpoints, filter sensitive fields from API responses, add authentication to public webhook/callback routes, unify login error messages, add account lockout to client login, replace console.log with structured logger.

**Tech Stack:** Node.js, Express, express-rate-limit, Prisma ORM, bcryptjs, jsonwebtoken

## Global Constraints

- No commits without explicit user approval
- No new abstractions or drive-by refactors
- Edit smallest diff that works
- Re-read files before editing
- All changes in `backend/src/` unless noted

---

### Task 1: Rate Limiters (orderLimiter, proxyLimiter, refreshLimiter)

**Files:**
- Modify: `backend/src/middleware/rateLimit.js`

**Interfaces:**
- Produces: `orderLimiter`, `proxyLimiter`, `refreshLimiter` (added to existing exports)

- [ ] **Step 1: Read current rateLimit.js**

```bash
cat backend/src/middleware/rateLimit.js
```

- [ ] **Step 2: Add orderLimiter, proxyLimiter, refreshLimiter**

Edit `backend/src/middleware/rateLimit.js`:

```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas contas criadas. Tente novamente em 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Muitos pedidos. Aguarde 1 minuto antes de fazer outro pedido.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Muitas requisições ao proxy. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter, registerLimiter, orderLimiter, proxyLimiter, refreshLimiter };
```

- [ ] **Step 3: Verify exports**

```bash
node -e "const rl = require('./backend/src/middleware/rateLimit.js'); console.log(Object.keys(rl));"
```

Expected: `['authLimiter', 'apiLimiter', 'registerLimiter', 'orderLimiter', 'proxyLimiter', 'refreshLimiter']`

---

### Task 2: Apply orderLimiter to criar pedido

**Files:**
- Modify: `backend/src/routes/publicRoutes.js:19`

**Interfaces:**
- Consumes: `orderLimiter` from Task 1

- [ ] **Step 1: Read current publicRoutes.js**

```bash
cat backend/src/routes/publicRoutes.js
```

- [ ] **Step 2: Apply orderLimiter and fix comment**

Edit `backend/src/routes/publicRoutes.js` line 19:

```javascript
// ANTES:
router.post('/pedidos', controller.criarPedido); // authenticatePublic aplicado dentro do controller

// DEPOIS:
router.post('/pedidos', orderLimiter, controller.criarPedido);
```

Also add import at top of file:

```javascript
const { registerLimiter, orderLimiter } = require('../middleware/rateLimit');
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/routes/publicRoutes.js'); console.log('OK');"
```

---

### Task 3: Apply proxyLimiter to proxy routes

**Files:**
- Modify: `backend/src/routes/proxyRoutes.js`

**Interfaces:**
- Consumes: `proxyLimiter` from Task 1

- [ ] **Step 1: Read current proxyRoutes.js**

```bash
cat backend/src/routes/proxyRoutes.js
```

- [ ] **Step 2: Apply proxyLimiter**

Edit `backend/src/routes/proxyRoutes.js` — add import and apply to both routes:

```javascript
const { proxyLimiter } = require('../middleware/rateLimit');

// ANTES:
router.get('/:service', asyncHandler(async (req, res) => {
router.post('/:service', asyncHandler(async (req, res) => {

// DEPOIS:
router.get('/:service', proxyLimiter, asyncHandler(async (req, res) => {
router.post('/:service', proxyLimiter, asyncHandler(async (req, res) => {
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/routes/proxyRoutes.js'); console.log('OK');"
```

---

### Task 4: Apply refreshLimiter to auth refresh routes

**Files:**
- Modify: `backend/src/routes/authRoutes.js:12`
- Modify: `backend/src/routes/entregadorAuthRoutes.js:54`

**Interfaces:**
- Consumes: `refreshLimiter` from Task 1

- [ ] **Step 1: Read both files**

```bash
cat backend/src/routes/authRoutes.js
cat backend/src/routes/entregadorAuthRoutes.js
```

- [ ] **Step 2: Apply refreshLimiter to authRoutes.js**

Edit `backend/src/routes/authRoutes.js`:

```javascript
// ANTES:
const { authLimiter } = require('../middleware/rateLimit');
// ...
router.post('/refresh', controller.refreshToken);

// DEPOIS:
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');
// ...
router.post('/refresh', refreshLimiter, controller.refreshToken);
```

- [ ] **Step 3: Apply refreshLimiter to entregadorAuthRoutes.js**

Edit `backend/src/routes/entregadorAuthRoutes.js`:

```javascript
// ANTES:
const { authLimiter } = require('../middleware/rateLimit');
// ...
router.post('/refresh', asyncHandler(async (req, res) => {

// DEPOIS:
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');
// ...
router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
```

- [ ] **Step 4: Verify**

```bash
node -e "require('./backend/src/routes/authRoutes.js'); console.log('auth OK');"
node -e "require('./backend/src/routes/entregadorAuthRoutes.js'); console.log('entregador OK');"
```

---

### Task 5: Apply authLimiter to client login + lockout + unify messages

**Files:**
- Modify: `backend/src/routes/publicRoutes.js:13`
- Modify: `backend/src/controllers/publicController.js:192-249`

**Interfaces:**
- Consumes: `authLimiter` from Task 1

- [ ] **Step 1: Read current publicController.js loginCliente**

```bash
cat backend/src/controllers/publicController.js | head -250 | tail -60
```

- [ ] **Step 2: Apply authLimiter to client login route**

Edit `backend/src/routes/publicRoutes.js` line 13:

```javascript
// ANTES:
router.post('/clientes/login', controller.loginCliente);

// DEPOIS:
router.post('/clientes/login', authLimiter, controller.loginCliente);
```

- [ ] **Step 3: Add lockout + unify messages in publicController.js**

Edit `backend/src/controllers/publicController.js`:

At the top of the file (after requires), add:

```javascript
// Account lockout for client login
const failedClientLoginAttempts = new Map();
const CLIENT_LOCKOUT_THRESHOLD = 5;
const CLIENT_LOCKOUT_DURATION = 15 * 60 * 1000;

function isClientLockedOut(key) {
  const record = failedClientLoginAttempts.get(key);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > CLIENT_LOCKOUT_DURATION) {
    failedClientLoginAttempts.delete(key);
    return false;
  }
  return record.count >= CLIENT_LOCKOUT_THRESHOLD;
}

function recordClientFailedAttempt(key) {
  const record = failedClientLoginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  failedClientLoginAttempts.set(key, record);
}
```

Replace the `loginCliente` handler (lines 192-249):

```javascript
exports.loginCliente = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const { telefone, password } = req.body;
  if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });

  const lockoutKey = `${empId}:${telefone}`;
  if (isClientLockedOut(lockoutKey)) {
    return res.status(429).json({ error: 'Conta temporariamente bloqueada. Tente novamente em 15 minutos.' });
  }

  const base = { ...getCtx(req), module: 'clientes' };
  const cliente = await sql.buscarCliente(telefone, empId);
  if (!cliente) {
    recordClientFailedAttempt(lockoutKey);
    auditService.audit({
      ...base,
      action: 'cliente.login_failed',
      actorType: 'anon',
      actorUsername: telefone,
      severity: 'warning',
      reason: 'cliente_nao_encontrado',
    });
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  if (cliente.passwordHash && password) {
    const match = await bcrypt.compare(password, cliente.passwordHash);
    if (!match) {
      recordClientFailedAttempt(lockoutKey);
      auditService.audit({
        ...base,
        action: 'cliente.login_failed',
        actorType: 'cliente',
        actorId: cliente.id,
        actorUsername: cliente.telefone,
        targetType: 'cliente',
        targetId: cliente.id,
        severity: 'warning',
        reason: 'senha_incorreta',
      });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
  } else if (cliente.passwordHash && !password) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  failedClientLoginAttempts.delete(lockoutKey);

  const token = tokenService.gerarToken({ id: cliente.id, empresaId: empId, telefone: cliente.telefone, nome: cliente.nome });

  auditService.audit({
    ...base,
    action: 'cliente.login',
    actorType: 'cliente',
    actorId: cliente.id,
    actorUsername: cliente.telefone,
    targetType: 'cliente',
    targetId: cliente.id,
  });

  res.json({ token, cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cep: cliente.cep, pontoReferencia: cliente.pontoReferencia } });
  res.cookie('clientToken_' + empId, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });
});
```

- [ ] **Step 4: Verify**

```bash
node -e "require('./backend/src/controllers/publicController.js'); console.log('OK');"
```

---

### Task 6: Filter sensitive fields from GET /api/admin/

**Files:**
- Modify: `backend/src/controllers/adminController.js:7-10`

- [ ] **Step 1: Read current adminController.js**

```bash
cat backend/src/controllers/adminController.js | head -15
```

- [ ] **Step 2: Filter response in listar handler**

Edit `backend/src/controllers/adminController.js`:

```javascript
// ANTES:
exports.listar = asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  res.json(empresas);
});

// DEPOIS:
exports.listar = asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  const filtradas = empresas.map(function(e) {
    return {
      id: e.id, nome: e.nome, slug: e.slug, telefone: e.telefone,
      endereco: e.endereco, numero: e.numero, bairro: e.bairro,
      cidade: e.cidade, estado: e.estado, cep: e.cep,
      descricao: e.descricao, logo: e.logo, capa: e.capa,
      empresaTipo: e.empresaTipo, parentEmpresaId: e.parentEmpresaId,
      asaasOnboarded: e.asaasOnboarded, deletedAt: e.deletedAt,
      createdAt: e.createdAt,
    };
  });
  res.json(filtradas);
});
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/controllers/adminController.js'); console.log('OK');"
```

---

### Task 7: Add auth to marketplace webhooks

**Files:**
- Modify: `backend/src/routes/marketplaceWebhookRoutes.js`

- [ ] **Step 1: Read current marketplaceWebhookRoutes.js**

```bash
cat backend/src/routes/marketplaceWebhookRoutes.js
```

- [ ] **Step 2: Add token validation**

Replace entire file:

```javascript
const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const platformConnectionService = require('../services/platformConnectionService');
const config = require('../config/env');

const router = Router();

// Marketplace webhook tokens (from env)
const MARKETPLACE_TOKENS = {
  IFOOD: process.env.IFOOD_WEBHOOK_TOKEN,
  KEETA: process.env.KEETA_WEBHOOK_TOKEN,
  NINEFOOD: process.env.NINEFOOD_WEBHOOK_TOKEN,
};

function verificarMarketplaceToken(platform, token) {
  const expected = MARKETPLACE_TOKENS[platform];
  if (!expected) return false; // No token configured = reject all
  return token === expected;
}

['IFOOD', 'KEETA', 'NINEFOOD'].forEach((platform) => {
  router.post(`/${platform.toLowerCase()}`, asyncHandler(async (req, res) => {
    const token = req.headers['x-webhook-token'];
    if (!verificarMarketplaceToken(platform, token)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    const ok = await platformConnectionService.handleWebhook(platform, req.body);
    if (!ok) return res.status(503).json({ error: 'Integração não configurada' });
    res.json({ received: true });
  }));
});

module.exports = router;
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/routes/marketplaceWebhookRoutes.js'); console.log('OK');"
```

---

### Task 8: Add auth to Asaas subscription webhook

**Files:**
- Modify: `backend/src/routes/subscriptionRoutes.js:30`

- [ ] **Step 1: Read current subscriptionRoutes.js**

```bash
cat backend/src/routes/subscriptionRoutes.js
```

- [ ] **Step 2: Add token validation**

Edit `backend/src/routes/subscriptionRoutes.js`:

```javascript
// ANTES:
const { webhookAsaasController } = require('../controllers/webhookAsaasController.js');
// ...
router.post('/webhooks/asaas/subscription', webhookAsaasController);

// DEPOIS:
const { webhookAsaasController } = require('../controllers/webhookAsaasController.js');
const asaasClient = require('../services/asaasClient.js');
// ...
router.post('/webhooks/asaas/subscription', (req, res, next) => {
  const token = req.headers['asaas-access-token'];
  if (!asaasClient.verificarAutenticacao(token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}, webhookAsaasController);
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/routes/subscriptionRoutes.js'); console.log('OK');"
```

---

### Task 9: Add auth to payment status SSE

**Files:**
- Modify: `backend/src/routes/paymentRoutes.js:10`

**Interfaces:**
- Consumes: `authenticate`, `authorize` from `../middleware/auth.js`

- [ ] **Step 1: Read current paymentRoutes.js**

```bash
cat backend/src/routes/paymentRoutes.js
```

- [ ] **Step 2: Add authentication to payment status endpoint**

Edit `backend/src/routes/paymentRoutes.js`:

```javascript
// ANTES:
paymentRouter.get('/status/:pedidoId', asyncHandler(async (req, res) => {

// DEPOIS:
const { authenticate: authMiddleware, authorize } = require('../middleware/auth.js');
const sql = require('../repositories/sqlRepository.js');

paymentRouter.get('/status/:pedidoId', authMiddleware, asyncHandler(async (req, res) => {
  // Validate pedido belongs to user's empresa
  const empId = req.ctx?.empresaId || req.user?.empresaId;
  if (empId) {
    const pedido = await sql.buscarPedido(req.params.pedidoId, empId);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  }
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/routes/paymentRoutes.js'); console.log('OK');"
```

---

### Task 10: Filter payment status response

**Files:**
- Modify: `backend/src/services/paymentSetupService.js:119-127`

- [ ] **Step 1: Read current paymentSetupService.js**

```bash
cat backend/src/services/paymentSetupService.js | head -130 | tail -15
```

- [ ] **Step 2: Remove asaasSubcontaId and pixKey from getStatus response**

Edit `backend/src/services/paymentSetupService.js`:

```javascript
// ANTES:
return {
  onboarded: empresa.asaasOnboarded,
  asaasSubcontaId: empresa.asaasSubcontaId || null,
  pixKey: empresa.pixKey || null,
  pixKeyType: empresa.pixKeyType || null,
  lastSplitStatus: lastSettlement?.splitStatus || null,
  nextTransferDate,
};

// DEPOIS:
return {
  onboarded: empresa.asaasOnboarded,
  pixKeyType: empresa.pixKeyType || null,
  lastSplitStatus: lastSettlement?.splitStatus || null,
  nextTransferDate,
};
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/services/paymentSetupService.js'); console.log('OK');"
```

---

### Task 11: Error handler — hide requestId in production

**Files:**
- Modify: `backend/src/middleware/errorHandler.js:10`

- [ ] **Step 1: Read current errorHandler.js**

```bash
cat backend/src/middleware/errorHandler.js
```

- [ ] **Step 2: Conditionally hide requestId**

Edit `backend/src/middleware/errorHandler.js`:

```javascript
// ANTES:
res.status(status).json({
  error: err.message || 'Erro interno do servidor',
  ...(status === 500 && { requestId }),
});

// DEPOIS:
res.status(status).json({
  error: err.message || 'Erro interno do servidor',
  ...(status === 500 && process.env.NODE_ENV !== 'production' && { requestId }),
});
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/middleware/errorHandler.js'); console.log('OK');"
```

---

### Task 12: Webhook Asaas — console.log → logger

**Files:**
- Modify: `backend/src/controllers/webhookAsaasController.js`

- [ ] **Step 1: Read current webhookAsaasController.js**

```bash
cat backend/src/controllers/webhookAsaasController.js
```

- [ ] **Step 2: Replace console.log with logger**

Edit `backend/src/controllers/webhookAsaasController.js`:

```javascript
// ANTES (line 1):
const subscriptionService = require('../services/subscriptionService.js');
const prisma = require('../config/prisma.js').default;

// DEPOIS:
const subscriptionService = require('../services/subscriptionService.js');
const prisma = require('../config/prisma.js').default;
const logger = require('../config/logger');

// Replace all console.log/console.error:
// Line 9: console.log('[Asaas Webhook] Evento recebido:', event);
//   → logger.info('[Asaas Webhook] Evento recebido');
//
// Line 24: console.log(`[Asaas Webhook] Valor divergente:...`);
//   → logger.info('[Asaas Webhook] Valor divergente');
//
// Line 29: console.log('[Asaas Webhook] Pagamento processado...');
//   → logger.info('[Asaas Webhook] Pagamento processado');
//
// Line 43: console.log('[Asaas Webhook] Assinatura cancelada:',...);
//   → logger.info('[Asaas Webhook] Assinatura cancelada');
//
// Line 49: console.error('[Asaas Webhook] Erro:', error);
//   → logger.error('[Asaas Webhook] Erro:', error.message);
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./backend/src/controllers/webhookAsaasController.js'); console.log('OK');"
```

---

### Task 13: Full verification

- [ ] **Step 1: Start server and check no crashes**

```bash
cd backend && node -e "require('./src/app.js'); console.log('App loads OK')"
```

- [ ] **Step 2: Verify all rate limiters load**

```bash
node -e "const rl = require('./backend/src/middleware/rateLimit.js'); console.log('Exported:', Object.keys(rl).join(', ')); console.log('orderLimiter:', typeof rl.orderLimiter); console.log('proxyLimiter:', typeof rl.proxyLimiter); console.log('refreshLimiter:', typeof rl.refreshLimiter);"
```

Expected: all three are functions

- [ ] **Step 3: Verify marketplace webhook routes load**

```bash
node -e "require('./backend/src/routes/marketplaceWebhookRoutes.js'); console.log('OK');"
```

- [ ] **Step 4: Verify subscription routes load**

```bash
node -e "require('./backend/src/routes/subscriptionRoutes.js'); console.log('OK');"
```

- [ ] **Step 5: Verify payment routes load**

```bash
node -e "require('./backend/src/routes/paymentRoutes.js'); console.log('OK');"
```

- [ ] **Step 6: Verify error handler loads**

```bash
node -e "require('./backend/src/middleware/errorHandler.js'); console.log('OK');"
```

- [ ] **Step 7: Verify public controller loads**

```bash
node -e "require('./backend/src/controllers/publicController.js'); console.log('OK');"
```

---

## Summary of Changes

| Task | File | Change |
|------|------|--------|
| 1 | `rateLimit.js` | Add orderLimiter, proxyLimiter, refreshLimiter |
| 2 | `publicRoutes.js` | Apply orderLimiter to criar pedido |
| 3 | `proxyRoutes.js` | Apply proxyLimiter |
| 4 | `authRoutes.js` + `entregadorAuthRoutes.js` | Apply refreshLimiter |
| 5 | `publicRoutes.js` + `publicController.js` | authLimiter + lockout + unify messages |
| 6 | `adminController.js` | Filter sensitive fields from listar |
| 7 | `marketplaceWebhookRoutes.js` | Add x-webhook-token validation |
| 8 | `subscriptionRoutes.js` | Add asaas-access-token validation |
| 9 | `paymentRoutes.js` | Add authenticate to SSE endpoint |
| 10 | `paymentSetupService.js` | Remove asaasSubcontaId/pixKey from response |
| 11 | `errorHandler.js` | Hide requestId in production |
| 12 | `webhookAsaasController.js` | console.log → logger |
| 13 | All | Full verification |
