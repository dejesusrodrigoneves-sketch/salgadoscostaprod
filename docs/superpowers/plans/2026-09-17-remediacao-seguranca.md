# Remediação de Segurança SIC-IA — Plano de Execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar 9 achados de segurança da auditoria SIC-IA sem alterar a regra de autorização (superadmin vê tudo; admin/user só a sua empresa) e sem regressões nos fluxos de cardápio/carrinho e admin.

**Architecture:** Correções cirúrgicas em Express/Prisma (backend) e JS vanilla (frontend), em 6 fases independentes. Duas camadas defensivas novas: `publicId` opaco em `Pedido` (G5) e RLS deny-by-default no Supabase (G7), ambas aditivas. Contrato unificado `GET /api/public/pedidos/:publicId`.

**Tech Stack:** Node 22, Express 5.2.1, Prisma 6.5.0, PostgreSQL/Supabase, JWT, vanilla JS, vercel.json, vitest, Playwright MCP.

## Global Constraints

- **SEM COMMITS.** O usuário aplica o deploy. Nenhum passo executa `git commit`.
- **Arquivos PROIBIDOS:** `backend/src/middleware/auth.js`, `backend/src/middleware/ownership.js`, `backend/src/middleware/resolveEmpresa.js`, helper `empresaId(req)` em qualquer controller.
- **Não adicionar dependência.** Node 22 já tem `crypto.randomUUID`. Sem `uuid`, `DOMPurify`, `helmet` extra.
- **404 (não 403)** em pedido público.
- **`authenticatePublic` e `requireTenant` já existem** em `backend/src/controllers/publicController.js` (linhas 56 e 43). Reutilizar; não recriar.
- **Diff mínimo.** Patch cirúrgico; não reformatar arquivos.
- **Ordem de fases obrigatória:** 0 → 1 → 2 → 3a → 3b → 3c → 4a → 4c → 5. Não antecipar `publicId` na fase 1.
- **CSP:** `script-src` sem `unsafe-inline`; `style-src` mantém `unsafe-inline`. Sem nonces.
- **RLS:** sem `FORCE ROW LEVEL SECURITY`; sem `CREATE POLICY`.
- **Testes backend:** `backend/tests/*.test.js`; rodar com `npx vitest run tests/` a partir de `backend/`.

---

## File Structure

| Arquivo | Responsabilidade | Fase |
|---------|------------------|------|
| `backend/tests/buscarPedido.test.js` | Teste G1 | 1 |
| `backend/tests/empresaDelete.test.js` | Teste G2 | 1 |
| `backend/src/controllers/publicController.js` | G1 lookup; G5 3a (create); G5 3c (lookup) | 1,3 |
| `backend/src/repositories/empresaRepository.js` | G2 remove linha | 1 |
| `js/utils.js` | G3 authGuard | 2 |
| `superadmin.html`, `balcao.html`, `caixa.html` | G3 call sites | 2 |
| `js/admin.js` | G4 escapeHtml | 2 |
| `backend/prisma/schema.prisma` | G5 publicId | 3a |
| `backend/src/repositories/pedidoRepository.js` | G5 create | 3a |
| `backend/scripts/backfillPublicId.js` | G5 3b backfill | 3b |
| `js/pages/*.js` (novos) | G6 extração | 4a |
| `vercel.json` | G6 CSP headers | 4c |
| `backend/src/app.js` | G6 helmet endurecer | 4c |
| `docs/security-audit/rls-deny-by-default.sql` | G7 script | 5 |

---

### Task 1: Baseline + scaffold de testes

**Files:**
- Create: `backend/vitest.config.js`
- Create: `backend/tests/smoke.test.js`

**Interfaces:**
- Produces: harness vitest funcional em `backend/tests/`.

- [ ] **Step 1: Criar config de vitest do backend**

`backend/vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
```

- [ ] **Step 2: Criar smoke test**

`backend/tests/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';
describe('harness', () => {
  it('roda', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 3: Rodar o harness**

Run (em `backend/`): `npx vitest run tests/smoke.test.js`
Expected: `1 passed`

- [ ] **Step 4: Registrar baseline (sem dump)**

Run (em `backend/`): `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected: vazio (nenhuma mudança pendente). Anotar o hash atual: `git rev-parse HEAD`.
**NÃO** executar `pg_dump`.

- [ ] **Step 5: NO COMMIT** — registrar saída em `docs/security-audit/baseline.txt`.

---

### Task 2: G1 — IDOR em `buscarPedido` (CRÍTICA)

**Files:**
- Test: `backend/tests/buscarPedido.test.js`
- Modify: `backend/src/controllers/publicController.js:462-468`

**Interfaces:**
- Consumes: `authenticatePublic` (`publicController.js:56`), `requireTenant` (`:43`), `sql.buscarPedido(id, empresaId)`, `tokenService.gerarToken(payload)`.
- Produces: handler `buscarPedido` retorna 401/404/200.

- [ ] **Step 1: Escrever o teste que falha**

`backend/tests/buscarPedido.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/repositories/sqlRepository.js', () => ({
  buscarPedido: vi.fn(),
  buscarClientePorId: vi.fn(),
}));
vi.mock('../src/config/empresaCache.js', () => ({ getEmpresaFromCache: vi.fn(), isEmpresaDisponivel: () => true, getEmpresaFromIdCache: vi.fn(), default: {} }));

import sql from '../src/repositories/sqlRepository.js';
import tokenService from '../src/services/tokenService.js';
const { buscarPedido } = await import('../src/controllers/publicController.js');

function res() {
  const r = {};
  r.status = vi.fn(() => r);
  r.json = vi.fn(() => r);
  return r;
}

describe('buscarPedido', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem token → 401', async () => {
    const req = { headers: {}, params: { id: '7-001' }, ctx: { empresaId: 7 } };
    const r = res();
    await buscarPedido(req, r, () => {});
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('token de outro cliente → 404', async () => {
    const token = tokenService.gerarToken({ id: 1, empresaId: 7, telefone: '21999999999', nome: 'A' });
    sql.buscarClientePorId.mockResolvedValue({ id: 1, telefone: '21999999999' });
    sql.buscarPedido.mockResolvedValue({ id: '7-001', empresaId: 7, clienteWhatsapp: '21888888888' });
    const req = { headers: { authorization: 'Bearer ' + token }, params: { id: '7-001' }, ctx: { empresaId: 7 } };
    const r = res();
    await buscarPedido(req, r, () => {});
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('token do dono → 200', async () => {
    const token = tokenService.gerarToken({ id: 1, empresaId: 7, telefone: '21999999999', nome: 'A' });
    sql.buscarClientePorId.mockResolvedValue({ id: 1, telefone: '21999999999' });
    sql.buscarPedido.mockResolvedValue({ id: '7-001', empresaId: 7, clienteWhatsapp: '21999999999' });
    const req = { headers: { authorization: 'Bearer ' + token }, params: { id: '7-001' }, ctx: { empresaId: 7 } };
    const r = res();
    await buscarPedido(req, r, () => {});
    expect(r.json).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste → deve falhar**

Run (em `backend/`): `npx vitest run tests/buscarPedido.test.js`
Expected: FAIL — handler atual não é array com `authenticatePublic` (chamada direta não passa por middleware).

- [ ] **Step 3: Implementar (âncora de código)**

Em `publicController.js`, localizar `exports.buscarPedido = asyncHandler(` e trocar por:
```js
exports.buscarPedido = [authenticatePublic, asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const pedido = await sql.buscarPedido(req.params.id, empId);
  if (!pedido || String(pedido.clienteWhatsapp) !== String(req.cliente.telefone)) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  res.json(pedido);
})];
```
**Não** alterar o JSON de sucesso. **Não** criar DTO. **Não** adicionar rate limit.

- [ ] **Step 4: Rodar → deve passar**

Run (em `backend/`): `npx vitest run tests/buscarPedido.test.js`
Expected: `3 passed`

- [ ] **Step 5: NO COMMIT** — registrar diff.

---

### Task 3: G2 — remover `deleteMany({ where: {} })` (CRÍTICA)

**Files:**
- Test: `backend/tests/empresaDelete.test.js`
- Modify: `backend/src/repositories/empresaRepository.js:36`

**Interfaces:**
- Consumes: `prisma.processedWebhook.deleteMany`.

- [ ] **Step 1: Escrever o teste que falha**

`backend/tests/empresaDelete.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';

const prismaMock = {
  $transaction: vi.fn(async (ops) => Promise.all(ops)),
  processedWebhook: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  loginLog: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  auditLog: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  whatsAppInstance: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  entregaDiaria: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  itensPedido: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  pagamento: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  pedido: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  weeklySettlement: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  caixaDiario: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  horario: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  cupom: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  produto: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  categoria: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  usuario: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  cliente: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  counter: { deleteMany: vi.fn(() => Promise.resolve(0)) },
  empresa: { delete: vi.fn(() => Promise.resolve({})) },
};
vi.mock('../src/config/prisma.js', () => ({ default: prismaMock }));

const { excluirEmpresa } = await import('../src/repositories/empresaRepository.js');

describe('excluirEmpresa', () => {
  it('NÃO apaga processedWebhook (tabela global)', async () => {
    await excluirEmpresa(7);
    expect(prismaMock.processedWebhook.deleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar → deve falhar**

Run (em `backend/`): `npx vitest run tests/empresaDelete.test.js`
Expected: FAIL — a linha 36 chama `processedWebhook.deleteMany`.

- [ ] **Step 3: Remover a linha**

Em `empresaRepository.js`, **remover** a linha `prisma.processedWebhook.deleteMany({ where: {} }),`.
Manter o restante da transação intacto.

- [ ] **Step 4: Rodar → deve passar**

Run (em `backend/`): `npx vitest run tests/empresaDelete.test.js`
Expected: `1 passed`

- [ ] **Step 5: NO COMMIT** — registrar diff.

---

### Task 4: G3 — `authGuard(requiredRoles)` (MÉDIA)

**Files:**
- Modify: `js/utils.js:63-80`
- Modify: `superadmin.html:416`, `balcao.html:80`, `caixa.html:18`

**Interfaces:**
- Produces: `authGuard()` | `authGuard('role')` | `authGuard(['r1','r2'])` → boolean; superadmin sempre passa; falha → `location.replace('login.html')`.

- [ ] **Step 1: Implementar `authGuard`**

Substituir a função em `js/utils.js:63`:
```js
function authGuard(requiredRoles) {
  var u = localStorage.getItem('authUser');
  if (!u) { window.location.replace('login.html'); return false; }
  try {
    var user = JSON.parse(u);
    if (!user.username) { window.location.replace('login.html'); return false; }
    if (user._expiry && Date.now() > user._expiry) {
      localStorage.removeItem('authUser');
      window.location.replace('login.html');
      return false;
    }
    if (requiredRoles) {
      var allowed = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (user.role !== 'superadmin' && allowed.indexOf(user.role) === -1) {
        window.location.replace('login.html');
        return false;
      }
    }
    return true;
  } catch (e) {
    window.location.replace('login.html');
    return false;
  }
}
```

- [ ] **Step 2: Atualizar os call sites (lista fechada)**

- `superadmin.html:416` → `if(!authGuard('superadmin')) throw new Error('Redirect');`
- `balcao.html:80` → `if(!authGuard(['admin','user'])) throw new Error('Redirect');`
- `caixa.html:18` → `if(!authGuard(['admin','user'])) throw new Error('Redirect');`
- `js/admin.js:24` (fallback) → **manter** `authGuard()` sem role.

**Não** tocar outros HTMLs.

- [ ] **Step 3: Verificar por inspeção**

Run: `grep -n "authGuard(" js/utils.js superadmin.html balcao.html caixa.html js/admin.js`
Expected: 5 ocorrências, conforme acima.

- [ ] **Step 4: NO COMMIT** — registrar diff.

---

### Task 5: G4 — escapeHtml em `admin.js` (MÉDIA)

**Files:**
- Modify: `js/admin.js` (4 sites por expressão)

**Interfaces:**
- Consumes: `escapeHtml` (`js/utils.js:35`).

- [ ] **Step 1: Aplicar escapeHtml nos 4 sites**

Por **expressão** (não por linha):
1. `${pedidoNome}` dentro de `overlay.innerHTML` (modal entregador) → `${escapeHtml(pedidoNome)}`
2. `${d.nome}` (entregador) → `${escapeHtml(d.nome)}`
3. `${d.whatsapp || '-'}` (entregador) → `${escapeHtml(d.whatsapp || '-')}`
4. `'<p>Cliente: ' + (p.clienteNome || p.cliente?.nome || '-') + '</p>'` → `'<p>Cliente: ' + escapeHtml(p.clienteNome || p.cliente?.nome || '-') + '</p>'`

**Não** trocar `innerHTML` por `textContent`. **Não** varrer outros arquivos.

- [ ] **Step 2: Verificar**

Run: `grep -n "escapeHtml(pedidoNome)\|escapeHtml(d.nome)\|escapeHtml(d.whatsapp\|escapeHtml(p.clienteNome" js/admin.js`
Expected: 4 ocorrências.

- [ ] **Step 3: NO COMMIT** — registrar diff.

---

### Task 6: G5 3a — coluna `publicId` + escrita (ALTA)

**Files:**
- Modify: `backend/prisma/schema.prisma` (model Pedido)
- Modify: `backend/src/controllers/publicController.js:395` (create público)
- Modify: `backend/src/repositories/pedidoRepository.js:119` (create admin)
- Migration: `backend/prisma/migrations/<ts>_add_public_id/`

**Interfaces:**
- Produces: `Pedido.publicId` (String? unique); todo insert de Pedido seta `publicId = crypto.randomUUID()`.

- [ ] **Step 1: Adicionar campo ao schema**

Em `model Pedido`, após `id`, adicionar:
```prisma
  publicId          String?       @unique @map("public_id")
```

- [ ] **Step 2: Gerar migração**

Run (em `backend/`): `npx prisma migrate dev --name add_public_id --create-only`
Expected: migração criada com `ALTER TABLE "pedidos" ADD COLUMN "public_id" TEXT;` + unique index.

- [ ] **Step 3: Setar publicId nos DOIS create paths**

`publicController.js:395` — no objeto de `prisma.pedido.create({ data: {...} })`, adicionar `publicId: require('crypto').randomUUID(),`.

`pedidoRepository.js:119` — idem em `criarPedido` (antes de `prisma.pedido.create`), adicionar `payload.publicId = require('crypto').randomUUID();`.

`publicController.js:395` já importa `crypto`? Se não, adicionar `const crypto = require('crypto');` no topo (não criar lib).

- [ ] **Step 4: Aplicar a migração**

Run (em `backend/`): `npx prisma migrate deploy`
Expected: coluna `public_id` criada (nullable).

- [ ] **Step 5: NO COMMIT** — registrar diff + nome da migração.

---

### Task 7: G5 3b — backfill

**Files:**
- Create: `backend/scripts/backfillPublicId.js`

- [ ] **Step 1: Criar script idempotente**

`backend/scripts/backfillPublicId.js`:
```js
const prisma = require('../src/config/prisma');
(async () => {
  const n = await prisma.$executeRawUnsafe(
    `UPDATE pedidos SET public_id = gen_random_uuid()::text WHERE public_id IS NULL`
  );
  console.log('Backfilled', n);
  await prisma.$disconnect();
})();
```

- [ ] **Step 2: Rodar**

Run (em `backend/`): `node scripts/backfillPublicId.js`
Expected: `Backfilled <n>`.

- [ ] **Step 3: Verificar zero nulos**

Run (em `backend/`): `node -e "const p=require('./src/config/prisma');p.$queryRawUnsafe('SELECT COUNT(*)::int c FROM pedidos WHERE public_id IS NULL').then(r=>{console.log(r);return p.$disconnect()})"`
Expected: `[{ c: 0 }]`.

- [ ] **Step 4: NO COMMIT** — registrar saída.

---

### Task 8: G5 3c — lookup público por `publicId`

**Files:**
- Modify: `backend/src/controllers/publicController.js:462` (lookup)
- Test: `backend/tests/buscarPedidoPublicId.test.js`

**Interfaces:**
- Consumes: `pedido.publicId`.

- [ ] **Step 1: Escrever teste**

`backend/tests/buscarPedidoPublicId.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../src/repositories/sqlRepository.js', () => ({ buscarPedido: vi.fn(), buscarClientePorId: vi.fn() }));
vi.mock('../src/config/empresaCache.js', () => ({ getEmpresaFromCache: vi.fn(), isEmpresaDisponivel: () => true, getEmpresaFromIdCache: vi.fn(), default: {} }));
import sql from '../src/repositories/sqlRepository.js';
import tokenService from '../src/services/tokenService.js';
const { buscarPedido } = await import('../src/controllers/publicController.js');
function res() { const r = {}; r.status = vi.fn(() => r); r.json = vi.fn(() => r); return r; }

describe('buscarPedido por publicId', () => {
  beforeEach(() => vi.clearAllMocks());
  it('id interno → 404 mesmo com token do dono', async () => {
    const token = tokenService.gerarToken({ id: 1, empresaId: 7, telefone: '21999999999', nome: 'A' });
    sql.buscarClientePorId.mockResolvedValue({ id: 1, telefone: '21999999999' });
    sql.buscarPedido.mockResolvedValue(null); // lookup por publicId não acha "7-001"
    const req = { headers: { authorization: 'Bearer ' + token }, params: { id: '7-001' }, ctx: { empresaId: 7 } };
    const r = res();
    await buscarPedido(req, r, () => {});
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 2: Rodar → deve falhar**

Run (em `backend/`): `npx vitest run tests/buscarPedidoPublicId.test.js`
Expected: FAIL (lookup ainda por `id`).

- [ ] **Step 3: Trocar SOMENTE o lookup**

Em `publicController.js`, dentro de `buscarPedido`, trocar:
```js
const pedido = await sql.buscarPedido(req.params.id, empId);
```
por busca por `publicId`. Adicionar em `pedidoRepository.js` um `buscarPedidoPorPublicId(publicId, empresaId)`:
```js
async buscarPedidoPorPublicId(publicId, empresaId) {
  return prisma.pedido.findUnique({ where: { publicId }, ...(empresaId && { empresaId }) });
}
```
e expor em `sqlRepository.js`. No controller:
```js
const pedido = await sql.buscarPedidoPorPublicId(req.params.id, empId);
```
**Não** criar fallback `id→publicId`. **Não** mudar o resto do handler.

- [ ] **Step 4: Rodar → deve passar**

Run (em `backend/`): `npx vitest run tests/buscarPedidoPublicId.test.js`
Expected: `1 passed`

- [ ] **Step 5: NO COMMIT** — registrar diff.

---

### Task 9: G6 4a — extrair scripts/handlers inline (MÉDIA)

**Files:**
- Create: `js/pages/*.js` (14 arquivos — ver §10.1 do spec)
- Modify: 14 HTMLs

**Interfaces:**
- Produces: zero `<script>` inline e zero `onclick=` inline nos HTMLs.

> **PRÉ-REQUISITO GATE:** só iniciar após produzir o atlas completo
> `handler → seletor + listener` (arquivo `docs/security-audit/g6-inventory.md`).
> **Sem o atlas, NÃO escrever os `.js`.** Este task é o maior do plano — recomenda-se
> executar um HTML por vez (14 sub-tasks independentes).

- [ ] **Step 1: Gerar o atlas**

Para cada HTML de §10.1: listar cada bloco `<script>` (conteúdo → arquivo destino) e cada
handler inline (função → seletor `id`/`data-attr` + tipo de listener). Saída em `g6-inventory.md`.

- [ ] **Step 2: Para cada HTML (1 por vez)**

- Mover o bloco `<script>` inline para `js/pages/<nome>.js` mantendo a ordem.
- Substituir `onclick="fn(x)"` por `data-action="fn"` e um delegador:
```js
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var fn = el.getAttribute('data-action');
  if (typeof window[fn] === 'function') window[fn](el.dataset);
});
```
- Adicionar `<script src="/js/pages/<nome>.js" defer></script>` no HTML.

- [ ] **Step 3: Verificar zero inline**

Run: `grep -rn "<script>" *.html view/*.html | grep -v "src="` → vazio
Run: `grep -rn "on\(click\|change\|submit\|load\)=" *.html view/*.html` → vazio

- [ ] **Step 4: NO COMMIT** — registrar diffs (um por HTML).

---

### Task 10: G6 4c — ligar CSP

**Files:**
- Modify: `vercel.json` (headers HTML)
- Modify: `backend/src/app.js:71-89` (helmet)

- [ ] **Step 1: Adicionar headers no vercel.json**

Em `routes`, antes do catch-all, adicionar header CSP apenas em HTML:
```json
{ "src": "/(.*\\.html)$", "headers": { "Content-Security-Policy": "default-src 'self'; script-src 'self' https://code.iconify.design; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https://lfuhqoujzgenwwvuabez.supabase.co; connect-src 'self' https://backend-sicia-production.up.railway.app; frame-src https://www.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';" }, "dest": "/$1" }
```

- [ ] **Step 2: Endurecer helmet (API JSON)**

Em `app.js`, adicionar `frameAncestors: ["'none'"]` e `objectSrc: ["'none'"]` às directives. **Não** copiar o CSP do HTML.

- [ ] **Step 3: NO COMMIT** — registrar diff.

---

### Task 11: G7 — script RLS

**Files:**
- Create: `docs/security-audit/rls-deny-by-default.sql`

- [ ] **Step 1: Montar a lista de tabelas**

Derivar do `schema.prisma` todos os `@@map(...)` (nomes físicos). Registrar no script.

- [ ] **Step 2: Escrever o script**

```sql
-- PRECHECK (abortar se não for owner)
SELECT current_user, session_user;  -- deve ser postgres.<ref>

-- ENABLE (idempotente)
ALTER TABLE "empresas"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedidos"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processed_webhooks" ENABLE ROW LEVEL SECURITY;
-- ... demais tabelas do schema

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- SEM FORCE ROW LEVEL SECURITY
-- SEM CREATE POLICY
-- ROLLBACK: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Aplicar (após deploy do código)**

Run (Supabase SQL editor): executar o script. Confirmar via precheck.
**Não** aplicar `FORCE`. **Não** criar policies.

- [ ] **Step 4: NO COMMIT** — script é artefato local.

---

### Task 12: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Rodar toda a suíte backend**

Run (em `backend/`): `npx vitest run`
Expected: todos passam.

- [ ] **Step 2: Playwright MCP — URLs da §7 do spec**

Validar: `/` + `/view/cart.html`, `/login.html`→`/dashboard.html`, `/login.html`→`/superadmin.html`,
`/balcao.html` e `/caixa.html` (user e admin), console sem violação de CSP `script`.

- [ ] **Step 3: Aceite positivo**

```
[ ] buscarPedido usa authenticatePublic
[ ] empresaRepository.js não contém processedWebhook.deleteMany({ where: {} })
[ ] authGuard('superadmin') em superadmin.html
[ ] escapeHtml nos 4 sites de admin.js
[ ] Pedido.publicId no schema.prisma
[ ] vercel.json tem Content-Security-Policy com script-src sem unsafe-inline
[ ] script SQL RLS sem FORCE
```

- [ ] **Step 4: NO COMMIT** — entregar relatório ao usuário.

---

## Self-Review (do plano contra a spec)

**Cobertura:** G1→Task 2; G2→Task 3; G3→Task 4; G4→Task 5; G5 3a/3b/3c→Tasks 6/7/8; G6 4a/4c→Tasks 9/10; G7→Task 11. C3-3 fora de escopo (§8). ✅ Todas as 9 no escopo cobertas.

**Placeholders:** nenhum "TBD/TODO"; code blocks presentes em cada passo de código.

**Consistência de tipos:** `buscarPedidoPorPublicId(publicId, empresaId)` definido no Task 8 e consumido no mesmo task. `authGuard(requiredRoles)` definido e consumido no Task 4. `crypto.randomUUID()` usado nos 2 create paths (Task 6).

**Divergência de política:** "Commit" substituído por **NO COMMIT** (regra do usuário prevalece sobre o skill).
