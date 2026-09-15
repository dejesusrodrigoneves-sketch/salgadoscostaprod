# AUDIT.md — Auditoria Arquitetural & Baseline

> **FASE 1 — somente leitura.** Nenhum código, dependência, migration, commit ou deploy foi alterado.
> Todas as afirmações são classificadas como **EVIDÊNCIA**, **SUPOSIÇÃO** ou **NÃO VERIFICADO**.
> Nenhum valor de segredo é reproduzido neste documento.

- **Data:** 2026-09-12
- **Projeto:** SIC-IA / salgadoscosta (monorepo: frontend estático + backend Node/Express)
- **Objetivo:** preparar para Vercel (frontend) + Railway (backend) + Supabase (PostgreSQL + Storage), com caminho de saída para VPS/PostgreSQL próprio sem reescrita.

---

## 1. Arquitetura atual

**EVIDÊNCIA**
- Monorepo com dois blocos no mesmo diretório:
  - Frontend estático: `*.html` (19 páginas), `js/` (25 arquivos, ~7.296 LOC), `css/`, `view/`, `public/`.
  - Backend: `backend/` (124 arquivos JS em `src/`, ~10.546 LOC), Node.js + Express 5, Prisma 6.
- Backend organizado em camadas: `routes/` → `controllers/` → `services/` → `repositories/` → Prisma → PostgreSQL. 74 arquivos de rota/controller/service/repo.
- Banco: PostgreSQL (Supabase) via Prisma (`backend/prisma/schema.prisma`, 34 models).
- Storage: Supabase Storage, usado diretamente em `backend/src/routes/uploadRoutes.js` (bucket `produtos`).
- Integrações: Asaas (pagamentos/split), Evolution (WhatsApp), FCM (push), marketplaces iFood/Keeta/99Food (OAuth + financeiro) em `backend/src/integrations/`.
- Deploy: Vercel (`vercel.json` na raiz) serve estáticos **e** o backend serverless via `backend/api.js`.

**SUPOSIÇÃO**
- Ambientes `staging` e `production` separados; não há manifesto de ambientes no repo.

**NÃO VERIFICADO**
- Região do PostgreSQL Supabase; plano/limites de conexões; DNS/domínios configurados no Vercel.

---

## 2. Fluxo frontend → backend → banco

**EVIDÊNCIA**
- Frontend chama API relativa `/api/...` (`js/apiHelper.js` usa `base = '/api/public'`; `api()` em `js/admin.js:2-8`).
- Em dev, `vite.config.js` faz proxy `/api` e `/img` → `http://localhost:3000`.
- Em produção (Vercel), `vercel.json` roteia `/api/(.*)` → `backend/api.js` (mesma origem).
- 3 arquivos frontend têm base de API hardcoded para dev: `js/filiais.js:2`, `js/superadminBilling.js:3`, `js/superadminDashboard.js:3` (`window.location.port === '5173' ? 'http://localhost:3000' : ''`).
- Tenant resolvido por subdomínio via `backend/src/middleware/resolveEmpresa.js` (ou `?slug=` em hosts sem ponto).
- Autenticação: JWT Bearer (`backend/src/middleware/auth.js`), com `empresaId` do token como escopo de tenant; superadmin tem `empresaId: null` (acesso global).
- Prisma acessa PostgreSQL pooled (`?pgbouncer=true`) com `directUrl` separado para migrations (`schema.prisma:5-9`).

**SUPOSIÇÃO**
- O JWT do cliente público é gravado em `localStorage` (`js/apiHelper.js: getToken/setToken`), não em cookie httpOnly.

---

## 3. Dependências

**EVIDÊNCIA — backend (`backend/package.json`)**
- Runtime: `express@^5.2.1`, `@prisma/client@^6.5.0`, `prisma@~6.5.0`, `@supabase/supabase-js@^2.110.1`, `axios@^1.17.0`, `bcryptjs@^2.4.3`, `firebase-admin@^14.3.0`, `jsonwebtoken@^9.0.3`, `multer@^2.2.0`, `helmet@^8.0.0`, `cors@^2.8.6`, `express-rate-limit@^7.5.0`, `compression@^1.8.1`, `node-cron@^4.6.0`, `pg@^8.22.0`, `qrcode@^1.5.4`, `dotenv@^17.4.2`.
- Dev: `vitest@^2.0.0`, `supertest@^7.2.2`, `nodemon@^3.1.0`.
- **npm audit (runtime, `--omit=dev`): 12 vulnerabilidades (3 high, 8 moderate, 1 low)** — destaques: `axios@1.17.0` (10 advisories), `multer@2.2.0` (4 DoS), `form-data@4.0.5` (CRLF), `body-parser@2.2.2`, `qs@6.15.3`, `uuid` (via `firebase-admin`).

**EVIDÊNCIA — frontend (`package.json`)**
- `@sentry/node@^10.70.0` (dependência de runtime no pacote raiz); dev: `vite@^6`, `vitest@^2`, `@playwright/test@^1.63`.

**NÃO VERIFICADO**
- Se `@sentry/node` é realmente usado no backend ou no frontend.

---

## 4. Riscos (arquiteturais / operacionais)

**EVIDÊNCIA — ALTO**
- **Crons/workers não rodam no deploy atual.** `backend/api.js` (entrypoint do Vercel) apenas exporta `app`; os jobs são iniciados somente em `backend/server.js:17-70` (`iniciarPixExpirationJob`, `weeklySettlement.start`, cron filial billing 00:01, `filialBillingWorker.start`, cleanup de auditoria). No Vercel isso **não executa**.
- **`subscriptionCron.js` é código morto.** Exporta `runSubscriptionCron` (`src/cron/subscriptionCron.js:27`) e **nenhum** caller no repo (grep).
- **SSE de pagamento é stateful em memória.** `src/services/paymentService.js:10` (`new EventEmitter`), consumido por `src/routes/paymentRoutes.js:33`. Webhook processado em uma instância não notifica SSE em outra.

**EVIDÊNCIA — MÉDIO**
- **Estado em memória usado para corretude/segurança:** `tokenService.js:9,12` (refresh/revoked Sets), `authService.js:11` (`failedAttempts` → lockout), `publicController.js:15` (`failedClientLoginAttempts`), `empresaCache.js:3,4` (cache de tenant), `auth.js:16` (cache de token), `tokenService.js:55` (`setInterval` de limpeza). Em multi-instância/serverless, revogação e lockout não se propagam.
- **Fila de auditoria in-memory.** `src/services/auditQueue.js` acumula em buffer e faz flush por `setTimeout` (1s). Em serverless, a função pode congelar antes do flush → perda de logs. Nenhum caller de `flushNow` em shutdown (grep).
- **Pool do Prisma sem `connection_limit`.** `backend/.env:15` usa `?pgbouncer=true` mas sem `connection_limit=1`. Em serverless, cada instância abre seu próprio pool → risco de esgotar conexões do Supabase.
- **`DATABASE_URL` e `POSTGRES_PRISMA_URL` têm credenciais divergentes** no `.env` (dois usuários/senhas). Config possivelmente obsoleta (não reproduzir valores).
- **Sem graceful shutdown** (sem handlers `SIGTERM`/`SIGINT` em `server.js`).
- **Sem Dockerfile / docker-compose / CI.** Não há `.github/workflows`.

**EVIDÊNCIA — BAIXO**
- **Bug funcional:** `backend/src/routes/publicRoutes.js:4` usa `require('../config/prisma.js').default`, mas `config/prisma.js` exporta CJS direto (`module.exports = prisma`) → `.default` é `undefined`; `prisma.empresa.findUnique` lança e o `catch` devolve `{}`. Logo `GET /api/public/empresa/:slug/contact` sempre retorna vazio.
- **Divergência teste×código (tenant):** `resolveEmpresa.js:9-18` honra `?slug=` em host sem subdomínio; `tests/resolveEmpresa.test.js:100` espera que `?slug=` seja **ignorado** ("IDOR previsto"). Teste falha no baseline.
- **URL Asaas hardcoded:** `backend/src/controllers/adminController.js:69` usa `https://api-sandbox.asaas.com/v3/customers` mesmo com `ASAAS_ENV=production`; `src/services/asaasClient.js:5-7` já deriva a base correta por env.

---

## 5. Segurança

**EVIDÊNCIA — POSTURA**
- Autenticação/autorização centralizadas em `src/middleware/auth.js` com papéis `superadmin|admin|user|entregador`; validação `empresaId < 1` e checagem de tenant contra `req.ctx.empresaId` (`auth.js:59-61`).
- Multi-tenant por escopo `empresaId(req)` passado a services/repos (padrão consistente verificado em produto, categoria, entregador, pedido, caixa, entrega, financeiro).
- Upload (`uploadRoutes.js`): validação de extensão + MIME + magic bytes + sanitização de SVG, `fileSize` 5MB.
- OAuth de marketplaces: `state` de uso único com expiração e checagem de plataforma (`services/platformConnectionService.js:24-33`); tokens **criptografados em repouso** (`utils/crypto.js`, AES-256-GCM) — `platformConnectionService.js:40-41`.
- Webhook Asaas com token (`src/routes/webhookRoutes.js:9-12`); webhooks de marketplace com `x-webhook-token` (`marketplaceWebhookRoutes.js`).
- Idempotência de webhook de pagamento via tabela `ProcessedWebhook` (`paymentService.js:144-152`).
- Helmet ativo com CSP, HSTS, referrerPolicy (`src/app.js:55-73`).

**EVIDÊNCIA — PONTOS DE ATENÇÃO**
- CSP com `'unsafe-inline'` em `scriptSrc` e `scriptSrcAttr` (`app.js:59,63`).
- CORS fallback `*` fora de produção (`app.js:82-92`); produção exige `CORS_ORIGIN`.
- `errorHandler.js` devolve `err.message` mesmo em HTTP 500.
- `subscriptionGuard.js` e `requireEmpresa` falham "abertos" em erro (`next()`).
- `tokenService` sem estado persistente (revogação/lockout não sobrevivem a restart/multi-instância).
- `publicRoutes` protege rotas de cliente via helper interno do `publicController` (Bearer), não via middleware global — requer matriz de teste dedicada (Fase 3).

**SUPOSIÇÃO**
- `JWT_SECRET` é estático e não rotacionado periodicamente.

**NÃO VERIFICADO**
- Existência de DAST/pentest prévio; headers efetivos na borda (Vercel/CDN).

---

## 6. Multi-tenant

**EVIDÊNCIA**
- Tenant derivado da identidade autenticada: `empresaId` do JWT + `req.ctx.empresaId` do subdomínio (`resolveEmpresa`), com bloqueio de mismatch (`auth.js:59-61`).
- Repositórios filtram por `empresaId` (ex.: `sqlRepository.js:22-26`, `pedidoRepository.js`); helpers `scopedWhere` (`utils/scopedWhere.js`) e `requireOwnership` (`middleware/ownership.js`).
- Superadmin é global por design (`empresaId: null`); rotas administrativas de empresas/clientes ficam sob `authorize('superadmin')` (`adminRoutes.js:23`).

**EVIDÊNCIA — risco**
- Cache de tenant `empresaCache.js` é in-memory por instância; `invalidateEmpresaCache(slug)` só limpa `slugCache`, **não** `idCache` → possível dado stale por até 5 min (TTL).

**NÃO VERIFICADO**
- Cobertura de testes de isolamento para **todas** as rotas sensíveis (existem `entregadorIsolation`, `scopedWhere`, `requireEmpresa`).

---

## 7. Gargalos (estáticos; sem medição de carga ainda)

**EVIDÊNCIA**
- `findMany` sem `take` em 30+ ocorrências (a maioria escopada por tenant; listas globais de superadmin são as mais críticas): `empresaRepository.js:5` (`_count` de todas as empresas), `pedidoRepository.js:20,60,76,115,122,140`, `publicController.js:320`, entre outras.
- `jobs/pixExpirationJob.js:11-25`: loop **sequencial** de todas as empresas × pedidos pendentes, com `consultarESincronizar` por pedido → N+1 e execução longa.
- `jobs/weeklySettlement.js`: processa todas as empresas sequencialmente.
- `cron/subscriptionCron.js`: itera assinaturas/configs sem paginação.
- Ausência de paginação em endpoints de listagem de pedidos/produtos/clientes.

**NÃO VERIFICADO / A MEDIR (Fase 6)**
- p50/p95/p99 reais, RPS, conexões do Postgres, event loop, queries lentas. **Nenhuma métrica de carga foi coletada nesta fase** (regra: não testar produção).

---

## 8. Banco

**EVIDÊNCIA**
- PostgreSQL (Supabase), Prisma como ORM/driver. 34 models, 9 migrations nomeadas + 3 arquivos SQL (`backend/migrations/add_empresa_hierarchy.sql`, `add_filial_billing.sql`, `add_global_username_unique.sql`).
- Índices/constraints nos models (ex.: `@@unique`, `@@index` em `PlatformConnection`, `Cliente`, etc.).
- `Counter` com PK composta `@@id([nome, empresaId])`; numeração de pedido via `upsert` + `increment` atômico (`sqlRepository.js:179-185`) — bom para concorrência.
- `prisma.js` reutiliza instância global (`globalThis.prisma ?? new PrismaClient`) — adequado a serverless.
- Transações Prisma usadas em pontos-chave (`filialBillingCron.js:100`, `empresaRepository.js:33`, `pedidoRepository.js:118`).

**SUPOSIÇÃO**
- Supabase em modo pooler (PgBouncer transaction) para o runtime e conexão direta para migrations, conforme URL com `pgbouncer=true` e `DIRECT_URL`.

**NÃO VERIFICADO**
- Plano do Supabase, limites de conexão, uso de disco, latência, EXPLAIN das queries citadas.

---

## 9. Storage

**EVIDÊNCIA**
- Supabase Storage acessado diretamente em `src/routes/uploadRoutes.js` (bucket `produtos`), criando URL pública manual (`SUPABASE_URL + '/storage/v1/object/public/produtos/'`).
- Não existe camada de abstração `storageService` com `upload/delete/getPublicUrl/getSignedUrl`; a lógica de storage está concentrada apenas em `uploadRoutes.js`, mas acoplada ao SDK do Supabase.
- Config: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` lidos em `config/env.js`.

**SUPOSIÇÃO**
- Não há exclusão de arquivos ao remover produtos (sem `delete` de storage no fluxo de produto) — a confirmar.

---

## 10. Deploy atual

**EVIDÊNCIA**
- Vercel: `vercel.json` com `framework: null`; builds `@vercel/node` para `backend/api.js`, `@vercel/static` para HTML/JS/CSS/`view`/`public`.
- Rotas: `/api/(.*)` e `/health` → `backend/api.js`; fallback estático e mapeamentos por host (`login-sicia.vercel.app` → `login.html`, `admin-sicia.vercel.app` → `superadmin.html`).
- Backend serverless **não executa** `server.js` → crons/workers/jobs inativos (ver §4).
- `backend/.vercel/` presente (artefato de deploy local).
- Sem Docker, sem CI/CD, sem Procfile.

**NÃO VERIFICADO**
- Quem/se o banco de produção é o mesmo do `.env` local; variáveis efetivamente configuradas no painel do Vercel.

---

## 11. Arquitetura desejada

```
INTERNET
   │
   ▼
Vercel (frontend estático: HTML/CSS/JS)
   │  HTTPS  →  api.<dominio>
   ▼
Railway (backend Node/Express — API + jobs em processo persistente)
   │
   ├── Supabase PostgreSQL (dados)
   └── Supabase Storage (imagens)   [via abstração storageService]
```

Evolução preparada:

```
Railway            → VPS (Docker) via Dockerfile/compose
Supabase Postgres  → PostgreSQL próprio/gerenciado (troca de DATABASE_URL)
Supabase Storage   → S3/R2 (troca do provider atrás de storageService)
```

---

## 12. Diferenças (atual × desejada)

| Tema | Atual (EVIDÊNCIA) | Desejada |
| --- | --- | --- |
| Deploy backend | Serverless no Vercel (`api.js`) | Processo persistente na Railway |
| Frontend↔API | Mesma origem `/api` | Origem separada `api.<dominio>` centralizada |
| Jobs/crons | `server.js` (não roda no Vercel) | Execução garantida no serviço persistente |
| Estado | Map/Set/EventEmitter em memória | Stateless; estado crítico persistido |
| Storage | Supabase direto em `uploadRoutes` | `storageService` abstrato |
| Pool Prisma | sem `connection_limit` | parametrizado p/ serverless/VPS |
| Config | env sem validação no boot | validação obrigatória no boot |
| Container | ausente | Dockerfile + compose + `.env.example` |
| API base frontend | relativa + dev hardcoded | centralizada por variável pública |
| SSE pagamento | EventEmitter in-memory | polling ou broker (a decidir) |

---

## 13. Plano de migração (proposto — não executar antes do gate)

**Fase 2 — Separação arquitetural**
1. Centralizar API base no frontend (um único módulo/config pública), remover `localhost:3000` hardcoded.
2. Separar config pública (frontend) de secrets (backend). Garantir que nenhum secret vaze para o bundle.
3. Preparar backend para domínio próprio (`api.<dominio>`): CORS explícito por ambiente.
4. Deploy: frontend na Vercel; backend na Railway (env vars migradas).

**Fase 3 — Segurança e isolamento multi-tenant**
5. Matriz rota × método × papel × tenant + testes de isolamento automatizados.
6. Corrigir divergências já detectadas (ex.: `?slug=` em `resolveEmpresa`, `.default` em `publicRoutes`).
7. Rate limiting defensável (considerando `trust proxy`), CORS por ambiente, CSP.

**Fase 4 — Fundação para escala (sem Redis)**
8. Eliminar estado in-memory crítico (tokens, lockout, cache de tenant, fila de auditoria).
9. Graceful shutdown (`SIGTERM`/`SIGINT`), `/health` e `/ready`.
10. Paginação em listagens ilimitadas; revisar N+1 com evidência.
11. Dockerfile/compose para portabilidade Railway→VPS.

**Fase 5 — Redis/cache/filas** — **somente com gargalo medido** (ver §14).

**Fase 6 — Teste de carga e escala horizontal** — k6 em staging; subir 2+ instâncias stateless.

> Esta fase (1) termina com **PARADA** e aguarda `PROSSIGA` antes de qualquer alteração.

---

## 14. Itens que NÃO devem ser implementados agora (sem evidência)

**EVIDÊNCIA de ausência**: não há medição de carga, EXPLAIN, métrica de p95/p99, nem contagem de conexões nesta fase. Portanto, **não** introduzir:

Redis · Redis Cluster · BullMQ · workers distribuídos · cache distribuído · Load Balancer · Kubernetes · microservices · service mesh · read replica · event bus · Kafka · RabbitMQ.

Critério de entrada (obrigatório): **gargalo identificado → medição → causa comprovada → solução proposta → ganho esperado → custo → aprovação**.

Observação: os jobs/crons **não** são "nova infraestrutura" — são código existente que precisa de um ambiente de execução persistente (Railway). Isso é correção de deploy, não overengineering.

---

## 15. Perguntas bloqueantes

1. **Onde os crons/workers rodam hoje?** No Vercel eles não executam (`api.js` não inicia jobs). Existe algum runner externo? *(impacta Fase 2 e 4)*
2. **Backend continua no Vercel durante a transição** ou migra direto para a Railway? *(impacta estratégia de corte)*
3. **SSE de pagamento** (`/api/payment/status/:pedidoId`): manter (exige serviço stateful + broker) ou migrar para polling? *(impacta Fase 4)*
4. **Domínios finais** (`api.<dominio>`, `app.<dominio>`)? *(impacta CORS e `vercel.json`)*
5. **Orçamento de infra mensal** (Railway/Supabase) para priorização? *(impacta decisões de custo)*
6. **Testes de integração** que tocam o banco (ex.: `tests/sqlRepository.test.js`): habilitar um banco de testes isolado? *(impacta Fase 4 e 6)*
7. O `POSTGRES_PRISMA_URL` do `.env` (credencial divergente de `DATABASE_URL`) ainda é usado por algo, ou é resíduo? *(impacta limpeza de config)*

---

## Anexo A — Baseline de verificação (real, não hipotético)

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Backend — subset seguro (sem DB) | `npx vitest run <19 arquivos puros>` | **17/19 arquivos PASS; 139/141 testes PASS** |
| Backend — falhas pré-existentes | (mesmo run) | `paymentSetupService.test.js`, `resolveEmpresa.test.js` → **FAIL (baseline)** |
| Backend — suíte completa | `npm test` | **NÃO executada** (inclui `sqlRepository.test.js`, integration contra DB real; respeitando "não conectar em produção") |
| Frontend — build | `npx vite build` | **PASS** (19 páginas + assets, ~1,5s) |
| Frontend — lint | `npx eslint . --ext .js` | **N/A** — sem `eslint.config.*` (ESLint 9+ exige config) |
| Typecheck | — | **N/A** — projeto sem TypeScript |
| Root vitest | `vitest` (raiz) | config inclui `tests/**/*.test.js`, mas raiz só tem `*.spec.js` (Playwright) → sem testes |

> Nenhuma falha foi atribuída às mudanças desta fase — **não houve mudanças**. As 2 falhas são pré-existentes.

---

## Anexo B — Estrutura resumida

- Backend (124 arquivos): `routes/` (33), `services/` (31), `controllers/` (21), `integrations/` (11), `middleware/` (10), `repositories/` (4), `jobs/` (3), `cron/` (2), `config/` (4), `utils/` (7).
- Frontend: 19 HTML, 25 JS, CSS modular (`css/base`, `css/components`, `css/pages`).
- Prisma: 34 models, 9 migrations + 3 SQL avulsos.
