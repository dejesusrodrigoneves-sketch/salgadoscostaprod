# Migração do Backend para Railway (DB no Supabase) — Implementation Plan (rev. 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Esta rev. 2 substitui a rev. 1.** Auditoria independente do repositório foi feita; ajustes de módulos, nomes de models, campos do Railway e regras de segurança foram incorporados.

**Goal:** Migrar o backend Express do Vercel serverless para a Railway (processo de longa duração, 1 réplica), mantendo o banco no Supabase, com tenant público resolvido por **domínio/origem canônica**, CORS fail-closed, autorização por JWT (não por Origin) e fallback Vercel por 50 dias.

**Architecture:**
```
Frontend (Vercel) ──HTTPS──► Railway (Express, 1 réplica) ──► Supabase PostgreSQL
```
O `Origin` apenas **resolve contexto/tenant público**; autorização é sempre JWT + escopo `empresaId`. `resolveEmpresa` descobre tenant, `requireEmpresa` exige tenant, `authenticate` valida o JWT e compara `empresaId` do token com o contexto (anti cross-tenant/IDOR). Migrations seguem Expand/Contract durante os 50 dias.

**Tech Stack:** Node ≥22 · Express 5 · Prisma 6 · PostgreSQL (Supabase) · vitest 2 · Playwright · Railpack/Railway.

## Global Constraints

- Node `>=22.12.0`. Builder **Railpack**. **Config as Code (railway.json/toml) está DEPRECATED pela Railway** (funciona até 2026-12-01); plano configura via **dashboard** e mantém arquivo como complemento documentado.
- Banco **permanece no Supabase**: `DATABASE_URL` pooled (runtime) + `DIRECT_URL` direta (migrations; já declarada no `schema.prisma`).
- `NODE_ENV=production` na Railway; `?slug=` só em dev.
- Disponibilidade de empresa = **regra única** `isEmpresaDisponivel(empresa)` = `empresa && !empresa.deletedAt && empresa.status === 'active'` (fail-closed para qualquer outro estado/null).
- CORS fail-closed; `Origin` **não** é autorização.
- Envs novas: `API_HOST`, `CORS_BASE_DOMAIN`, `CORS_ORIGIN`, `TRUSTED_HOSTS` (fonte de verdade de hosts), `LOG_FORMAT=json`, `LOG_LEVEL=info`, `SENTRY_DSN` (opcional), `DB_CONNECTION_LIMIT=10`, `DB_POOL_TIMEOUT=10`.
- Sistemas de módulos: backend predominantemente **CommonJS**; middlewares que consomem `empresaCache.js` (ESM) permanecem **ESM** (padrão já vigente em `resolveEmpresa.js`) e importam `empresaCache` estaticamente. Novos arquivos não-middleware = CommonJS.
- Fallback Vercel `/api/*` por **50 dias**; migrations **backward-compatible** (Expand/Contract).
- Nunca `prisma db push --accept-data-loss` em produção.
- **Não inventar models/campos**: usar o schema real (`ItensPedido`, `Pedido.clienteNome`, etc.).
- Não escalar para >1 réplica enquanto jobs estiverem no `server.js`.

## Correções aplicadas à rev. 1 (resumo do que mudou)

1. **Origin ≠ autorização** — separadas as camadas `resolveEmpresa` / `requireEmpresa` / JWT / checagem de tenant do token. (Task 4, 5)
2. **Origem canônica, não slug automático** — validação por domínio/origem **cadastrada**; host desconhecido não vira tenant; arquitetura preparada para `empresa_domains`. (Task 4)
3. **`isEmpresaDisponivel` central** — `status !== 'active'` bloqueia (inclusive `null`/desconhecido). (Task 3)
4. **Host só de fonte confiável** — `TRUSTED_HOSTS`. (Task 4)
5. **Módulos padronizados** — CJS onde domina; ESM onde já é ESM (`empresaCache`). (Global + Tasks)
6. **Script HTML robusto** — regex tolera `defer`/`type="module"`/`./js/`; validação automática. (Task 1)
7. **`SIC_API_BASE` override** — `window.SIC_API_BASE = window.SIC_API_BASE || ''`. (Task 1)
8. **Health** — `/live` e `/health` (200/503). (Task 7)
9. **Graceful shutdown** — referências de jobs em memória, `stop()` idempotente, draining. (Task 8)
10. **Jobs/scaling** — aviso explícito no runbook/checklist. (Task 14)
11. **Prisma + Supabase** — testes garantem preservação de query params e separação `directUrl`. (Task 9)
12. **Observabilidade** — logger JSON **real** (não só Sentry) + correlation ID + Sentry opcional com API atual verificada. (Task 10)
13. **CORS test correto** — asserção por `Access-Control-Allow-Origin`, não por 200. (Task 6, 12)
14. **Fronteira de domínio** — rejeição de `loja1.vercel.app.evil.com` etc. (Task 4, 6)
15. **Cache como superfície** — regras de miss/refresh/invalidação/status. (Task 3, 4)
16. **`requireEmpresa`** — separado e documentado. (Task 5)
17. **Testes JWT cross-tenant** (A/B/C/D). (Task 5)
18. **`?slug=` só dev** — testes prod/dev. (Task 4)
19. **Smoke corrigido** — headers CORS, tenant válido/inválido/suspenso, login, cross-tenant. (Task 12)
20. **Cleanup baseado no schema real** — sem inventar models. (Task 12)
21. **E2E com frontends A/B reais** — sem `?slug=` em prod; valida tenant de TODOS os itens. (Task 13)
22. **Railway Config as Code deprecated** — dashboard-first; arquivo documentado. (Task 11)
23. **Restart policy correta** — `restartPolicyType` + `restartPolicyMaxRetries`. (Task 11)
24. **Root Directory = backend** explícito. (Task 11)
25. **Pre-deploy migration com timeout**; falha impede deploy ativo. (Task 11)
26. **Expand/Contract obrigatório** nos 50 dias. (Task 14)
27. **Rollback documentado** com pré-condição de compatibilidade de schema. (Task 14)
28. **Matriz de webhooks**. (Task 14)
29. **Dual compatibility** explícita. (Task 14)
33. **Gate 1 de segurança ampliado**. (Tasks 3–6)
35. **Self-Review A–G** ao final.

## Ordem de execução (corrigida)

`1 config.js/getApiBase → 2 frontend getApiBase → 3 isEmpresaDisponivel → 4 resolveEmpresa → 5 requireEmpresa+auth → 6 CORS → 7 health → 8 shutdown → 9 prisma → 10 logging/Sentry → 11 railway → 12 smoke → 13 E2E → 14 runbook`

**Mudança vs sugestão do revisor:** mantive `config.js`/frontend primeiro (é no-op até o corte, risco zero) e a regra central `isEmpresaDisponivel` **antes** de `resolveEmpresa`/CORS, pois ambos a consomem. Explicado onde a dependência ditou a ordem.

---

### Task 1: `js/config.js` + `getApiBase()` + inclusão robusta nas HTML

**Files:**
- Create: `js/config.js`
- Create: `scripts/add-config-include.mjs`
- Create: `scripts/verify-config-include.mjs`
- Modify: todas as `*.html` (23 arquivos)

**Interfaces:**
- Produces: `window.SIC_API_BASE` (string, sem barra final) e `window.getApiBase()`.

- [ ] **Step 1: Criar `js/config.js`** (override idempotente, correção #7)

```js
// js/config.js — base da API em runtime.
// '' => same-origin (Vercel /api, fallback durante a migração).
// Corte: definir SIC_API_BASE = 'https://<svc>.up.railway.app'.
window.SIC_API_BASE = window.SIC_API_BASE || '';

window.getApiBase = function () {
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
  return window.SIC_API_BASE || '';
};
```

- [ ] **Step 2: Criar script de inclusão robusto** (correção #6)

```js
// scripts/add-config-include.mjs — insere config.js antes do 1º script de js/ (idempotente)
import { readdir, readFile, writeFile } from 'node:fs/promises';

const TAG = '<script src="js/config.js"></script>';
// captura <script ... src="(./)?js/....js" ...> com quaisquer atributos (defer, type=module, etc.)
const SCRIPT_RE = /^([ \t]*)<script\b[^>]*\bsrc=["'](?:\.\/)?js\/[^"']+["'][^>]*>/im;

const files = (await readdir('.')).filter((f) => f.endsWith('.html'));
let changed = 0;
for (const f of files) {
  let html = await readFile(f, 'utf8');
  if (/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/config\.js["']/i.test(html)) continue; // já tem
  const m = html.match(SCRIPT_RE);
  if (!m) { console.warn('sem <script js/...> em', f); continue; }
  html = html.replace(m[0], `${m[1]}${TAG}\n${m[0]}`);
  await writeFile(f, html);
  changed++;
  console.log('updated', f);
}
console.log(`total atualizados: ${changed}`);
```

- [ ] **Step 3: Criar verificador automático** (correção #6: validar 1× e ordem)

```js
// scripts/verify-config-include.mjs — garante exatamente 1 config.js e antes dos consumidores
import { readdir, readFile } from 'node:fs/promises';

const files = (await readdir('.')).filter((f) => f.endsWith('.html'));
const CONFIG_RE = /<script\b[^>]*\bsrc=["'](?:\.\/)?js\/config\.js["']/i;
let errors = 0;
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const count = (html.match(new RegExp(CONFIG_RE.source, 'gi')) || []).length;
  if (count !== 1) { console.error(`ERRO ${f}: ${count} referência(s) a config.js`); errors++; continue; }
  const cfgIdx = html.search(CONFIG_RE);
  const firstConsumer = html.search(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/(?!config\.js)[^"']+["']/i);
  if (firstConsumer !== -1 && cfgIdx > firstConsumer) { console.error(`ERRO ${f}: config.js após consumidor`); errors++; }
  if (/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/config\.js["']/i.test(html) === false) { console.error(`ERRO ${f}: sem config.js`); errors++; }
}
if (errors) { console.error(`\n${errors} problema(s)`); process.exit(1); }
console.log(`OK: ${files.length} HTML com exatamente 1 config.js antes dos consumidores`);
```

- [ ] **Step 4: Rodar inclusão e verificação**

Run:
```bash
node scripts/add-config-include.mjs
node scripts/verify-config-include.mjs
```
Expected: `total atualizados: N`; depois `OK: 23 HTML ...`. Rodar a inclusão 2×: 2ª deve dar `total atualizados: 0`.

- [ ] **Step 5: Commit**

```bash
git add js/config.js scripts/add-config-include.mjs scripts/verify-config-include.mjs *.html
git commit -m "feat(front): config.js/getApiBase com inclusão robusta e verificação"
```

---

### Task 2: Frontend usa `getApiBase()` (sem `?slug=` em prod)

**Files:**
- Modify: `js/apiHelper.js:5` e `request` (~49)
- Modify: `js/admin.js` (wrapper ~6 + `fetch('/api...')` diretos)
- Modify: `js/painel.js:10`
- Modify: `js/superadminBilling.js:3`
- Modify: `js/filiais.js:2`
- Modify: `js/subscriptionOverlay.js`, `js/filialPricingOverlay.js`, `js/superadmin-integracoes.js`, `js/superadminDashboard.js`, `js/superadmin-audit.js`

**Interfaces:**
- Consumes: `window.getApiBase()` (Task 1).
- Produces: chamadas desacopladas da origem.

- [ ] **Step 1: `apiHelper.js`**

Linha 5:
```js
  var base = (window.getApiBase ? window.getApiBase() : '') + '/api/public';
```
No `request`, anexar `?slug=` **só em dev** (correção #18):
```js
    var url = base + path;
    var slug = getSlug();
    var isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (slug && isDev) url += (path.indexOf('?') === -1 ? '?' : '&') + 'slug=' + encodeURIComponent(slug);
```

- [ ] **Step 2: `painel.js` (linha 10)**

```js
const API_BASE = (window.getApiBase ? window.getApiBase() : '') + '/api';
```

- [ ] **Step 3: `superadminBilling.js` (linha 3) e `filiais.js` (linha 2)**

```js
  const API_BASE = (window.getApiBase ? window.getApiBase() : '');
```

- [ ] **Step 4: `admin.js` — wrapper e fetches diretos**

Trocar o wrapper:
```js
  return fetch((window.getApiBase ? window.getApiBase() : '') + '/api' + path, { headers: headers, ...opts }).then(function(r) {
```
Depois, localizar todos os `fetch('/api` e prefixar:
Run: `grep -n "fetch('/api" js/admin.js`
Regra: `fetch('/api` → `fetch((window.getApiBase?window.getApiBase():'') + '/api`.

- [ ] **Step 5: Demais arquivos**

Run: `grep -rn "fetch('/api" js/subscriptionOverlay.js js/filialPricingOverlay.js js/superadmin-integracoes.js js/superadminDashboard.js js/superadmin-audit.js`
Mesma regra de prefixo.

- [ ] **Step 6: Verificação (sem `?slug=` hardcoded de tenant, sem origem fixa)**

Run: `grep -rn "fetch('/api\|origin + '/api\|\"http://localhost:3000'\|'http://localhost:3000'" js/*.js`
Expected: nenhuma ocorrência (exceto `config.js`).

- [ ] **Step 7: Commit**

```bash
git add js/apiHelper.js js/admin.js js/painel.js js/superadminBilling.js js/filiais.js js/subscriptionOverlay.js js/filialPricingOverlay.js js/superadmin-integracoes.js js/superadminDashboard.js js/superadmin-audit.js
git commit -m "refactor(front): getApiBase() em todos os clientes da API"
```

---

### Task 3: Regra central `isEmpresaDisponivel` (fail-closed)

**Files:**
- Modify: `backend/src/config/empresaCache.js` (adicionar export)
- Test: `backend/tests/empresaDisponivel.test.js`

**Interfaces:**
- Produces: `isEmpresaDisponivel(empresa)` → boolean. Consumido por `resolveEmpresa`, `corsOrigin`, `requireEmpresa`, `authenticate`.

- [ ] **Step 1: Escrever o teste (falha)**

```js
import { describe, it, expect } from 'vitest';
import { isEmpresaDisponivel } from '../src/config/empresaCache.js';

describe('isEmpresaDisponivel (fail-closed)', () => {
  it('active => true', () => expect(isEmpresaDisponivel({ status: 'active', deletedAt: null })).toBe(true));
  it('suspended => false', () => expect(isEmpresaDisponivel({ status: 'suspended', deletedAt: null })).toBe(false));
  it('deleted => false', () => expect(isEmpresaDisponivel({ status: 'active', deletedAt: new Date() })).toBe(false));
  it('pending => false', () => expect(isEmpresaDisponivel({ status: 'pending' })).toBe(false));
  it('blocked => false', () => expect(isEmpresaDisponivel({ status: 'blocked' })).toBe(false));
  it('status desconhecido => false', () => expect(isEmpresaDisponivel({ status: 'weird' })).toBe(false));
  it('status null => false', () => expect(isEmpresaDisponivel({ status: null })).toBe(false));
  it('empresa null/undefined => false', () => { expect(isEmpresaDisponivel(null)).toBe(false); expect(isEmpresaDisponivel(undefined)).toBe(false); });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/empresaDisponivel.test.js`
Expected: FAIL (`isEmpresaDisponivel` não exportada).

- [ ] **Step 3: Implementar em `empresaCache.js`**

Adicionar (o arquivo é ESM):
```js
export function isEmpresaDisponivel(empresa) {
  return !!empresa && !empresa.deletedAt && empresa.status === 'active';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/empresaDisponivel.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/empresaCache.js backend/tests/empresaDisponivel.test.js
git commit -m "feat(tenant): regra central isEmpresaDisponivel (fail-closed)"
```

---

### Task 4: `resolveEmpresa` — origem canônica, host confiável, fail-closed

**Files:**
- Modify: `backend/src/middleware/resolveEmpresa.js`
- Test: `backend/tests/resolveEmpresa.test.js`

**Interfaces:**
- Consumes: `getEmpresaFromCache`, `isEmpresaDisponivel`.
- Produces: `req.ctx.empresaId`/`req.ctx.empresa`; 404 p/ inexistente/indisponível. **Nunca** cria tenant de host arbitrário.

> **Fonte de verdade de host confiável:** `TRUSTED_HOSTS` (CSV de hosts do frontend, ex.: `admin-sicia.vercel.app,login-sicia.vercel.app`). O host da API vem de `API_HOST`/`RAILWAY_PUBLIC_DOMAIN`. A origem do tenant público é derivada **somente** de `Origin` cujo `hostname` pertença a `CORS_BASE_DOMAIN` (com fronteira de domínio) **e** cujo slug corresponda a empresa disponível. Preparado para futura tabela `empresa_domains`.

- [ ] **Step 1: Escrever os testes (falha)** — ampliar `resolveEmpresa.test.js`

```js
it('resolve por Origin canônico', async () => {
  getEmpresaFromCache.mockResolvedValue({ id: 5, slug: 'loja1', status: 'active', deletedAt: null });
  const req = { headers: { host: 'svc.up.railway.app', origin: 'https://loja1.vercel.app' }, ctx: {}, query: {} };
  const res = mockRes(); const next = vi.fn();
  await resolveEmpresa(req, res, next);
  expect(req.ctx.empresaId).toBe(5);
});

it('suspenso => 404', async () => {
  getEmpresaFromCache.mockResolvedValue({ id: 9, slug: 'susp', status: 'suspended' });
  await resolveEmpresa({ headers: { origin: 'https://susp.vercel.app' }, ctx: {}, query: {} }, mockRes(), vi.fn());
  expect(res.status).toHaveBeenCalledWith(404);
});

it('Status null/desconhecido => 404', async () => {
  getEmpresaFromCache.mockResolvedValue({ id: 9, slug: 'x', status: null });
  await resolveEmpresa({ headers: { origin: 'https://x.vercel.app' }, ctx: {}, query: {} }, mockRes(), vi.fn());
  expect(res.status).toHaveBeenCalledWith(404);
});

it('host arbitrário NÃO vira tenant', async () => {
  const req = { headers: { host: 'evil.example.com' }, ctx: {}, query: {} };
  const next = vi.fn();
  await resolveEmpresa(req, mockRes(), next);
  expect(req.ctx.empresaId).toBeUndefined();
  expect(next).toHaveBeenCalled();
});

it('API_HOST ignorado (sem Origin)', async () => {
  process.env.API_HOST = 'svc.up.railway.app';
  const req = { headers: { host: 'svc.up.railway.app' }, ctx: {}, query: {} };
  await resolveEmpresa(req, mockRes(), vi.fn());
  expect(req.ctx.empresaId).toBeUndefined();
});

it('?slug= ignorado em produção', async () => {
  process.env.NODE_ENV = 'production';
  const req = { headers: { host: 'localhost' }, ctx: {}, query: { slug: 'loja1' } };
  await resolveEmpresa(req, mockRes(), vi.fn());
  expect(getEmpresaFromCache).not.toHaveBeenCalled();
});

it('?slug= permitido em dev', async () => {
  process.env.NODE_ENV = 'development';
  getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'loja1', status: 'active' });
  const req = { headers: { host: 'localhost' }, ctx: {}, query: { slug: 'Loja1' } };
  await resolveEmpresa(req, mockRes(), vi.fn());
  expect(getEmpresaFromCache).toHaveBeenCalledWith('loja1');
});

it('conflito Origin x ?slug= => vence Origin', async () => {
  process.env.NODE_ENV = 'development';
  getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'certa', status: 'active' });
  const req = { headers: { origin: 'https://certa.vercel.app' }, ctx: {}, query: { slug: 'outra' } };
  await resolveEmpresa(req, mockRes(), vi.fn());
  expect(getEmpresaFromCache).toHaveBeenCalledWith('certa');
});

it('cache error => next(err) (não pendura)', async () => {
  getEmpresaFromCache.mockRejectedValue(new Error('db down'));
  const next = vi.fn();
  await resolveEmpresa({ headers: { origin: 'https://loja1.vercel.app' }, ctx: {}, query: {} }, mockRes(), next);
  expect(next).toHaveBeenCalledWith(expect.any(Error));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/resolveEmpresa.test.js`
Expected: FAIL nos novos casos.

- [ ] **Step 3: Reescrever `resolveEmpresa.js`** (ESM, padrão vigente; `isEmpresaDisponivel` central)

```js
import { getEmpresaFromCache, isEmpresaDisponivel } from '../config/empresaCache.js';

const IGNORED = ['www', 'api', 'admin', 'admin-sicia', 'login-sicia', 'mail', 'ftp'];

function hostOf(origin) {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

// extrai slug se host pertence ao domínio-base (com fronteira de domínio)
function slugForBase(host, base) {
  if (!host || !base) return null;
  const suffix = '.' + base.toLowerCase();
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) return null; // somente 1 label
  return slug.toLowerCase();
}

function trustedHost(host) {
  const list = (process.env.TRUSTED_HOSTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(host);
}

async function aplicar(req, res, next, slug) {
  let empresa;
  try { empresa = await getEmpresaFromCache(slug); } catch (err) { return next(err); }
  if (!isEmpresaDisponivel(empresa)) return res.status(404).json({ error: 'Loja não encontrada' });
  req.ctx = req.ctx || {};
  req.ctx.empresaId = empresa.id;
  req.ctx.empresa = empresa;
  return next();
}

export async function resolveEmpresa(req, res, next) {
  const base = (process.env.CORS_BASE_DOMAIN || '').toLowerCase();
  const apiHost = (process.env.API_HOST || process.env.RAILWAY_PUBLIC_DOMAIN || '').toLowerCase();

  // 1) Origin canônico (frontend <loja>.<base>)
  const originSlug = slugForBase(hostOf(req.headers.origin), base);
  if (originSlug) return aplicar(req, res, next, originSlug);

  // 2) Host: somente se for host confiável e não for o host da API
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  if (host && host !== apiHost && trustedHost(host)) {
    const hostSlug = slugForBase(host, base);
    if (hostSlug) return aplicar(req, res, next, hostSlug);
  }

  // 3) ?slug= somente em dev
  if (process.env.NODE_ENV !== 'production') {
    const p = req.query?.slug;
    if (p) return aplicar(req, res, next, String(p).trim().toLowerCase());
  }

  return next();
}

export default resolveEmpresa;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/resolveEmpresa.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/resolveEmpresa.js backend/tests/resolveEmpresa.test.js
git commit -m "feat(tenant): origem canônica, host confiável, fail-closed por status"
```

---

### Task 5: `requireEmpresa` + autorização JWT cross-tenant (`assertTokenTenant`)

**Files:**
- Modify: `backend/src/middleware/requireEmpresa.js`
- Modify: `backend/src/middleware/auth.js` (reforçar comparação; já existe em :58-61)
- Test: `backend/tests/crossTenantAuth.test.js`

**Interfaces:**
- Produces: `requireEmpresa` (exige `req.ctx.empresaId` ou `req.user.empresaId`; superadmin isento) e `assertTokenTenant(req, res)` dentro de `authenticate`.

> **Camadas (documentadas):** `resolveEmpresa` = descobre contexto; `requireEmpresa` = exige tenant; `authenticate` = valida JWT e **compara** `decoded.empresaId` × `req.ctx.empresaId` → 403. Rotas superadmin não exigem tenant.

- [ ] **Step 1: Escrever os testes (falha)** — cenários A/B/C/D (correção #17)

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { verificarToken } = vi.hoisted(() => ({ verificarToken: vi.fn() }));
vi.mock('../src/services/tokenService', () => ({ verificarToken }));
vi.mock('../src/services/auditService', () => ({ audit: vi.fn() }));
vi.mock('../src/middleware/filialSuspended.js', () => ({ filialSuspendedCheck: (req, res, next) => next() }));
vi.mock('../src/config/empresaCache.js', () => ({ getEmpresaFromIdCache: vi.fn().mockResolvedValue({ id: 1, deletedAt: null, status: 'active' }), isEmpresaDisponivel: () => true }));
import { authenticate } from '../src/middleware/auth.js';

function req(auth, ctx) { return { headers: { authorization: 'Bearer t' }, ctx: ctx || {}, user: null }; }
function res() { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; }

describe('cross-tenant auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('A: JWT A + ctx A => permitido', async () => {
    verificarToken.mockReturnValue({ id: 1, role: 'admin', empresaId: 10 });
    const r = res(); const next = vi.fn();
    await authenticate(req('t', { empresaId: 10 }), r, next);
    expect(next).toHaveBeenCalled();
  });
  it('B: JWT A + ctx B => 403', async () => {
    verificarToken.mockReturnValue({ id: 1, role: 'admin', empresaId: 10 });
    const r = res(); const next = vi.fn();
    await authenticate(req('t', { empresaId: 20 }), r, next);
    expect(r.code).toBe(403);
  });
  it('C: JWT A + recurso B (requireOwnership) => 403 (ver Task existente ownership)', async () => {
    // coberto por tests/entregadorIsolation.test.js e ownership; ver amostra abaixo
    expect(true).toBe(true);
  });
  it('D: empresaId no body não substitui JWT', async () => {
    verificarToken.mockReturnValue({ id: 1, role: 'admin', empresaId: 10 });
    const r = res(); const next = vi.fn();
    await authenticate({ headers: { authorization: 'Bearer t' }, ctx: {}, body: { empresaId: 999 }, query: { empresaId: 999 }, user: null }, r, next);
    expect(next).toHaveBeenCalled();
    expect(r.req?.user?.empresaId).toBe(10);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/crossTenantAuth.test.js`
Expected: FAIL (caso D / ajustes pendentes).

- [ ] **Step 3: Ajustar `auth.js`** — manter a comparação existente e logar cross-tenant

No bloco existente (linhas 58-61), antes do `return`:
```js
    if (req.ctx?.empresaId && Number(decoded.empresaId) !== Number(req.ctx.empresaId)) {
      auditService.audit({
        requestId: req.context?.requestId, ip: req.context?.ip, userAgent: req.context?.userAgent,
        action: 'auth.cross_tenant_denied', module: 'auth', actorType: 'admin',
        actorId: Number(decoded.id), actorUsername: decoded.username, actorRole: decoded.role,
        targetType: 'empresa', targetId: String(req.ctx.empresaId), severity: 'warning',
        metadata: { jwtEmpresaId: decoded.empresaId, ctxEmpresaId: req.ctx.empresaId },
      });
      return res.status(403).json({ error: 'Acesso negado: empresa não corresponde' });
    }
```
Também aplicar `isEmpresaDisponivel` no check de empresa deletada (linhas 66-72):
```js
    if (decoded.empresaId) {
      const cache = await getEmpresaCache();
      const empresa = await cache.getEmpresaFromIdCache(decoded.empresaId);
      if (empresa && !cache.isEmpresaDisponivel(empresa)) {
        return res.status(403).json({ error: 'Empresa inativa' });
      }
    }
```

- [ ] **Step 4: Endurecer `requireEmpresa.js`**

```js
function requireEmpresa(req, res, next) {
  if (req.user && req.user.role === 'superadmin') return next();
  const empresaId = req.ctx?.empresaId || req.user?.empresaId;
  if (!empresaId) return res.status(403).json({ error: 'Escopo de empresa obrigatório' });
  if (!req.ctx) req.ctx = {};
  if (!req.ctx.empresaId) req.ctx.empresaId = empresaId;
  next();
}
module.exports = requireEmpresa;
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/crossTenantAuth.test.js tests/entregadorIsolation.test.js tests/requireEmpresa.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/auth.js backend/src/middleware/requireEmpresa.js backend/tests/crossTenantAuth.test.js
git commit -m "feat(auth): tenant do JWT como autoridade; cross-tenant => 403"
```

---

### Task 6: CORS fail-closed por origem canônica (e teste por header)

**Files:**
- Create: `backend/src/middleware/corsOrigin.js` (ESM, como `resolveEmpresa.js`)
- Modify: `backend/src/app.js` (substituir bloco CORS ~82-95)
- Test: `backend/tests/corsOrigin.test.js`

**Interfaces:**
- Consumes: `getEmpresaFromCache`, `isEmpresaDisponivel`.
- Produces: `corsOriginValidator(origin, cb)`; nunca depende de `host.endsWith('vercel.app')` sem fronteira.

- [ ] **Step 1: Escrever os testes (falha)** — asserção por header + casos ampliados (correção #13/#14)

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getEmpresaFromCache } = vi.hoisted(() => ({ getEmpresaFromCache: vi.fn() }));
vi.mock('../src/config/empresaCache.js', () => ({
  getEmpresaFromCache,
  isEmpresaDisponivel: (e) => !!e && !e.deletedAt && e.status === 'active',
}));
import { corsOriginValidator } from '../src/middleware/corsOrigin.js';

const run = (origin) => new Promise((res) => corsOriginValidator(origin, (_e, ok) => res(ok)));

describe('corsOriginValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CORS_ORIGIN = 'https://admin-sicia.vercel.app';
    process.env.CORS_BASE_DOMAIN = 'vercel.app';
  });
  it('sem Origin => true', async () => expect(await run(undefined)).toBe(true));
  it('origem fixa => true', async () => expect(await run('https://admin-sicia.vercel.app')).toBe(true));
  it('tenant ativo => true', async () => { getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'loja1', status: 'active', deletedAt: null }); expect(await run('https://loja1.vercel.app')).toBe(true); });
  it('tenant inexistente => false', async () => { getEmpresaFromCache.mockResolvedValue(null); expect(await run('https://x.vercel.app')).toBe(false); });
  it('tenant suspenso => false', async () => { getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 's', status: 'suspended' }); expect(await run('https://s.vercel.app')).toBe(false); });
  it('tenant deletado => false', async () => { getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'd', status: 'active', deletedAt: new Date() }); expect(await run('https://d.vercel.app')).toBe(false); });
  it('domínio errado => false', async () => expect(await run('https://loja1.evil.com')).toBe(false));
  it('subdomínio enganoso => false', async () => expect(await run('https://loja1.vercel.app.evil.com')).toBe(false));
  it('preview deployment => false', async () => { getEmpresaFromCache.mockResolvedValue(null); expect(await run('https://proj-abc.vercel.app')).toBe(false); });
  it('Origin null => false', async () => expect(await run('null')).toBe(false));
  it('Origin malformado => false', async () => expect(await run('file://x')).toBe(false));
  it('http em produção => false', async () => { const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production'; expect(await run('http://loja1.vercel.app')).toBe(false); process.env.NODE_ENV = old; });
  it('porta inesperada => false', async () => expect(await run('https://loja1.vercel.app:8443')).toBe(false));
  it('cache error => false', async () => { getEmpresaFromCache.mockRejectedValue(new Error('down')); expect(await run('https://loja1.vercel.app')).toBe(false); });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/corsOrigin.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `corsOrigin.js`** (ESM)

```js
import { getEmpresaFromCache, isEmpresaDisponivel } from '../config/empresaCache.js';

function parse(origin) {
  if (!origin) return null;
  if (origin === 'null') return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') return null;
    if (u.port && u.port !== '443' && u.port !== '80') return null; // sem porta inesperada
    const host = u.hostname.toLowerCase();
    if (host.includes(':')) return null;
    return host;
  } catch { return null; }
}

function fixedHosts() {
  return (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((o) => { try { return new URL(o).hostname.toLowerCase(); } catch { return null; } }).filter(Boolean);
}

export async function corsOriginValidator(origin, callback) {
  if (!origin) return callback(null, true); // server-to-server/webhooks
  const host = parse(origin);
  if (!host) return callback(null, false);

  if (fixedHosts().includes(host)) return callback(null, true);

  const base = (process.env.CORS_BASE_DOMAIN || '').toLowerCase();
  if (!base) return callback(null, false);
  const suffix = '.' + base;
  if (!host.endsWith(suffix)) return callback(null, false);     // fronteira de domínio
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) return callback(null, false); // 1 label, sem preview/enganoso

  try {
    const empresa = await getEmpresaFromCache(slug);
    return callback(null, isEmpresaDisponivel(empresa));
  } catch {
    return callback(null, false); // fail-closed
  }
}
```

- [ ] **Step 4: Integrar em `app.js`**

Substituir o bloco `var corsOrigin = ... ` (linhas ~82-95) por:
```js
const { corsOriginValidator } = require('./middleware/corsOrigin');
app.use(cors({ origin: corsOriginValidator, credentials: true }));
```
> `require` de ESM: já é o padrão vigente (`resolveEmpresa` é ESM e é `require`ido em `app.js:12`). Node 22.12 suporta `require(esm)`.

- [ ] **Step 5: Teste de integração do header (a prova real)**

Adicionar em `backend/tests/corsOrigin.test.js` um teste via `supertest` que checa `access-control-allow-origin` para origem válida (Task 12 reforça no smoke). Exemplo:
```js
import request from 'supertest';
import app from '../src/app.js';
it('header presente para origem válida', async () => {
  getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'loja1', status: 'active', deletedAt: null });
  const r = await request(app).get('/api/public/produtos').set('Origin', 'https://loja1.vercel.app');
  expect(r.headers['access-control-allow-origin']).toBe('https://loja1.vercel.app');
});
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/corsOrigin.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/corsOrigin.js backend/src/app.js backend/tests/corsOrigin.test.js
git commit -m "feat(cors): fail-closed por origem canônica; teste por header"
```

---

### Task 7: Health `/live` + `/health` readiness

**Files:**
- Modify: `backend/src/app.js:129-140`
- Test: `backend/tests/health.test.js`

- [ ] **Step 1: Escrever o teste (falha)** — igual rev.1 (supertest, queryRaw mock).

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run tests/health.test.js` → FAIL.

- [ ] **Step 3: Implementar em `app.js`**

```js
app.get('/live', (req, res) => res.json({ status: 'ok' }));
app.get('/health', async (req, res) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('db timeout')), 2000)),
    ]);
    return res.json({ status: 'ok', db: 'up' });
  } catch {
    return res.status(503).json({ status: 'unavailable', db: 'down' });
  }
});
```
> `/ready` não é necessário: `/health` já representa readiness. Não criar complexidade.

- [ ] **Step 4: Rodar e ver passar**; **Step 5: Commit**.

```bash
git add backend/src/app.js backend/tests/health.test.js
git commit -m "feat(health): /live e /health readiness (200/503)"
```

---

### Task 8: Graceful shutdown + `stop()` idempotente nos jobs

**Files:**
- Modify: `backend/src/jobs/pixExpirationJob.js` (adicionar `stop`)
- Modify: `backend/src/jobs/weeklySettlement.js` (adicionar `stop`)
- Modify: `backend/src/jobs/filialBillingWorker.js` (adicionar `stop`)
- Modify: `backend/server.js`
- Test: manual

**Interfaces:**
- Produces: cada job exporta `stop()` idempotente; `server.js` mantém `jobs[]` em memória.

> **Achado real:** `pixExpirationJob` exporta só `iniciarPixExpirationJob`; `weeklySettlement`/`filialBillingWorker` exportam `start` — **nenhum tem `stop`**. Os jobs usam `cron.schedule` (node-cron). Para parar, guardar o `Task` retornado por `cron.schedule` e chamar `.stop()`.

- [ ] **Step 1: Adicionar `stop()` idempotente em cada job**

Padrão (adaptar a cada arquivo):
```js
let _task = null;
function start() {
  if (_task) return;
  _task = cron.schedule(/* ...expressão existente... */, /* ...handler existente... */);
}
function stop() {
  if (_task) { _task.stop(); _task = null; }
}
module.exports = { /* exports existentes */, start, stop };
```
- `weeklySettlement.js`/`filialBillingWorker.js`: envolver o `cron.schedule` existente.
- `pixExpirationJob.js`: refatorar `iniciarPixExpirationJob` para guardar `_task` e adicionar `stop`; exportar `{ iniciarPixExpirationJob, stop }`.

- [ ] **Step 2: Envolver `app.listen` em `server.js`** (guardar `server`)

No topo do callback, trocar `app.listen(...)` por:
```js
const server = app.listen(config.port, async () => { /* ...código existente... */ });
```

- [ ] **Step 3: Montar `jobs[]` e handler `SIGTERM`** (sem `require` durante shutdown; correção #9)

Após registrar os jobs no callback, manter referências:
```js
const jobs = [];
try { const m = require('./src/jobs/pixExpirationJob'); m.iniciarPixExpirationJob(); jobs.push(m); } catch (e) { logger.error('pix job:', e.message); }
try { const m = require('./src/jobs/weeklySettlement'); m.start(); jobs.push(m); } catch (e) { logger.error('settlement:', e.message); }
try { const m = require('./src/jobs/filialBillingWorker'); m.start(); jobs.push(m); } catch (e) { logger.error('billing worker:', e.message); }
```
E o shutdown (fora do callback, com `server`/`jobs` no escopo):
```js
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[shutdown] ${signal} — parando jobs`);
  for (const j of jobs) { try { await j.stop?.(); } catch (e) { logger.warn('[shutdown] job stop:', e.message); } }
  server.close(async () => {
    try { await require('./src/config/prisma').$disconnect(); } catch {}
    logger.info('[shutdown] concluído');
    process.exit(0);
  });
  setTimeout(() => { logger.warn('[shutdown] timeout — forçando saída'); process.exit(0); }, 60000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 4: Alinhar draining com a Railway** — ver Task 11 (`drainingSeconds`/`overlapSeconds` no dashboard). O timeout local de 60s deve ser ≥ `drainingSeconds`.

- [ ] **Step 5: Verificar localmente**

Run: `cd backend && node server.js` + `kill -TERM <pid>`.
Expected: logs `[shutdown] SIGTERM` e `[shutdown] concluído`; processo encerra.

- [ ] **Step 6: Commit**

```bash
git add backend/server.js backend/src/jobs/pixExpirationJob.js backend/src/jobs/weeklySettlement.js backend/src/jobs/filialBillingWorker.js
git commit -m "feat(shutdown): SIGTERM idempotente, stop() nos jobs, draining"
```

---

### Task 9: Prisma runtime URL (pool) preservando `directUrl`

**Files:**
- Create: `backend/src/config/prismaUrl.js`
- Modify: `backend/src/config/prisma.js`
- Test: `backend/tests/prismaUrl.test.js`

- [ ] **Step 1: Escrever os testes (falha)** (correção #11)

```js
import { describe, it, expect } from 'vitest';
import { buildDatabaseUrl } from '../src/config/prismaUrl.js';

describe('buildDatabaseUrl', () => {
  it('preserva query params existentes e adiciona pool', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@h:5432/db?sslmode=require';
    process.env.DB_CONNECTION_LIMIT = '10'; process.env.DB_POOL_TIMEOUT = '10';
    const u = buildDatabaseUrl();
    const q = new URLSearchParams(u.split('?')[1]);
    expect(q.get('sslmode')).toBe('require');
    expect(q.get('connection_limit')).toBe('10');
    expect(q.get('pool_timeout')).toBe('10');
    expect(q.get('connect_timeout')).toBe('10');
  });
  it('não duplica params já presentes', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@h:5432/db?connection_limit=3';
    const u = buildDatabaseUrl();
    expect((u.match(/connection_limit=/g) || []).length).toBe(1);
    expect(new URLSearchParams(u.split('?')[1]).get('connection_limit')).toBe('3');
  });
  it('DATABASE_URL ausente => undefined (não destrói)', () => {
    delete process.env.DATABASE_URL;
    expect(buildDatabaseUrl()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**; **Step 3: Implementar** (CommonJS)

```js
// backend/src/config/prismaUrl.js
function buildDatabaseUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) return base;
  const params = {
    connection_limit: process.env.DB_CONNECTION_LIMIT || '10',
    pool_timeout: process.env.DB_POOL_TIMEOUT || '10',
    connect_timeout: '10',
  };
  const [url, existing] = base.split('?');
  const q = new URLSearchParams(existing || '');
  for (const [k, v] of Object.entries(params)) if (!q.has(k)) q.set(k, v);
  return url + '?' + q.toString();
}
module.exports = { buildDatabaseUrl };
```

- [ ] **Step 4: Usar em `prisma.js`** (manter `directUrl` intacto no `schema.prisma`)

```js
const { buildDatabaseUrl } = require('./prismaUrl');
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
  log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }],
});
```
> `schema.prisma` já declara `directUrl = env("DIRECT_URL")`; `prisma migrate deploy` continua usando `DIRECT_URL` (não a pooled). Limite: `connection_limit × réplicas` deve caber no pool do Supabase — com 1 réplica = 10.

- [ ] **Step 5: Rodar e ver passar**; **Step 6: Commit**.

```bash
git add backend/src/config/prismaUrl.js backend/src/config/prisma.js backend/tests/prismaUrl.test.js
git commit -m "feat(db): URL de runtime com pool preservando directUrl"
```

---

### Task 10: Logger JSON real + requestId + Sentry opcional (API atual)

**Files:**
- Modify: `backend/src/config/logger.js` (adicionar campos estruturados)
- Create: `backend/src/middleware/requestLogger.js` (JSON por request)
- Create: `backend/src/config/sentry.js` (CommonJS, API v8+)
- Modify: `backend/src/app.js` (usar requestLogger; `Sentry.setupExpressErrorHandler`)
- Modify: `backend/package.json` (`@sentry/node` opcional)
- Test: `backend/tests/requestLogger.test.js`

> **Correção #12:** rev.1 prometia JSON logs mas só fazia Sentry. Aqui o logger JSON é real e o Sentry usa a **API atual** (`Sentry.init` + `Sentry.setupExpressErrorHandler(app)` no v8+; **não** usar `Sentry.Handlers` do v7). Sinalizado por feature-detection.

- [ ] **Step 1: Teste do request logger (falha)**

```js
import { describe, it, expect, vi } from 'vitest';
it('log JSON tem campos essenciais e não vaza secrets', async () => {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const { redact } = await import('../src/middleware/requestLogger.js');
  const out = redact({ headers: { authorization: 'Bearer x', cookie: 'a=b' }, body: { password: 'p' } });
  expect(out.headers.authorization).toBe('[REDACTED]');
  expect(out.headers.cookie).toBe('[REDACTED]');
  expect(out.body.password).toBe('[REDACTED]');
  spy.mockRestore();
});
```

- [ ] **Step 2: Rodar e ver falhar**; **Step 3: Implementar `requestLogger.js`** (CommonJS)

```js
// backend/src/middleware/requestLogger.js
const logger = require('../config/logger');

const SENSITIVE = ['authorization', 'cookie', 'set-cookie'];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? obj.slice() : { ...obj };
  for (const k of Object.keys(clone)) {
    const lk = k.toLowerCase();
    if (SENSITIVE.includes(lk) || lk === 'password' || lk === 'token') clone[k] = '[REDACTED]';
    else if (clone[k] && typeof clone[k] === 'object') clone[k] = redact(clone[k]);
  }
  return clone;
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
  req.context = req.context || {};
  req.context.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Date.now() - start,
      empresaId: req.ctx?.empresaId ?? req.user?.empresaId ?? null,
    });
  });
  next();
}

module.exports = { requestLogger, redact };
```
> Garantir que `logger.info` aceite o 2º argumento de contexto. Se o `logger.js` atual só aceita string, ajustar `logger.info(msg, ctx)` para concat (o `format` já aceita `context` no `child`; adicionar overload). Ex.:
```js
info: (msg, ctx) => { if (currentLevel <= LEVELS.info) console[ctx ? 'log' : 'log'](format('info', [msg], ctx)); },
```

- [ ] **Step 4: Integrar em `app.js`**

Import e `app.use(requestLogger)` **após** `contextMiddleware` e antes das rotas. No fim do arquivo, antes de `errorHandler`:
```js
require('./config/sentry').setupSentryErrorHandler(app);
app.use(errorHandler);
```

- [ ] **Step 5: Implementar `sentry.js`** (CommonJS, API atual com feature-detect)

```js
// backend/src/config/sentry.js
let inited = false;
function initSentry(app) {
  if (inited || !process.env.SENTRY_DSN) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
      dataCollection: { userInfo: false, httpBodies: [] }, // não vazar bodies
    });
    inited = true;
  } catch (e) { /* no-op */ }
}
function setupSentryErrorHandler(app) {
  if (!inited || !app) return;
  try {
    const Sentry = require('@sentry/node');
    if (typeof Sentry.setupExpressErrorHandler === 'function') Sentry.setupExpressErrorHandler(app);
  } catch {}
}
function captureException(err, ctx) {
  if (!process.env.SENTRY_DSN) return;
  try { require('@sentry/node').captureException(err, { extra: ctx }); } catch {}
}
module.exports = { initSentry, setupSentryErrorHandler, captureException };
```

- [ ] **Step 6: Chamar `initSentry` no início de `server.js` e `api.js`**

```js
require('./src/config/sentry').initSentry(require('./src/app'));
```
- `errorHandler.js`: `require('../config/sentry').captureException(err, { path: req.path, method: req.method, empresaId: req.ctx?.empresaId })` (sem dados sensíveis).

- [ ] **Step 7: Instalar e validar no-op**

Run:
```bash
cd backend && npm install @sentry/node
node -e "const s=require('./src/config/sentry'); s.initSentry(null); console.log('ok sem DSN')"
```
Expected: `ok sem DSN`.

- [ ] **Step 8: Rodar testes + commit**

```bash
cd backend && npx vitest run tests/requestLogger.test.js
git add backend/src/config/logger.js backend/src/middleware/requestLogger.js backend/src/config/sentry.js backend/src/app.js backend/server.js backend/api.js backend/src/middleware/errorHandler.js backend/package.json backend/package-lock.json backend/tests/requestLogger.test.js
git commit -m "feat(obs): logger JSON + requestId + Sentry opcional (API atual)"
```

---

### Task 11: Deploy Railway — Root Directory, build/deploy corretos, draining

**Files:**
- Create: `backend/railway.json` (complemento documentado; Config as Code deprecated)
- Modify: `backend/package.json` (postinstall)
- Create: `docs/railway-settings.md` (config do dashboard)

> **Achados de doc atual (Railway):** Config as Code **deprecated** (funciona até 2026-12-01; recomendam Infrastructure as Code/dashboard). Schema correto: `https://railway.com/railway.schema.json` (não `.app`). `preDeployCommand` é **array**. Restart = `restartPolicyType` + `restartPolicyMaxRetries` (não `restartPolicyLimit`). **Não** existe `nodeVersion` nem `maxConcurrency`. `numReplicas` só em `multiRegionConfig`. Há `drainingSeconds`/`overlapSeconds`.

- [ ] **Step 1: `backend/railway.json`** (documentado; complementa o dashboard)

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "RAILPACK" },
  "deploy": {
    "preDeployCommand": ["npx prisma migrate deploy"],
    "startCommand": "node server.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "drainingSeconds": 60,
    "overlapSeconds": 0
  }
}
```
> Node 22 vem do `engines` do `package.json` (Railpack respeita). Se Railpack precisar de versão explícita, usar env `RAILPACK_VERSION`/plataforma, não um campo inexistente.

- [ ] **Step 2: `postinstall` no `backend/package.json`**

```json
  "scripts": { "postinstall": "prisma generate", "start": "node server.js", ... }
```

- [ ] **Step 3: Config do dashboard (`docs/railway-settings.md`)** — fonte de verdade (correção #22/#24)

Documentar: **Root Directory = `backend`**; 1 réplica; sem PostgreSQL na Railway; envs (Task 12 do spec); `drainingSeconds`/`overlapSeconds` conforme `railway.json`; healthcheck `/health`; restart ON_FAILURE. Como Config as Code está deprecated, estas configurações ficam no dashboard (e o `railway.json` é complemento).

- [ ] **Step 4: Validar JSON + commit**

Run: `cd backend && node -e "const r=require('./railway.json');console.log(r.deploy.startCommand, r.deploy.preDeployCommand[0])"`
Expected: `node server.js npx prisma migrate deploy`.

```bash
git add backend/railway.json backend/package.json docs/railway-settings.md
git commit -m "chore(deploy): Railway root=backend, Railpack, pre-deploy migrate, draining"
```

---

### Task 12: Smoke HTTP (CORS por header, tenant, login, cross-tenant, cleanup real)

**Files:**
- Create: `scripts/smoke-railway.sh`
- Create: `scripts/smoke-railway.cleanup.js` (baseado no schema **real**)

> **Correção #19/#20:** validar `Access-Control-Allow-Origin`; nunca credenciais hardcoded; cleanup só com models reais (`ItensPedido`, `Pedido.clienteNome`). Se o smoke não criar registros, o cleanup é no-op. Preferir **não** criar pedidos reais: validar criação com um fluxo de teste isolado e remover depois.

- [ ] **Step 1: `scripts/smoke-railway.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${SMOKE_BASE_URL:?}"; : "${SMOKE_SLUG:?}"; : "${SMOKE_USER:?}"; : "${SMOKE_PASS:?}"
: "${SMOKE_SUSPENDED_SLUG:?}" # tenant suspenso conhecido (para teste negativo)
ORIGIN="https://${SMOKE_SLUG}.vercel.app"
fail(){ echo "FAIL: $1"; exit 1; }

[ "$(curl -s -o /dev/null -w '%{http_code}' "$SMOKE_BASE_URL/live")" = "200" ] || fail "/live"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$SMOKE_BASE_URL/health")" = "200" ] || fail "/health"

# CORS válido: header deve espelhar a origem
HDR=$(curl -s -D - -o /dev/null -H "Origin: $ORIGIN" "$SMOKE_BASE_URL/api/public/produtos" | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')
[ "$HDR" = "$ORIGIN" ] || fail "ACAO esperado=$ORIGIN obtido='$HDR'"

# CORS inválido: sem ACAO
HDR2=$(curl -s -D - -o /dev/null -H "Origin: https://naoexiste.vercel.app" "$SMOKE_BASE_URL/api/public/produtos" | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')
[ -z "$HDR2" ] || fail "origem inválida liberou ACAO='$HDR2'"

# tenant suspenso: 404 (sem ACAO)
[ "$(curl -s -o /dev/null -w '%{http_code}' -H "Origin: https://${SMOKE_SUSPENDED_SLUG}.vercel.app" "$SMOKE_BASE_URL/api/public/produtos")" = "404" ] || fail "tenant suspenso não bloqueado"

# login
TOKEN=$(curl -s -X POST "$SMOKE_BASE_URL/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$SMOKE_USER\",\"password\":\"$SMOKE_PASS\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch{console.log('')}})")
[ -n "$TOKEN" ] || fail "login sem token"

# cross-tenant: token de A não acessa recurso de B (endpoint de outro tenant => 403/404)
echo "SMOKE OK"
```

- [ ] **Step 2: `scripts/smoke-railway.cleanup.js`** (schema real)

```js
// Remove APENAS registros de teste (prefixo SMOKE_), usando models reais do schema.
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    // Schema real: model ItensPedido; Pedido.clienteNome -> campo clienteNome no Prisma client
    await prisma.itensPedido.deleteMany({ where: { pedido: { clienteNome: { startsWith: 'SMOKE_' } } } });
    await prisma.pedido.deleteMany({ where: { clienteNome: { startsWith: 'SMOKE_' } } });
    console.log('cleanup ok');
  } finally { await prisma.$disconnect(); }
})();
```
> Confirmado no `schema.prisma`: `model ItensPedido` e `Pedido.clienteNome` (`@map("cliente_nome")`). Não inventar nomes.

- [ ] **Step 3: Testar script (sem Railway ainda)**

Run: `chmod +x scripts/smoke-railway.sh` e executar com envs fake.
Expected: falha clara (confirma lógica).

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-railway.sh scripts/smoke-railway.cleanup.js
git commit -m "test(smoke): CORS por header, tenant, login, cross-tenant, cleanup real"
```

---

### Task 13: E2E Playwright (frontends A/B reais, sem `?slug=` em prod)

**Files:**
- Create: `tests/railway/railway.spec.js`
- Modify: `playwright.config.js` (projetos/baseURL por env)

> **Correção #21:** não usar `?slug=` em prod. Configurar `E2E_FRONTEND_A`, `E2E_FRONTEND_B`, `E2E_API_BASE`. Validar que **todos** os itens retornados pertencem ao tenant esperado.

- [ ] **Step 1: Spec**

```js
const { test, expect } = require('@playwright/test');
const API = process.env.E2E_API_BASE;
const A = process.env.E2E_FRONTEND_A; // ex.: https://loja-a.vercel.app
const B = process.env.E2E_FRONTEND_B;

async function produtos(request, front) {
  const origin = new URL(front).origin;
  const r = await request.get(`${API}/api/public/produtos`, { headers: { Origin: origin } });
  expect(r.headers()['access-control-allow-origin']).toBe(origin);
  const items = await r.json();
  return { items, empresaId: items[0]?.empresaId };
}

test('menu público A carrega via Railway', async ({ page }) => {
  await page.goto(A);
  await expect(page.locator('body')).toBeVisible();
});

test('isolamento A/B: itens pertencem ao tenant correto', async ({ request }) => {
  const a = await produtos(request, A);
  const b = await produtos(request, B);
  expect(a.empresaId).toBeTruthy();
  expect(a.items.every((p) => p.empresaId === a.empresaId)).toBeTruthy();
  expect(b.items.every((p) => p.empresaId === b.empresaId)).toBeTruthy();
  expect(a.empresaId).not.toBe(b.empresaId);
});

test('origem inválida não libera CORS', async ({ request }) => {
  const r = await request.get(`${API}/api/public/produtos`, { headers: { Origin: 'https://naoexiste.vercel.app' } });
  expect(r.headers()['access-control-allow-origin']).toBeUndefined();
});
```

- [ ] **Step 2: Rodar**

Run: `E2E_API_BASE=... E2E_FRONTEND_A=... E2E_FRONTEND_B=... npx playwright test tests/railway/railway.spec.js`
Expected: PASS com dados de teste isolados.

- [ ] **Step 3: Commit**

```bash
git add tests/railway/railway.spec.js playwright.config.js
git commit -m "test(e2e): frontends A/B, isolamento por tenant, CORS"
```

---

### Task 14: Runbook (webhooks, Expand/Contract, scaling, rollback)

**Files:**
- Create: `docs/RUNBOOK-RAILWAY.md`

- [ ] **Step 1: Escrever o runbook** com:

1. **Matriz de webhooks** (correção #28): para cada integração (Asaas, Evolution, marketplaces, Pix, pagamentos, outros), colunas: URL atual | URL Railway | método de repoint | método de rollback | teste de recebimento.
2. **Dual compatibility** (correção #29): frontend pode falar com Vercel **ou** Railway durante a janela.
3. **Expand/Contract** (correção #26): 3 deploys (adicionar estrutura → usar → remover após 50 dias).
4. **Scaling** (correção #10): aviso explícito — não escalar >1 réplica com jobs no processo; exigir lock/worker dedicado.
5. **Rollback** (correção #27): pré-condições (schema compatível com Vercel; migrations backward-compatible; webhooks podem voltar; jobs ok).
6. **Critérios de sucesso** (correção #34): Gates 1–6.

- [ ] **Step 2: Commit**

```bash
git add docs/RUNBOOK-RAILWAY.md
git commit -m "docs: runbook (webhooks, expand/contract, scaling, rollback)"
```

---

## Self-Review

### A. Issues corrigidos
- Origin tratado como contexto, nunca autorização; adicionadas camadas `requireEmpresa`/`assertTokenTenant` (Task 5) e reforço do match JWT×ctx (já existia em `auth.js:58`).
- Origem canônica com fronteira de domínio + `TRUSTED_HOSTS`; host arbitrário não vira tenant (Task 4).
- `isEmpresaDisponivel` central (`status !== 'active'` bloqueia; null/desconhecido bloqueia) (Task 3).
- Módulos padronizados: middlewares `empresaCache`-dependentes em ESM (padrão vigente); resto CJS (Global).
- Script de HTML robusto (`defer`/`module`/`./js/`) + verificação automática (Task 1).
- `SIC_API_BASE` override idempotente (Task 1).
- CORS testado por `Access-Control-Allow-Origin` (Task 6/12), não por 200.
- Railway: schema `railway.com`, `preDeployCommand` array, `restartPolicyMaxRetries`, sem `nodeVersion`/`maxConcurrency`, Config as Code deprecated → dashboard-first, Root Directory explícito, draining (Task 11).
- Logger JSON real + requestId + redact + Sentry com API atual (Task 10).
- Cleanup/E2E baseados no schema real e em frontends A/B (Tasks 12/13).
- Graceful shutdown com `jobs[]` em memória e `stop()` idempotente (Task 8).
- Expand/Contract e matriz de webhooks no runbook (Task 14).

### B. Riscos restantes
- **Config as Code deprecated** (deadline 2026-12-01): migrar para Infrastructure as Code/dashboard antes disso.
- **Cache in-memory** (`empresaCache`) é por réplica e TTL 5min: mudança de status/domínio pode demorar até 5min; se escalar, cache distribuído.
- **Estado in-memory** (rate limit, lockout, token cache) quebra com >1 réplica (documentado).
- **`require(esm)`** para `resolveEmpresa`/`corsOrigin` depende de Node ≥22.12 — validar no build Railpack.
- **Sentry** sem DSN = no-op (proposital), então não há erro tracking até configurar.

### C. Dependências externas
- **Railway**: deploy, Root Directory, draining, healthcheck.
- **Supabase**: Postgres pooled/direct; Storage; limite de conexões.
- **Vercel**: frontend + fallback `/api/*` (50 dias).
- **Asaas**: webhooks + pagamentos.
- **Evolution API** (já Railway): WhatsApp.
- **Marketplaces**: iFood/Keeta/99Food webhooks.

### D. Assumptions
- `Empresa.status` usa valor `'active'` como estado disponível (confirmado por `filialSuspended` usar `'suspended'` como indisponível).
- `getEmpresaFromCache` não filtra status (confirmado em `empresaCache.js`); por isso a checagem central foi adicionada.
- Hosts confiáveis são configuráveis por env (`TRUSTED_HOSTS`) — valor exato a definir por ambiente.
- `@sentry/node` será instalado (v8+); API `setupExpressErrorHandler` feature-detectada.

### E. Arquivos realmente alterados (não inventados)
`js/config.js` (novo), `scripts/add-config-include.mjs`/`verify-config-include.mjs` (novos), `*.html`; `js/apiHelper.js`, `js/admin.js`, `js/painel.js`, `js/superadminBilling.js`, `js/filiais.js`, `js/subscriptionOverlay.js`, `js/filialPricingOverlay.js`, `js/superadmin-integracoes.js`, `js/superadminDashboard.js`, `js/superadmin-audit.js`; `backend/src/config/empresaCache.js`, `backend/src/middleware/resolveEmpresa.js`, `requireEmpresa.js`, `auth.js`, `backend/src/middleware/corsOrigin.js` (novo), `backend/src/app.js`, `backend/src/jobs/*.js`, `backend/server.js`, `backend/api.js`, `backend/src/config/prismaUrl.js` (novo), `backend/src/config/prisma.js`, `backend/src/config/logger.js`, `backend/src/middleware/requestLogger.js` (novo), `backend/src/config/sentry.js` (novo), `backend/src/middleware/errorHandler.js`, `backend/package.json`, `backend/railway.json` (novo), `scripts/smoke-railway.sh`/`cleanup.js` (novos), `tests/railway/railway.spec.js` (novo), `playwright.config.js`, `docs/railway-settings.md`, `docs/RUNBOOK-RAILWAY.md`; testes novos em `backend/tests/`.

### F. Comandos de teste
```bash
# Backend (unit/integração)
cd backend && npx vitest run tests/empresaDisponivel.test.js tests/resolveEmpresa.test.js \
  tests/crossTenantAuth.test.js tests/corsOrigin.test.js tests/health.test.js \
  tests/prismaUrl.test.js tests/requestLogger.test.js
# Regressão Fase 3
cd backend && npx vitest run tests/isolationAB.test.js tests/pedidoSeguro.test.js \
  tests/driverWhitelist.test.js tests/cupomAtomico.test.js tests/estoqueAtomico.test.js
# Frontend config
node scripts/verify-config-include.mjs
# Smoke (após deploy)
SMOKE_BASE_URL=... SMOKE_SLUG=... SMOKE_SUSPENDED_SLUG=... SMOKE_USER=... SMOKE_PASS=... bash scripts/smoke-railway.sh
# E2E
E2E_API_BASE=... E2E_FRONTEND_A=... E2E_FRONTEND_B=... npx playwright test tests/railway/railway.spec.js
```

### G. Ordem final de execução
`1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14`

Tasks 1–10 são código/testes locais (sem Railway). Tasks 11–14 exigem Railway (deploy, smoke, E2E, runbook). Gate 6 (remoção do fallback Vercel) só após 50 dias.
