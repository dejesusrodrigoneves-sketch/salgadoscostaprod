# Migração do Backend para Railway (DB permanece no Supabase) — Design

- **Data:** 2026-09-13
- **Status:** Aprovado (design) — pronto para plano de implementação
- **Fase:** Fase 2 (separação frontend Vercel × backend Railway)
- **Autor:** sessão de brainstorming

## Objetivo

Mover o backend (`server.js`, Express) do Vercel serverless para a **Railway** como serviço
de longa duração (1 réplica), para que **crons e workers voltem a executar 24/7**. O banco
**permanece no Supabase** nesta fase. O frontend continua no Vercel (estático).

**Fora de escopo agora:** domínio próprio (`api.seudominio.com`), migração do banco,
migração para VPS (HostGator/Hostinger). Ficam para etapa futura.

## Contexto atual

| Componente | Onde roda hoje | Observação |
|---|---|---|
| Frontend (HTML/JS) | Vercel (estático) | segue igual |
| Backend | Vercel serverless (`backend/api.js`) | crons/workers **não rodam** |
| Banco | Supabase PostgreSQL (pooled) | segue igual |
| Storage | Supabase Storage | segue igual |
| WhatsApp | Evolution API (Railway) | já na Railway; sem mudança |

Motivação central: `pixExpirationJob`, `weeklySettlement`, `filialBillingCron` e
`billingWorker` só existem em `server.js`; o serverless nunca os executa.

## Arquitetura e topologia

```
Navegador
  ├─ <loja>.vercel.app / admin-sicia / login-sicia  (Vercel, estático)
  │     └─ js/config.js → SIC_API_BASE = https://<svc>.up.railway.app
  │
  └─ fetch ──► Railway (1 réplica, node server.js)  ──►  Supabase Postgres
                 ├─ Express 5 + crons/workers (pixExpiration, weeklySettlement,
                 │   filialBillingCron, billingWorker)  ← rodam 24/7
                 ├─ tenant via Origin + CORS dinâmico
                 └─ Supabase Storage / Evolution API (já Railway)
```

**Fluxo de tenant (produção):**
- Request chega na Railway com `Host: <svc>.up.railway.app` e `Origin: https://<loja>.vercel.app`.
- `resolveEmpresa` **ignora o Host da API** e resolve o tenant pelo `Origin`
  (extrai `<loja>`, valida contra `empresa.slug` no cache).
- Rotas autenticadas: tenant vem do `JWT` (`empresaId`), não do Origin.
- `?slug=` só é aceito quando `NODE_ENV !== 'production'` (dev local).

**Fallback:** Vercel `/api/*` (`backend/api.js`) permanece no `vercel.json` por **50 dias**
como rollback; depois removido. Frontend continua no Vercel.

## Componentes e interfaces

### A) Deploy (Railway)
- **`/backend/railway.json`** (novo; caminho explícito por causa do Root Directory = `backend`):
  ```json
  {
    "build": { "builder": "RAILPACK" },
    "deploy": {
      "preDeployCommand": "npx prisma migrate deploy",
      "startCommand": "node server.js",
      "healthcheckPath": "/health",
      "restartPolicyType": "ON_FAILURE"
    }
  }
  ```
- Builder **Railpack** (não nixpacks).
- `backend/package.json` (modificar): `"postinstall": "prisma generate"`.
- Config Railway: Root Directory = `backend`, 1 réplica.

### B) Tenant (`backend/src/middleware/resolveEmpresa.js` — modificar)
- Ordem: **Origin** (prod) → **Host** (só se não for o host da API) → **`?slug=`** (só em dev).
- `API_HOST = process.env.API_HOST || process.env.RAILWAY_PUBLIC_DOMAIN` (fallback).
- Conflito `Origin` × `?slug=` → vence o `Origin`. Nunca resolver tenant incorreto.
- `IGNORED` (`www`, `api`, `admin`, `admin-sicia`, `login-sicia`…) → autenticado usa JWT.
- Slug inexistente/deletado → `404`; erro inesperado → `next(err)`.

### C) CORS (`backend/src/middleware/corsOrigin.js` — novo)
- **Não** trata `vercel.app` genericamente. Origem permitida somente se:
  1. sem `Origin` (curl/webhooks) → permitir; **ou**
  2. host ∈ lista fixa `CORS_ORIGIN` (ex.: `admin-sicia.vercel.app`, `login-sicia.vercel.app`); **ou**
  3. host = `<slug>.<CORS_BASE_DOMAIN>` **e** `<slug>` corresponde a `empresa` existente e não-deletada no cache.
- `CORS_BASE_DOMAIN` é env explícito (sem default). Ausente → nenhuma origem dinâmica.
- Preview URLs (`proj-abc123.vercel.app`) e slugs inexistentes → bloqueados.
- **Fail-closed:** erro de cache/DB na validação → **rejeitar**.
- **Nota:** CORS é política de navegador — **não substitui autenticação nem isolamento multi-tenant**.
  Autorização real = JWT + escopo `empresaId` (Fase 3).
- `app.js` (modificar): `cors({ origin: corsOriginValidator })`.

### D) Frontend API base
- `js/config.js` (novo, carregado 1º em cada HTML):
  ```js
  window.SIC_API_BASE = '';                    // '' = same-origin (Vercel). Flipe p/ Railway no corte.
  window.getApiBase = function () {
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
    return window.SIC_API_BASE || '';          // vazio => same-origin (fallback Vercel)
  };
  ```
- Refatorar para `getApiBase()`: `apiHelper.js`, `admin.js`, `painel.js`, `superadminBilling.js`,
  `filiais.js`, `subscriptionOverlay.js`, `filialPricingOverlay.js`, `superadmin-integracoes.js`,
  `superadminDashboard.js`, `superadmin-audit.js`.
- Remover `?slug=` do `apiHelper` em prod; manter só em dev.
- Inserir `<script src="js/config.js">` antes dos demais scripts em todas as HTML.

### E) Webhooks (config externa, sem código)
- Repointar Asaas + marketplaces para `https://<svc>.up.railway.app/...`.
- Evolution API já na Railway (sem mudança).

### F) Variáveis de ambiente novas
- `API_HOST` (fallback `RAILWAY_PUBLIC_DOMAIN`).
- `CORS_BASE_DOMAIN` (explícito, sem default).
- `CORS_ORIGIN` (lista fixa: admin/login).

## Fluxo de corte (phased)

```
Fase 0 — Prep (código, sem deploy)
  config.js · resolveEmpresa(Origin) · corsOrigin.js · railway.json · postinstall
  refatorar 10 JS + HTML para getApiBase()

Fase 1 — Deploy Railway
  GitHub → projeto → serviço backend (Root Dir=backend, 1 réplica)
  NÃO criar PostgreSQL na Railway (DB segue no Supabase)
  copiar env do Vercel + API_HOST/CORS_BASE_DOMAIN
  preDeploy: prisma migrate deploy → start: node server.js → /health ok

Fase 2 — Validação (sem tocar produção)
  smoke + Playwright MCP contra a URL Railway

Fase 3 — Corte
  js/config.js: SIC_API_BASE = 'https://<svc>.up.railway.app' → deploy Vercel
  repointar webhooks Asaas + marketplaces para Railway
  monitorar (Gate 4)

Fase 4 — Janela de rollback (50 dias)
  Vercel /api/* permanece. Rollback = SIC_API_BASE='' + redeploy Vercel.

Fase 5 — Limpeza (após 50 dias)
  remover rota /api/* + backend/api.js do vercel.json
```

**Request pública pós-corte:**
`<loja>.vercel.app` → `fetch https://svc.up.railway.app/api/public/...` com
`Origin: https://<loja>.vercel.app` → Railway: CORS valida origem (slug existe) →
`resolveEmpresa` resolve tenant pelo Origin → controller → Supabase → resposta.

**Request autenticada:** `admin-sicia.vercel.app` → `Authorization: Bearer` → Railway:
CORS (host fixo) → `authenticate` → tenant do JWT → controller → Supabase.

## Error handling, resiliência e rollback

### 1. Deploy / release
- `preDeployCommand`: `npx prisma migrate deploy` — **nunca** `--accept-data-loss`.
- Se o `preDeployCommand` falhar, o **novo deployment não entra em produção** e a
  **versão ativa permanece atendendo tráfego**.
- `restartPolicyType: ON_FAILURE` mantido e **explícito** (já é o default da Railway;
  documentado para clareza).

### 2. Rollback × migrations (crítico)
- Rollback de **código não reverte** migrations já aplicadas.
- Coexistência Vercel/Railway (50 dias) exige migrations **backward-compatible** com a versão anterior.
- Evitar migrations destrutivas (drop de coluna, mudança de tipo/enum, coluna `NOT NULL`
  sem default) que impeçam o código antigo de funcionar.

### 3. Graceful shutdown (`SIGTERM` em `server.js`)
Ordem exata, **idempotente**:
1. marcar estado de shutdown;
2. bloquear novas tarefas/jobs;
3. parar crons/workers (`pixExpiration`, `weeklySettlement`, `filialBillingCron`, `billingWorker`);
4. `server.close()`;
5. `prisma.$disconnect()`;
6. encerrar processo.
- Respeitar a janela de draining da Railway (`RAILWAY_DEPLOYMENT_DRAINING_SECONDS=60`).

### 4. Healthcheck / readiness
- `/live` → **processo vivo** (liveness).
- `/health` → **readiness real**: app pronta **+** DB disponível (`SELECT 1` com timeout curto).
  - `200` se app + DB prontos; `503` se DB indisponível.
- `railway.json` usa `healthcheckPath: /health` (readiness real). Nunca `200 OK` com DB fora.

### 5. Prisma + Supabase
- `DATABASE_URL` = conexão **pooled** (runtime).
- `DIRECT_URL` = conexão **direta** para migrations/CLI.
- Documentar como "conexão direta para CLI/migrations", sem amarrar a uma propriedade
  específica (`directUrl`) caso o projeto migre para config moderna (`prisma.config.ts`).

### 6. CORS — **fail-closed**
- Erro de cache/DB na validação de origem → **rejeitar**. Nunca liberar por falha de resolução.
- Sem `Origin` (server-to-server/webhooks) → permitir, lembrando que autenticação/autorização
  continuam obrigatórias.

### 7. Tenant
- Slug inexistente/deletado → `404`; erro inesperado → `next(err)` → `500`.
- **Nunca** selecionar outro tenant em cache miss/erro; nunca deixar request pendurada.

### 8. Rollback (50 dias) — conceito completo
- **Frontend:** `js/config.js` → `SIC_API_BASE=''` + redeploy Vercel.
- **Backend/API:** Vercel `/api/*` ativo; Railway permanece **disponível para diagnóstico**
  (não pausar como procedimento padrão).
- **Webhooks:** voltar **manualmente** às URLs Vercel (Asaas/marketplaces).
- **Banco:** compatível com **as duas versões** (ver regra dos 50 dias).
- Mesmo `JWT_SECRET` nos dois ambientes → sessões sobrevivem.

**Regra crítica dos 50 dias:** durante a coexistência, **rollback de código deve continuar
possível sem quebrar o banco** — toda migration nova segue estratégia backward-compatible
(colunas, índices, enums e contratos usados pelo código antigo).

## Estratégia de testes

Nomenclatura: **`CORS_BASE_DOMAIN`**.

### Gate 1 — Unit (middlewares)
- `corsOrigin` (fail-closed):
  - origem fixa permitida (`admin-sicia`, `login-sicia`);
  - `<slug>.<CORS_BASE_DOMAIN>` com slug existente → permitida;
  - slug inexistente → bloqueada; tentativa de bypass de tenant → bloqueada;
  - preview URLs (`proj-abc123.vercel.app`) → bloqueadas;
  - Origin malformada (`null`, `file://`, sem esquema, com userinfo, porta inesperada) → bloqueadas;
  - host malicioso (`evil.vercel.app`, sufixo enganoso `x.vercel.app.evil.com`, `vercel.app` puro) → bloqueadas;
  - `CORS_BASE_DOMAIN` ausente → nenhuma origem dinâmica;
  - erro de cache/DB → **rejeitar**.
- `resolveEmpresa` (ampliar): tenant por `Origin` · `API_HOST`/`RAILWAY_PUBLIC_DOMAIN` ignorado ·
  `?slug=` só em dev · prod ignora `?slug=` · conflito `Origin` × `?slug=` → vence `Origin` ·
  nunca resolver tenant incorreto · slug inexistente → 404 · erro → `next(err)`.
- `/health` readiness: DB ok → 200; DB fora → 503; `SELECT 1` com timeout curto e **sem pendurar**;
  `/live` → 200 sempre.

### Gate 2 — Smoke HTTP contra Railway (antes do corte)
- Script `scripts/smoke-railway.sh` — **sem credenciais hardcoded** (lê de env:
  `SMOKE_USER`, `SMOKE_PASS`, `SMOKE_SLUG`, etc.).
- Valida: `/live` 200 · `/health` 200 · `/api/public/produtos` com `Origin` válida → tenant correto ·
  `Origin` inválida → bloqueada · login → token · pedido com cupom → 201 + total server-side ·
  autorização cross-tenant (token da loja A acessando recurso da loja B → 403/404).
- Limpeza **idempotente** dos registros de teste (rodável N vezes sem resíduo).

### Gate 3 — E2E Playwright
- Dados/tenants **de teste isolados** (não tocar dados reais).
- Fluxos: menu público via Railway · carrinho · cupom · checkout · login admin · painel.
- **Pelo menos 1 cenário explícito de isolamento multi-tenant** (loja A não vê dados da loja B).
- Linha de base contra Vercel para comparação.

### Gate 4 — Pós-corte (monitoramento)
- Janela de monitoramento definida (ex.: 48h) com critérios.
- Critérios objetivos de rollback: erro 5xx acima da linha de base · falha de cron/worker ·
  login/pedido/cupom quebrados · **qualquer suspeita de falha de isolamento multi-tenant →
  rollback imediato**.

### Gate 5 — Rollback testado
- `SIC_API_BASE=''` num preview Vercel → validar login, produtos, pedido, cupom, JWT e tenant
  funcionando via Vercel `/api`.
- Comprovar que migrations aplicadas pela Railway **não quebraram a versão Vercel**.

### Gate 6 — Regressão (Fase 3 mantida), classificada em:
- **Funcional:** fluxos de pedido/cupom/estoque.
- **Segurança multi-tenant:** `isolationAB`, `pedidoSeguro`, `driverWhitelist`, `resolveEmpresa`.
- **Integridade de dados:** `cupomAtomico`, `estoqueAtomico`.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Tenant resolvido errado pós-split | Origin primário; testes de conflito; fail-closed |
| Migration destrutiva quebra rollback | Backward-compatible durante 50 dias |
| Deploy entra quebrado | preDeploy aborta e mantém versão ativa |
| DB fora e health mascarar | `/health` readiness real (503) |
| Redeploy corta jobs abruptamente | Graceful shutdown ordenado + draining |
| CORS permissivo demais | Validação por slug, sem `vercel.app` genérico |
| Segredo JWT estático | Rotação futura (fora desta fase, por decisão) |

## Decisões registradas
- Abordagem **incremental com config runtime** (não proxy Vercel, não domínio próprio).
- DB permanece no **Supabase** nesta fase.
- `JWT_SECRET` **não rotacionado** agora (rotação futura planejada).
- Webhooks repointados no corte; Evolution API inalterada.
- Fallback Vercel `/api` por **50 dias**.
- Nomenclatura `CORS_BASE_DOMAIN`.
