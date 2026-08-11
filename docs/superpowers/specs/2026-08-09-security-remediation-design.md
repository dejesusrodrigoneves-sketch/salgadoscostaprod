# Security Remediation — SIC-IA

**Date:** 2026-08-09
**Approach:** Option B — centralized ownership middleware + phased fixes
**Scope:** 12 Playwright-confirmed vulnerabilities from security-test.md Appendix B

---

## Phases

### Phase 1: CRITICAL (2 vulns)

#### CRIT-1: JWT Fallback Removal + Payload Validation
- **File:** `backend/src/config/env.js:5`
- **Current:** `jwtSecret: process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod'`
- **Fix:** `jwtSecret: process.env.JWT_SECRET` — crash on startup if missing
- **File:** `backend/src/middleware/auth.js`
- **Fix:** After `verificarToken()`, validate decoded payload:
  - `decoded.role` must be in `['superadmin', 'admin', 'user']`
  - `decoded.empresaId` must be a positive integer
  - `decoded.userId` must exist
- Invalid → 401 "Token inválido"

#### CRIT-2: Ownership Middleware + IDOR Fix
- **New file:** `backend/src/middleware/ownership.js`
- **Pattern:** `requireOwnership(resourceType, idParam = 'id')`
  1. Fetch resource by `req.params[idParam]` via repository
  2. Compare `req.user.empresaId` with `resource.empresaId`
  3. If mismatch → 403 "Acesso negado"
  4. Inject resource into `req.resource` for downstream use
- **Supported types:** `pedido`, `produto`, `cliente`, `entregador`
- **Integration:**
  - `GET /:id` — `requireOwnership('pedido')`
  - `PATCH /:id/status` — `requireOwnership('pedido')`
  - `DELETE /:id` — `requireOwnership('pedido')`
  - `POST /:id/finalizar` — `requireOwnership('pedido')`
  - `PATCH /:id/editar` — `requireOwnership('pedido')` (keeps existing `authorize`)

### Phase 2: HIGH (5 vulns)

#### HIGH-1: Proxy API Keys Behind Auth
- **File:** `backend/src/app.js:61-64`
- **Current:** `GET /api/config` public, exposes Mapbox + GraphHopper keys
- **Fix:** Move to authenticated route or remove entirely
- Frontend reads keys from backend-proxied endpoint with token

#### HIGH-2: XSS — escapeHtml on 6 Fields
- **File:** `admin.html:389-394`
- **Current:** 6 user-controlled fields rendered without `escapeHtml()`
- **Fix:** Wrap each with `escapeHtml()`:
  - `p.cliente?.whatsapp` (line 389)
  - `p.cliente?.endereco`, `p.cliente?.numero` (line 390)
  - `p.cliente?.bairro` (line 391)
  - `p.cep` (line 392)
  - `p.cliente?.pontoReferencia` (line 393)
  - `p.formaPagamento` (line 394)

#### HIGH-3: Auth on Order Creation
- **File:** `backend/src/routes/orderRoutes.js:13`
- **Current:** `router.post('/', controller.criar)` — no auth
- **Fix:** Add `authenticate` middleware
- **Impact:** `balcao.html` must send token (login required before order)

#### HIGH-4: Auth on Upload
- **File:** `backend/src/routes/uploadRoutes.js:31`
- **Current:** No auth on `POST /`
- **Fix:** Add `authenticate` middleware
- Admin.html already stores token in localStorage

#### HIGH-5: Enable CSP Headers
- **File:** `backend/src/app.js:29`
- **Current:** `helmet({ contentSecurityPolicy: false })`
- **Fix:** Enable CSP with directives:
  ```
  defaultSrc: ["'self'"]
  scriptSrc: ["'self'"]
  styleSrc: ["'self'", "'unsafe-inline'"]
  imgSrc: ["'self'", "data:", "https:"]
  ```

### Phase 3: MEDIUM + LOW (3 vulns)

#### MED-1: Admin Auth Guard
- **File:** `admin.html` (top of script)
- **Fix:** Call `authGuard()` before loading orders
- Redirects to `login.html` if not authenticated
- Uses existing `authGuard()` from `utils.js:63-83`

#### MED-2: Rate Limit Tightening
- **File:** `backend/src/middleware/rateLimit.js`
- Auth limiter: `max: 10` → `max: 5`
- Add `skipSuccessfulRequests: true`

#### LOW-1: Generic Login Errors
- **File:** `backend/src/services/authService.js:28,44`
- **Current:** Different messages for wrong user vs wrong password
- **Fix:** Always return `"Credenciais inválidas"`
- Keep differentiated audit logs (`usuario_nao_encontrado` vs `senha_incorreta`)

---

## Files Modified

| File | Change |
|------|--------|
| `backend/src/middleware/ownership.js` | **NEW** — ownership middleware |
| `backend/src/config/env.js` | Remove JWT fallback |
| `backend/src/middleware/auth.js` | JWT payload validation |
| `backend/src/routes/orderRoutes.js` | Add `authenticate` + `requireOwnership` |
| `backend/src/routes/uploadRoutes.js` | Add `authenticate` |
| `backend/src/app.js` | Move `/api/config`, enable CSP |
| `backend/src/middleware/rateLimit.js` | Tighten limits |
| `backend/src/services/authService.js` | Generic error messages |
| `admin.html` | `escapeHtml()` on 6 fields, `authGuard()` |

---

## Testing

- Run existing 34 backend tests — all must pass
- Playwright re-test all 12 vuln scenarios:
  - CRIT: forged token rejected, ownership check blocks cross-empresa
  - HIGH: /api/config returns 401, XSS fields escaped, order creation requires auth, upload requires auth, CSP headers present
  - MEDIUM: admin.html redirects to login, rate limit at 5
  - LOW: login returns same error for both cases
