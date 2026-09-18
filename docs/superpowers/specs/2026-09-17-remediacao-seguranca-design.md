# Design — Remediação de Segurança SIC-IA (v2)

**Data:** 2026-09-17
**Status:** Revisado após code review — aguardando aprovação para plano
**Projeto:** SIC-IA — Sistema Inteligente de Cardápio

---

## 0. Regras de Implementação (ler ANTES de qualquer patch)

Estas regras são vinculantes para todo implementador (humano ou agente):

1. **Ler antes de patch.** Abrir cada arquivo citado. Se a âncora de código não existir, **parar** — não "equivaler" nem improvisar.
2. **Não refatorar.** Sem rename, sem extração extra, sem tocar C3-3/`validarCupom`, sem Docker/CI.
3. **Arquivos PROIBIDOS de editar:** `backend/src/middleware/auth.js`, `backend/src/middleware/ownership.js`,
   `backend/src/middleware/resolveEmpresa.js`, e o helper `empresaId(req)` (em qualquer controller).
4. **Não adicionar dependência.** Node 22 já tem `crypto.randomUUID`. Não instalar `uuid`, `DOMPurify`, `helmet` extra, etc.
5. **Uma fase por PR/commit**, na ordem da §6. Não antecipar G5 (coluna `publicId`) na fase 1.
6. **Se o inventário G6 (§10) estiver incompleto, não inventar arquivos `.js`.** Completar o inventário primeiro.
7. **Superadmin bypass de UI ≠ bypass de tenant no backend.** Não "alinhar" o backend.
8. **404, não 403**, em pedido público.
9. **Diff mínimo:** patch cirúrgico. Não reformatar o arquivo.
10. **Não reescrever o design, não "melhorar" autorização (§3), não usar nonces, não usar `FORCE ROW LEVEL SECURITY`,
    não criar policies RLS no padrão Supabase (`auth.uid()`).**

---

## 1. Contexto e Contagem de Achados

A auditoria (16/09/2026) **reportou "11 achados" no resumo gráfico, mas nomeou 10**. O gráfico contou 2 "baixas"
quando só há 1 (`C3-3`). Os itens `C4-1` e `C4-2` são **pontos fortes**, não achados.

**Contagem canônica: 10 achados nomeados.**

| ID | Severidade | Em escopo? |
|----|-----------|-----------|
| C1-1 | Crítica | ✅ |
| C3-1 | Crítica | ✅ |
| C1-2 | Alta | ✅ |
| C3-2 | Alta | ✅ |
| C2-1 | Média | ✅ |
| C2-2 | Média | ✅ |
| C5-1 | Média | ✅ |
| C5-2 | Média | ✅ |
| C5-3 | Média | ✅ |
| **C3-3** | **Baixa** | ❌ **EXCLUÍDO** — ver §8 |

**Escopo: 9 achados. Fora: C3-3 (único).** Nenhum outro achado existe. Não "completar" o design.

---

## 2. Stack Detectada

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js >=22.12 + Express 5.2.1 |
| ORM | Prisma 6.5.0 |
| Banco | PostgreSQL (Supabase `lfuhqoujzgenwwvuabez.supabase.co`, Supavisor pooler :6543) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Frontend | HTML/CSS/JS vanilla, estático na Vercel |
| Deploy | Vercel (frontend) + Railway (`backend-sicia-production.up.railway.app`) |
| Sem | Docker, CI/CD, Helm, Terraform |

---

## 3. Invariantes + Onde Vivem os Middlewares

**Regras que NÃO mudam** (verificadas no código):

1. **Superadmin vê tudo:** `auth.js:42` (`superadmin && empresaId===null` → global); `ownership.js:13` (pula posse); `pedidoRepository.js:23-24` (`empresaId=null` → sem filtro).
2. **Admin/user veem só sua empresa:** `ownership.js:23` (`resource.empresaId !== req.user.empresaId` → 403); `orderController.js:8` (`ctx||user.empresaId`); `auth.js:66` (token cross-tenant → 403).
3. **`Usuario.empresaId` é único.**

**Fato verificado (resolve a contradição D):** `authenticatePublic` e `requireTenant` **já existem em
`backend/src/controllers/publicController.js`** (linhas 56 e 43). **Não estão em `auth.js`.** Portanto
reutilizá-los **não** viola a invariante "não tocar auth.js".

**Contrato G1 usa apenas middlewares existentes:**
- `authenticatePublic` → `publicController.js:56` (lê `Authorization: Bearer <token de cliente>`)
- `requireTenant(req, res)` → `publicController.js:43` (usa `req.ctx.empresaId` do `resolveEmpresa`, intocável)

**Proibido:** editar `auth.js`, `ownership.js`, `resolveEmpresa.js`, `empresaId(req)`.

---

## 4. Especificação por Achado

### G1 — C3-1: IDOR em `buscarPedido` (CRÍTICA)

**Arquivo:** `backend/src/controllers/publicController.js:462-468`
**Rota:** `publicRoutes.js:20` — `router.get('/pedidos/:id', controller.buscarPedido)`
**Fato verificado:** é a **única** rota pública com `:id` de pedido (`listarPedidosCliente` e `criarPedido` não têm `:id`).
Sem consumidor no frontend (tracking usa `meusPedidos()` → `listarPedidosCliente`, já protegido).

**Âncora de código:**
```
ANTES:  exports.buscarPedido = asyncHandler(async (req, res) => { ... })
DEPOIS: exports.buscarPedido = [authenticatePublic, asyncHandler(async (req, res) => { ... })]
```

**Contrato do handler (fase 1 — lookup AINDA por `id`, coluna `publicId` não existe ainda):**
```js
exports.buscarPedido = [authenticatePublic, asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const pedido = await sql.buscarPedido(req.params.id, empId);   // ← fase 1 mantém :id
  if (!pedido || String(pedido.clienteWhatsapp) !== String(req.cliente.telefone)) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  res.json(pedido);   // ← mantém shape atual (PII completa é OK: é o dono do pedido)
})];
```

**Regras:**
- **Não criar** `authenticatePublic`/`requireTenant` — já existem.
- **Não alterar** o JSON de sucesso. Só a distinção 401 (sem token) vs 404 (não é dono/inexistente).
- **Não criar DTO "sanitizado"** — o front não consome, não inventar.
- **Rate limit fora de escopo** — não adicionar middleware.

### G2 — C1-1: Destruição cross-tenant de webhooks (CRÍTICA)

**Arquivo:** `backend/src/repositories/empresaRepository.js:36`
**Fato verificado:** `ProcessedWebhook` tem só `eventId`+`createdAt` — **sem `empresaId`**. É dedup global de webhooks Asaas.
**Fato verificado:** é o **único** `deleteMany({ where: {} })` do `src/`.

**Correção:** remover a linha 36. O restante da transação de deleção (cascata Prisma por `empresaId`) permanece.

**Aceite (estreito):** a string `prisma.processedWebhook.deleteMany({ where: {} })` **não existe mais** em
`empresaRepository.js`. **Não** varrer o repo por outros `where: {}`.

### G3 — C2-1 / C2-2: Gates de UI cosméticos (MÉDIA)

**Arquivo:** `js/utils.js:63` — `authGuard()`

**Contrato (assinatura literal):**
```js
authGuard()                      // só autenticado — inalterado (admin.js fallback)
authGuard('superadmin')          // role exata; superadmin SEMPRE passa
authGuard(['admin', 'user'])     // qualquer uma da lista; superadmin SEMPRE passa
// Falha → window.location.replace('login.html')  (SEM alert, SEM throw)
// authUser ausente/expirado → falha
// authUser.role ausente E requiredRoles informado → falha
// superadmin é bypass: role === 'superadmin' passa em qualquer lista
```

**Call sites — lista FECHADA (não há "etc."):**
| Arquivo:linha | Chamada |
|---------------|---------|
| `superadmin.html:416` | `authGuard('superadmin')` |
| `balcao.html:80` | `authGuard(['admin', 'user'])` |
| `caixa.html:18` | `authGuard(['admin', 'user'])` |
| `js/admin.js:24` (fallback) | `authGuard()` — **manter sem role** (não bloquear `user`) |

**Regras:** `admin.js` **não** recebe role (senão bloqueia `user`). Páginas em `view/*.html` não citadas
**não** são tocadas. Superadmin pode abrir `balcao.html`/`caixa.html` de propósito (bypass).

### G4 — C5-1 / C5-2: XSS em `admin.js` (MÉDIA)

**Âncoras por EXPRESSÃO (linhas driftam, não confiar nelas):**
| Expressão alvo | O que fazer |
|----------------|-------------|
| `${pedidoNome}` em `overlay.innerHTML` (modal entregador) | `escapeHtml(pedidoNome)` |
| `${d.nome}` (entregador) | `escapeHtml(d.nome)` |
| `${d.whatsapp}` (entregador) | `escapeHtml(d.whatsapp || '-')` |
| `p.clienteNome \|\| p.cliente?.nome` (modal editar) | envolver com `escapeHtml(...)` |

**Regras:** usar `escapeHtml` **já existente** em `js/utils.js:35` (não criar outro). **Só esses 4 sites.**
**Não** trocar `innerHTML` por `textContent` (o markup vizinho — spans, botões — depende de HTML).
**Não** puxar DOMPurify. **Não varrer** `cart.js`, `balcao.html`, `caixa.html` (mesmo padrão pode existir, fora de escopo).

### G5 — C3-2: IDs de pedido sequenciais (ALTA)

**Estratégia aprovada:** coluna `publicId` opaca + manter `id` sequencial como número de exibição. Não-destrutivo.

**Fato verificado:** `Pedido` tem `@@map("pedidos")` → backfill usa `pedidos`, não `Pedido`.

**Fato verificado:** há **DOIS** caminhos de criação:
- `publicController.js:395` — `prisma.pedido.create` (checkout público)
- `pedidoRepository.js:119` — `prisma.pedido.create` (via `orderService.criarPedido` → admin/balcão)

**Schema:** `Pedido.publicId String? @unique @map("public_id")` — **nullable durante a transição**.
`NOT NULL` fica para migração futura **fora desta fase** (a spec não exige `NOT NULL`).

**Fases separadas (substituem a antiga "fase 3"):**
| Fase | Ação | Ordem |
|------|------|-------|
| **3a** | Migração: adicionar coluna `public_id` (nullable); `criarPedido` (ambos os caminhos) seta `publicId = crypto.randomUUID()` | schema + código de escrita **no mesmo deploy** (senão insert sem a coluna quebra) |
| **3b** | Backfill (transação): `UPDATE pedidos SET public_id = gen_random_uuid()::text WHERE public_id IS NULL` | **depois** de 3a, **antes** de 3c |
| **3c** | Trocar **SOMENTE** o lookup de `buscarPedido` de `:id` para `:publicId` | depois de 3b |

**Contrato único G1↔G5 (resolve a contradição B):**
```
GET /api/public/pedidos/:publicId
  fase 1: authenticatePublic + requireTenant + match whatsapp; lookup AINDA por id interno
  fase 3c: trocar SOMENTE o lookup para publicId; o resto do handler NÃO muda
  PROIBIDO: fallback id→publicId na rota pública
```

**Contrato de API pública pós-G5:**
- `criarPedido` (público) e `listarPedidosCliente` **passam a incluir `publicId`** no JSON.
- O `id` interno (`{empresaId}-{NNN}`) **permanece** no JSON apenas como número de exibição (o tracking
  `menu.js` já usa `p.id`) — **nunca** como chave de lookup público.
- Admin/interno: **inalterado** (`GET /api/pedidos/{id}`). Nenhum HTML admin troca para `publicId`.
- `publicId` **não entra em logs nem em URLs de admin**.

**Regras:** geração nos **dois** create paths. Não migrar admin para UUID. Não criar fallback na rota pública.

### G6 — C5-3: CSP (MÉDIA)

**Fato verificado:** o CSP em `app.js:72-80` só cobre **respostas JSON da API** (Railway). As páginas HTML são
estáticas na **Vercel** e `vercel.json` **não** define CSP → **hoje o frontend não tem CSP**.
**Nonces são impossíveis** (Vercel serve HTML estático). Detalhes mecânicos na **§10**.

**Decisão (resolve a contradição A):**
- **`script-src` SEM `unsafe-inline`** (exige extrair os 21 blocos e refatorar os 80 handlers).
- **`style-src` COM `unsafe-inline`** na 1ª fase (CSS inline é extração de escopo maior — **não misturar**).
- **Aceite da fase 4:** zero `unsafe-inline` em `script-src`/`script-src-elem`. `style-src` pode manter
  `unsafe-inline` até fase futura. **O grep de aceite (§7) só verifica `script-src`.**

**Ordem obrigatória (não ligar CSP no mesmo commit da extração):**
```
4a: extrair 21 <script> inline → .js externos; refatorar 80 onclick → addEventListener
4b: Playwright verde (sem CSP ligado ainda)
4c: ligar CSP (Report-Only primeiro, depois enforce)
```
`Content-Security-Policy-Report-Only` por uma janela antes de `enforce` é **recomendado**; se não fizer,
registrar como decisão consciente.

### G7 — C1-2: RLS deny-by-default (ALTA)

**Fato verificado:** connection string usa role **owner** (`postgres.<ref>`). Supabase só para Storage;
nenhuma chave Supabase no frontend. Detalhes SQL na **§11**.

**Estratégia:** habilitar RLS com **deny-by-default** (sem políticas permissivas). Backend (owner) bypassa → app
inalterada. **Precondições críticas:**
- **SEM `FORCE ROW LEVEL SECURITY`** (senão o owner é afetado e superadmin/admin quebram).
- **Não criar policies** `USING (empresa_id = ...)` / `auth.uid()` — este app **não** tem JWT Supabase e a
  conexão é owner. Policies no padrão Supabase estão **erradas aqui**.
- Precheck obrigatório: `SELECT current_user, session_user;` → deve ser owner. **Abortar se não for.**
- REVOKE de `anon`/`authenticated` (o threat model real do REST Supabase é GRANT, não só RLS vazio).
- `ProcessedWebhook` (sem `empresaId`): deny + owner bypass = OK para backend; REST anon = 0 rows.
  **Não** criar policy permissiva para webhook.
- **Storage (policies de bucket): fora de escopo.**

---

## 5. Fluxo de Dados — `publicId` (contrato unificado)

```
Cliente faz pedido
  → POST /api/public/pedidos
  → cria id={empresaId}-{NNN} + publicId=uuid ; resposta inclui publicId

Cliente consulta (autenticado como cliente)
  → GET /api/public/pedidos/{publicId}          (fase 3c; fase 1 era {id})
  → authenticatePublic valida token
  → lookup por publicId + valida clienteWhatsapp === req.cliente.telefone
  → 200 (próprio) | 404 (de outro / inexistente)

Admin/superadmin (INALTERADO)
  → GET /api/pedidos/{id}   (id interno sequencial)
  → authenticate + requireOwnership + authorize
  → superadmin: tudo | admin/user: só sua empresa
```

---

## 6. Fases de Rollout

| Fase | Conteúdo | Banco | Verificação |
|------|----------|-------|-------------|
| 0 | Baseline: snapshot Railway + `npx prisma migrate diff` + commit hash. **Não** rodar pg_dump daqui | — | diff registrado |
| 1 | G1 + G2 (backend) | — | vitest (§7) |
| 2 | G3 + G4 (frontend) | — | build + Playwright MCP |
| 3a | G5 schema + escrita (`publicId`) | migração coluna | vitest |
| 3b | G5 backfill | SQL transação | contagem null=0 |
| 3c | G5 lookup público | — | vitest + Playwright |
| 4a | G6 extração scripts/handlers | — | Playwright |
| 4b | G6 Playwright verde | — | Playwright |
| 4c | G6 ligar CSP (Report-Only → enforce) | — | Playwright console |
| 5 | G7 RLS | SQL script (§11) | teste direto DB |

**Rollback:** fases independentes. `publicId` nullable → reverter código sem perder dados. RLS:
`DISABLE ROW LEVEL SECURITY` por tabela (não há policies a dropar).

---

## 7. Testes e Verificação

**vitest — path:** `backend/tests/` (padrão do repo: `tests/corsOrigin.test.js`, `tests/resolveEmpresa.test.js`).

| ID | Teste | Fixtures |
|----|-------|----------|
| G1 | sem token → **401**; token de outro cliente → **404**; token do dono → **200**; `publicId` de outro tenant → **404** | emitir token via `tokenService.gerarToken({id,empresaId,telefone,nome})`; pedido com `clienteWhatsapp` do outro |
| G2 | `deleteEmpresa(A)` **não chama** `processedWebhook.deleteMany` (spy) **e** count da tabela inalterado | spy em `prisma.processedWebhook.deleteMany` |
| G5 | `GET /api/public/pedidos/{idInterno}` → **404 mesmo com token do dono**; `GET .../{publicId}` → 200 | — |

**Playwright MCP — lista fechada de URLs (baseURL `http://localhost:5173`):**
| Fluxo | URL |
|-------|-----|
| Cardápio guest → add → carrinho → checkout | `/` e `/view/cart.html` |
| Login admin → dashboard | `/login.html` → `/dashboard.html` |
| Login superadmin → superadmin | `/login.html` → `/superadmin.html` |
| Operacional como **user** e como **admin** | `/balcao.html`, `/caixa.html` |
| Pós-CSP: console sem violação de `script` | todas acima |

**Aceite POSITIVO (checks, não grep negativo amplo):**
```
[ ] buscarPedido usa authenticatePublic
[ ] empresaRepository.js NÃO contém "processedWebhook.deleteMany({ where: {} })"
[ ] authGuard('superadmin') em superadmin.html
[ ] escapeHtml(pedidoNome) / escapeHtml(d.nome) / escapeHtml(d.whatsapp) / escapeHtml(p.clienteNome)
[ ] Pedido.publicId no schema.prisma
[ ] vercel.json tem Content-Security-Policy com script-src sem unsafe-inline
[ ] script SQL RLS sem FORCE ROW LEVEL SECURITY
```

---

## 8. Fora de Escopo (nomeado e explícito)

| Item | Motivo |
|------|--------|
| **C3-3** (`validarCupom` sem auth) | Usado no checkout **guest** (`cart.js:587`); checkout não exige login. Adicionar auth quebra o fluxo. Risco aceito (BAIXA). |
| Rate limit em `buscarPedido` | LLM não deve adicionar middleware. |
| DTO "sanitizado" no G1 | Sem consumidor no front. |
| Varredura XSS em `cart.js`/`balcao.html`/`caixa.html` | G4 é cirúrgico nos 4 sites. |
| Extração de CSS inline | Escopo maior — não misturar com G6. |
| Policies RLS `USING (empresa_id=...)` | Conexão é owner; não há JWT Supabase. |
| Policies de bucket do Storage | Fora do escopo do RLS. |
| `NOT NULL` em `publicId` | Migração futura. |
| Migrar IDs de admin para UUID | Proibido. |

---

## 9. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| G7 quebra acesso se `FORCE` | Precheck `current_user`; script sem `FORCE` |
| G1/G5 conflito de fase | Contrato único (§4 G1/G5); 3a/3b/3c separadas |
| G6 quebra o cardápio | Ordem 4a→4b→4c; Report-Only; inventário §10 |
| G5 insert quebra | 3a = schema+código juntos; 3b backfill antes de 3c |
| G4 "consertar o arquivo inteiro" | Âncoras por expressão; só 4 sites |
| G3 bloquear `user` | `admin.js` sem role; lista fechada |

---

## 10. Apêndice G6 — Inventário Mecânico + CSP Literal

### 10.1 Inventário de `<script>` inline (por arquivo)

| Arquivo | Blocos | Destino sugerido |
|---------|--------|------------------|
| `404-subscription.html` | 1 | `js/pages/404-subscription.js` |
| `alterar-senha.html` | 1 | `js/pages/alterar-senha.js` |
| `balcao.html` | 2 | `js/pages/balcao.js` |
| `caixa.html` | 2 | `js/pages/caixa.js` |
| `dashboard.html` | 1 | `js/pages/dashboard.js` |
| `entregador.html` | 2 | `js/pages/entregador.js` |
| `financeiro.html` | 1 | `js/pages/financeiro.js` |
| `integracoes.html` | 1 | `js/pages/integracoes.js` |
| `login.html` | 1 | `js/pages/login.js` |
| `painelLoja.html` | 2 | `js/pages/painelLoja.js` |
| `relatorios-entregadores.html` | 2 | `js/pages/relatorios-entregadores.js` |
| `relatorios.html` | 2 | `js/pages/relatorios.js` |
| `superadmin.html` | 2 | `js/pages/superadmin.js` |
| `whatsapp.html` | 1 | `js/pages/whatsapp.js` |
| `view/cart.html` | — | (já usa externos) |

**Total: 21 blocos, 14 arquivos.**

### 10.2 Inventário de handlers inline (funções chamadas)

`fecharModal`(6), `calcularTotalFinal`(4), `removerItem`(2), `fecharOverlayPedidos`(2), `editarSabores`(2),
`criarFilial`(2), `atualizarFormulario`(2), `abrirAba`(2), `toggleSidebar`, `toggleSidebarCollapse`,
`togglePedidos`, `toggleAtivo`, `savePricing`, `salvarSenhaCliente`, `salvarEntregador`, `salvarEdicaoEmpresa`,
`salvarEdicaoCliente`, `reconectar`, `pagar`, `onEmpresaChange`, `logout`, `gerarQR`, `fecharPix`,
`fecharOverlayBairro`, `fecharOverlay`, `fecharModalReset`, `fecharCaixa`, `excluirUsuario`, `excluirInstancia`,
`excluirEntregador`, `excluirEmpresa`, `excluirCliente`, `enviarTeste`, `editarEntregador`, `diminuirQtd`,
`verRelatorios`, `Financeiro` (+ `this`, `event`, `document` — expressões, não funções).

**Total: 80 handlers.** Atlas completo `handler → seletor + listener` será produzido como **passo 0 da fase 4a**
(arquivo de inventário). **Sem esse atlas completo, NÃO escrever os `.js`.**

**Handlers fora do inventário:** `onchange`, `onsubmit`, `onload`, `javascript:` href — **ou** entram no atlas,
**ou** o CSP precisa ceder. Decidir no passo 0 da 4a.

### 10.3 Terceiros a liberar no CSP (inventário de origins)

| Origin | Uso | Diretiva |
|--------|-----|----------|
| `cdn.jsdelivr.net` | bootstrap-icons | `style-src` |
| `cdnjs.cloudflare.com` | libs | `style-src` |
| `code.iconify.design` | iconify runtime | `script-src` |
| `fonts.googleapis.com` | Google Fonts | `style-src` |
| `fonts.gstatic.com` | Google Fonts | `font-src` |
| `www.google.com` | iframe de mapa | `frame-src` |
| `lfuhqoujzgenwwvuabez.supabase.co` | imagens (Storage) | `img-src` |
| `backend-sicia-production.up.railway.app` | API | `connect-src` |

### 10.4 CSP literal (Vercel — rotas HTML)

```
default-src 'self';
script-src 'self' https://code.iconify.design;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
img-src 'self' data: blob: https://lfuhqoujzgenwwvuabez.supabase.co;
connect-src 'self' https://backend-sicia-production.up.railway.app;
frame-src https://www.google.com;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
```

**Em `vercel.json`:** `headers` apenas em `/*.html`, `/view/*.html` e `/`. **Não** em `/api/*` (API é Railway).

**Helmet (backend):** CSP de API JSON já existe em `app.js:72-80` — **endurecer** `frame-ancestors: 'none'` e
`object-src: 'none'`. **Não copiar** o CSP do HTML para o JSON.

---

## 11. Apêndice G7 — Script RLS

**Precheck (obrigatório — abortar se não for owner):**
```sql
SELECT current_user, session_user;   -- deve ser postgres.<ref>
```

**Aplicar (idempotente; ENABLE 2x é seguro):**
```sql
ALTER TABLE empresas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhooks  ENABLE ROW LEVEL SECURITY;
-- ... demais tabelas do schema (lista completa derivada do schema.prisma na fase 5)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- SEM FORCE ROW LEVEL SECURITY
-- SEM CREATE POLICY  (deny-by-default; owner bypassa)
```

**Rollback:**
```sql
ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;   -- por tabela; não há policies a dropar
```

**Lista de tabelas** derivada do `schema.prisma` (nomes físicos via `@@map`) na fase 5 — inventário fechado
antes de aplicar.

---

## 12. Arquivos Afetados (resumo)

**Backend:** `publicController.js`, `empresaRepository.js`, `schema.prisma`, `sqlRepository.js`,
`pedidoRepository.js`, `app.js`
**Frontend:** `utils.js`, `admin.js`, HTMLs (§10.1), `view/cart.html`
**Config:** `vercel.json`
**Novos:** migração Prisma `publicId`; script SQL RLS (§11); atlas G6 (§10.2)
**Proibidos:** `auth.js`, `ownership.js`, `resolveEmpresa.js`, `empresaId(req)`
