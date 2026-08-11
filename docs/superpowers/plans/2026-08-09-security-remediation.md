# Security Remediation — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-09-security-remediation-design.md`
**Date:** 2026-08-09
**No commits** — all changes in working tree only

---

## Task 1: Ownership Middleware (NEW FILE)

**File:** `backend/src/middleware/ownership.js`

### Steps
1. Create `backend/src/middleware/ownership.js`
2. Export `requireOwnership(resourceType, idParam = 'id')` function
3. Implementation:
   ```javascript
   const sql = require('../repositories/sqlRepository');

   const fetchers = {
     pedido: (id) => sql.buscarPedido(id),
     produto: (id) => sql.buscarProduto(id),
     cliente: (id) => sql.buscarClientePorId(id),
     entregador: (id) => sql.buscarEntregador(id),
   };

   function requireOwnership(resourceType, idParam = 'id') {
     return async (req, res, next) => {
       const fetcher = fetchers[resourceType];
       if (!fetcher) return res.status(500).json({ error: 'Tipo de recurso inválido' });

       const id = req.params[idParam];
       const resource = await fetcher(id);
       if (!resource) return res.status(404).json({ error: 'Recurso não encontrado' });

       if (Number(resource.empresaId) !== Number(req.user.empresaId)) {
         return res.status(403).json({ error: 'Acesso negado' });
       }

       req.resource = resource;
       next();
     };
   }

   module.exports = { requireOwnership };
   ```
4. Verify `sql.buscarEntregador` exists — if not, add it to sqlRepository

### Verify
- File exists and exports `requireOwnership`
- No syntax errors

---

## Task 2: JWT Fallback + Payload Validation

**Files:** `backend/src/config/env.js`, `backend/src/middleware/auth.js`

### Steps
1. `env.js:5` — change:
   - FROM: `jwtSecret: process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod'`
   - TO: `jwtSecret: process.env.JWT_SECRET`
2. `auth.js` — in `authenticate()`, after `verificarToken()`:
   ```javascript
   const decoded = tokenService.verificarToken(token);
   if (!decoded.role || !['superadmin', 'admin', 'user'].includes(decoded.role)) {
     return res.status(401).json({ error: 'Token inválido' });
   }
   if (!decoded.empresaId || decoded.empresaId < 1) {
     return res.status(401).json({ error: 'Token inválido' });
   }
   if (!decoded.userId) {
     return res.status(401).json({ error: 'Token inválido' });
   }
   req.user = decoded;
   ```
3. Verify `.env` has `JWT_SECRET` set (it does: `0cf8a2e9...`)

### Verify
- `env.js` no longer has fallback string
- `auth.js` validates role, empresaId, userId

---

## Task 3: Ownership on Order Routes

**File:** `backend/src/routes/orderRoutes.js`

### Steps
1. Add `const { requireOwnership } = require('../middleware/ownership');`
2. Update routes:
   ```javascript
   router.get('/:id', authenticate, requireOwnership('pedido'), controller.buscar);
   router.patch('/:id/status', authenticate, requireOwnership('pedido'), controller.atualizarStatus);
   router.delete('/:id', authenticate, requireOwnership('pedido'), controller.deletar);
   router.post('/:id/finalizar', authenticate, requireOwnership('pedido'), controller.finalizar);
   router.patch('/:id/editar', authenticate, requireOwnership('pedido'), authorize('superadmin', 'admin', 'user'), controller.editarPedido);
   ```

### Verify
- All `:id` routes have `requireOwnership('pedido')`
- `POST /` (create) unchanged — still no auth (HIGH-3 is separate task)

---

## Task 4: Auth on Order Creation + Upload

**Files:** `backend/src/routes/orderRoutes.js`, `backend/src/routes/uploadRoutes.js`

### Steps
1. `orderRoutes.js:13` — add `authenticate`:
   - FROM: `router.post('/', controller.criar);`
   - TO: `router.post('/', authenticate, controller.criar);`
2. `uploadRoutes.js:31` — add `authenticate`:
   - FROM: `router.post('/', upload.single('file'), async (req, res, next) => {`
   - TO: Add `const { authenticate } = require('../middleware/auth');` at top, then `router.post('/', authenticate, upload.single('file'), async (req, res, next) => {`

### Verify
- `POST /api/pedidos` returns 401 without token
- `POST /api/upload` returns 401 without token

---

## Task 5: XSS escapeHtml on Admin Card

**File:** `admin.html`

### Steps
1. Locate lines 389-394 in `renderCard` function
2. Wrap each user field with `escapeHtml()`:
   ```javascript
   // Line 389: whatsapp
   <div class="info-item"><strong>Whatsapp</strong>${escapeHtml(p.cliente?.whatsapp || '-')}</div>

   // Line 390: endereco + numero
   <div class="info-item"><strong>Endereço</strong>${escapeHtml(p.cliente?.endereco || '-')}, ${escapeHtml(p.cliente?.numero || '-')}${iconeCampo(...)}</div>

   // Line 391: bairro
   <div class="info-item"><strong>Bairro</strong>${escapeHtml(p.cliente?.bairro || '-')}${iconeCampo(...)}</div>

   // Line 392: cep
   <div class="info-item"><strong>CEP</strong>${escapeHtml(p.cep || '-')}${iconeCampo(...)}</div>

   // Line 393: referencia
   <div class="info-item"><strong>Ref</strong>${escapeHtml(p.cliente?.pontoReferencia || '-')}${iconeCampo(...)}</div>

   // Line 394: pagamento
   <div class="info-item"><strong>Pagamento</strong>${escapeHtml(p.formaPagamento || '-')}${iconeCampo(...)}</div>
   ```
3. Verify `escapeHtml` function exists in scope (it does — used on line 377 for `nome`)

### Verify
- All 6 fields wrapped with `escapeHtml()`
- `nome` field still escaped (line 377 unchanged)

---

## Task 6: Proxy API Keys + Enable CSP

**File:** `backend/src/app.js`

### Steps
1. Lines 61-64 — move `/api/config` behind auth:
   ```javascript
   const { authenticate } = require('./middleware/auth');
   // ... existing code ...
   app.get('/api/config', authenticate, (req, res) => res.json({
     mapboxToken: process.env.MAPBOX_TOKEN || '',
     graphhopperKey: process.env.GRAPHHOPPER_KEY || '',
   }));
   ```
2. Line 29 — enable CSP:
   - FROM: `app.use(helmet({ contentSecurityPolicy: false }));`
   - TO: `app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "https:"] } } }));`

### Verify
- `GET /api/config` returns 401 without token
- Response headers include `content-security-policy`

---

## Task 7: Admin Auth Guard + Rate Limit + Login Errors

**Files:** `admin.html`, `backend/src/middleware/rateLimit.js`, `backend/src/services/authService.js`

### Steps
1. `admin.html` — add at top of `<script>` section (before any API calls):
   ```javascript
   if (typeof authGuard === 'function' && !authGuard()) {
     // authGuard already redirects to login.html
   }
   ```
2. `rateLimit.js` — update auth limiter:
   - FROM: `max: 10`
   - TO: `max: 5`
   - Add `skipSuccessfulRequests: true`
3. `authService.js` — unify error messages:
   - Line 28: FROM `'Usuário não encontrado'` → TO `'Credenciais inválidas'`
   - Line 44: FROM `'Senha incorreta'` → TO `'Credenciais inválidas'`
   - Keep audit log reasons unchanged (`usuario_nao_encontrado` vs `senha_incorreta`)

### Verify
- `admin.html` without token redirects to login.html
- Auth rate limit triggers at 5 attempts
- Login returns same error for wrong user and wrong password

---

## Verification Plan

After all tasks:
1. Run `node backend/tests/sqlRepository.test.js` — must pass
2. Run `npx playwright test` (if available) or manual Playwright checks:
   - CRIT: forged token → 401, cross-empresa order → 403
   - HIGH: /api/config → 401, XSS fields escaped, POST /pedidos → 401, POST /upload → 401, CSP headers present
   - MEDIUM: admin.html → redirect, rate limit at 5
   - LOW: login error unified
