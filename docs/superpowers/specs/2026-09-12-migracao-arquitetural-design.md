# Design — Migração Arquitetural + Preparação para Escala Horizontal (SIC-IA)

- **Data:** 2026-09-12
- **Projeto:** SIC-IA / salgadoscosta (monorepo: frontend estático + backend Node/Express)
- **Status:** design aprovado — nenhuma alteração de código executada ainda
- **Anexo de evidências:** `docs/AUDIT.md` (Fase 1)
- **Spec relacionada:** `docs/superpowers/specs/2026-09-12-correcoes-seguranca-design.md` (achados F1–F9)

---

## 1. Contexto

O sistema roda hoje com frontend e backend **no mesmo deploy Vercel** (`vercel.json` roteia `/api/(.*)` para `backend/api.js`). O backend serverless **não executa** `server.js`, portanto crons/workers/jobs estão inativos. Há estado crítico em memória (tokens, lockout, cache de tenant, SSE) que impede escala horizontal.

O objetivo é separar frontend (Vercel) e backend (Railway, processo persistente), tratando PostgreSQL e Storage como componentes desacopláveis, e deixando o caminho para VPS/PostgreSQL próprio sem reescrita.

**Regra central:** não otimizar por opinião. Medir, provar e só então alterar. Não introduzir Redis/cache/fila/worker sem gargalo comprovado.

---

## 2. Arquitetura alvo (agora)

```
INTERNET
   │
   ▼
Vercel  ── frontend estático (HTML/CSS/JS) em https://<loja>.vercel.app
   │  HTTPS  →  https://<servico>.up.railway.app
   ▼
Railway ── backend Node/Express (1 réplica) — API + jobs no processo persistente
   │
   ├── Supabase PostgreSQL (fonte de verdade)
   └── Supabase Storage (imagens), atrás de uma abstração
```

Evolução preparada (sem reescrever a aplicação):
- `Railway → VPS` via Docker/migrations.
- `Supabase PostgreSQL → PostgreSQL próprio` (troca de `DATABASE_URL` + `DIRECT_URL`).
- `Supabase Storage → S3/R2` (troca de provider atrás de `storageService`).

---

## 3. Decisões travadas

| # | Tema | Decisão |
| --- | --- | --- |
| D1 | Frontend | Vercel, domínio por loja `https://<loja>.vercel.app` (Opção B) |
| D2 | Backend | Railway, **1 réplica** agora, domínio `<servico>.up.railway.app` |
| D3 | LB / multi-réplica | **Não** agora; habilitar na Fase 4 após 4.1–4.4 |
| D4 | Redis/cache/filas | **Não** agora; condicional a evidência (Fase 5/6) |
| D5 | Worker dedicado | Não agora (jobs na réplica única); separar na Fase 4 |
| D6 | Fonte de verdade | PostgreSQL |
| D7 | SSE de pagamento | Mantido na Railway; webhook = fonte oficial → DB → SSE; polling como fallback do frontend |
| D8 | CORS | Allowlist dinâmica por tenant (valida `<loja>` contra `empresa.slug`); sem `*` em produção |
| D9 | Dockerfile | Fase 4 (preparo VPS), não no cutover |
| D10 | `vercel.json` | Frontend-only: remover rota `/api` e `vercel-build`/`db push` do backend |
| D11 | Testes de integração (Fase 3) | **PostgreSQL local via Docker** |
| D12 | Correções Fase 3 | Aplicar **imediatamente** (as 6) |
| D13 | Worker (Fase 4) | Mesmo repo + `worker.js` separado |
| D14 | Migrations (Fase 4) | Prisma migrations versionadas **antes** do VPS (substituir `ensureColumns`) |
| D15 | Multi-réplica (Fase 4) | Somente após 4.1–4.4 validados |
| D16 | Staging (Fase 6) | Criar ambiente isolado |
| D17 | k6 | Local + CI; VPS para testes maiores |
| D18 | SLO de aceite | p95 ≤ 300 ms · p99 ≤ 800 ms · 5xx < 1% · zero falha de isolamento/integridade |

---

## 4. Estado atual e achados (resumo)

Detalhe completo em `docs/AUDIT.md`. Destaques:

**Arquitetura/operação**
- Crons/workers só iniciam em `backend/server.js:17-70`; `backend/api.js` (Vercel) não os executa.
- `src/cron/subscriptionCron.js:27` — função sem caller (código morto).
- Estado em memória: `tokenService.js:9,12`, `authService.js:11`, `publicController.js:15`, `empresaCache.js:3,4`, `auth.js:16`, `paymentService.js:10` (EventEmitter do SSE), `auditQueue.js`.
- Sem graceful shutdown; sem Docker/CI.

**Segurança (confirmado)**
- 12 vulnerabilidades de deps (`npm audit --omit=dev`).
- `trust proxy` ausente; CORS fallback `*` em dev; CSP com `unsafe-inline`.
- Sem persistência de revogação/refresh/lockout.

**Integridade (Fase 3 — confirmado com arquivo:linha)**
1. Manipulação de preço (2 vetores):
   - **Público:** `publicController.criarPedido` recalcula `valoresItens` (bom), porém aceita `desconto`/`taxasEntrega`/`taxasCartao` do cliente e subtrai de `total` (`publicController.js:380-383`) → total pode ser zerado; `desconto` de cupom não é validado no servidor.
   - **Autenticado:** `orderController.criar` (`:43`) → `orderService.criar` (`:16-18`) → `pedidoRepository.criarPedido` (`:82-106`), que faz `payload = {...data}` e só recalcula `valoresItens` se ausente → mass assignment de campos do pedido.
2. Cross-tenant: `pedidoRepository.criarPedido` busca produtos por `id` **sem `empresaId`** (`:85`) — afeta o path autenticado.
3. Mass assignment: `driverController.js:114` → `sqlRepository.atualizarEntregador` (`:109-110`) grava `req.body` cru.
4. Cupom nunca marcado como usado (sem caller de `usado:true`); reuso e corrida.
5. Estoque read-modify-write (`orderService.js:39-40`) e `darBaixaEstoque` sem `await` (`:128`).
6. `publicRoutes.js:4` `.default` em módulo CJS; `resolveEmpresa.js:9-18` honra `?slug=` (teste `resolveEmpresa.test.js:100` espera ignorar).

---

## 5. Fase 1 — Auditoria e Baseline (concluída)

Entregue `docs/AUDIT.md` (15 seções). Baseline real:
- Backend subset puro: 139/141 testes PASS; 2 falhas pré-existentes (`paymentSetupService`, `resolveEmpresa`).
- `sqlRepository.test.js` é integration contra DB real → não executado.
- `vite build` PASS; lint N/A (sem config); typecheck N/A (sem TS).

---

## 6. Fase 2 — Migração arquitetural

### PR 2.1 — Frontend: API base centralizada
- **Novo** `js/config.js`: `window.SIC_API_BASE = '<railway-url>'` (dev: `''` para proxy).
- **Novo** `apiUrl(path)` em `js/utils.js`.
- Refatorar para `apiUrl()`: `js/admin.js:6,516,1684,1691` · `js/apiHelper.js:5,50` · `js/painel.js:10` · `js/financeiro.js:15` · `js/integracoes.js:10` · `js/filialPricingOverlay.js:31,199,219` · `js/subscriptionOverlay.js:33,144` · `js/superadmin-audit.js:157,211` · `js/superadmin-integracoes.js:10` · `js/cart.js:974` (EventSource) · `js/filiais.js:2` · `js/superadminBilling.js:3` · `js/superadminDashboard.js:3` (remover `localhost:3000`).
- Incluir `js/config.js` nas 19 páginas HTML.
- `vite.config.js`: manter proxy dev `/api`,`/img`.

### PR 2.2 — Backend: tenant resolution no host da API
- `resolveEmpresa.js`: não tratar o host da API (`API_HOST`/`.up.railway.app`) como tenant; skip quando `req.ctx.empresaId` já resolvido; tenant via `?slug=` ou JWT.

### PR 2.3 — Backend: prep Railway
- `package.json`: `build: prisma generate` (Railway); manter `start: node server.js`.
- `app.set('trust proxy', 1)`; adicionar `/ready` (além de `/health`).
- Validação de env no boot (`config/env.js`): falhar rápido se faltar `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, `API_HOST`.
- Migrations: `prisma migrate deploy` (gate manual na 1ª execução).

### PR 2.4 — CORS allowlist por tenant (Opção B)
- Middleware CORS dinâmico antes de `resolveEmpresa`:
  1. Lê `Origin` (`https://<loja>.vercel.app`).
  2. Valida `<loja>` contra empresa cadastrada (cache).
  3. Válido → seta `req.ctx.empresaId` e responde `Access-Control-Allow-Origin` = Origin exato.
  4. Dev: `http://localhost:5173|5174`. Webhooks/server-to-server: sem Origin.
  5. Sem `*` em produção; `*.vercel.app` não é aceito cegamente — só slug cadastrado.
- Env: `API_HOST`, `FRONTEND_DOMAIN_SUFFIX=vercel.app` (ou allowlist explícita por empresa).

### PR 2.5 — Vercel frontend-only
- `vercel.json`: remover rota `/api` e build `backend/api.js`.
- Remover `vercel-build`/`db push` do fluxo.

### PR 2.6 — Deploy + cutover
- Railway: env vars, build `prisma generate`, `migrate deploy`, start.
- Smoke: `/health`, `/ready`, login admin, login cliente, 1 pedido, 1 upload, SSE + fallback polling.
- Rollback: `SIC_API_BASE=''` + restaurar rota `/api` no Vercel (janela curta).

---

## 7. Fase 3 — Segurança e Integridade Multi-Tenant

### 3.1 Correções imediatas
1. **Pedido (público):** validar `desconto` no servidor (só via cupom válido e consumido) e derivar `taxasEntrega`/`taxasCartao`/`total` de forma controlada; ignorar valores arbitrários do cliente.
   **Pedido (autenticado):** whitelist de campos em `criarPedido`; recalcular `valoresItens`/`total`/`taxas`; ignorar `paymentStatus`/`status` do cliente.
2. **Cross-tenant:** `criarPedido` busca produtos com `where: { id: { in }, empresaId }`.
3. **Entregador:** whitelist no `atualizarEntregador`/controller (bloquear `empresaId`, `id`, `passwordHash`, `usuarioId`).
4. **Cupom:** consumir atomicamente (`updateMany({ where: { codigo, empresaId, usado: false }, data: { usado: true } })`) e falhar se `count === 0`.
5. **Estoque:** mutação atômica (decremento condicional / transação) e `await` da baixa (sem fire-and-forget).
6. **Config:** corrigir `.default` em `publicRoutes.js:4`; alinhar `resolveEmpresa`/teste sobre `?slug=`.

### 3.2 Matriz de segurança
- Documentar `rota × método × auth × papel × tenant × acesso-por-ID × isolamento` (33 rotas) em `docs/SECURITY.md`.

### 3.3 Testes
- **PostgreSQL local via Docker** para integração (D11).
- Isolamento A/B automatizado: A→A ✅ · A→B ❌ · B→B ✅ · B→A ❌ (pedidos, produtos, clientes, entregadores, cupons, financeiro).
- Revisão de XSS (innerHTML), SSRF (`proxyRoutes` allowlist), upload, webhooks, logs com PII, rate limit por rota.

---

## 8. Fase 4 — Fundação para Escala (sem Redis)

- **4.1 Stateless:** persistir tokens/refresh/revogação e lockout no Postgres; corrigir `empresaCache` (invalidar `idCache` também / consistência).
- **4.2 Concorrência:** estoque/cupom atômicos; idempotência de webhook (manter `ProcessedWebhook`); revisar pedido/counter/pagamento/assinatura.
- **4.3 Jobs:** `worker.js` dedicado (mesmo repo) para crons/`server.js`; garantir execução única ao escalar.
- **4.4 Operação:** graceful shutdown (`SIGTERM`/`SIGINT`), `/ready`, logs estruturados sem segredo, request-id (já existe), métricas úteis.
- **4.5 Banco:** paginação nas listas ilimitadas; índices só com `EXPLAIN ANALYZE`; **migrations Prisma versionadas** substituindo `ensureColumns` (DDL no boot).
- **4.6 Estado compartilhado:** decidir Postgres vs Redis **por medição**.
- **4.7 Dockerfile/compose** + `.env.example` (preparo VPS).
- **Gate D15:** multi-réplica/LB somente após 4.1–4.4 validados.

---

## 9. Fase 5 — Redis / Cache / Filas (condicional)

- **Gatilhos mensuráveis** (definir antes de qualquer infra): p95 de endpoint > limite do SLO, conexões PG próximas do teto, saturação de DB, necessidade de lock/idempotência distribuída, pub/sub para SSE multi-réplica.
- **Sem implementação** sem evidência da Fase 6.
- Se aplicável: Ports & Adapters (`CachePort` → `MemoryCache`/`RedisCache`), chaves tenant-aware `env:empresa:{tenantId}:...`, TTL + invalidação; Postgres segue como fonte de verdade.

---

## 10. Fase 6 — Teste de Carga e Escala Horizontal

- **Staging isolado** (DB + API Railway staging + frontend preview) — criar.
- k6: smoke/load/stress/spike/soak; local + CI; VPS para testes maiores.
- Medir: RPS, VUs, p50/p95/p99, 5xx/429, CPU/RAM, event loop, conexões PG, queries lentas, locks.
- Teste multi-réplica (após 4.x): sessão, pedidos, contador, webhook, jobs, cache.
- **SLO de aceite (D18):** p95 ≤ 300 ms · p99 ≤ 800 ms · 5xx < 1% · zero falha de isolamento/integridade.
- `docs/SCALING_REPORT.md` com números reais (sem afirmações sem teste).

---

## 11. Documentação

`docs/` → `AUDIT.md` (feito) · `ARCHITECTURE.md` · `DECISIONS.md` · `SECURITY.md` · `SCALING.md` · `LOAD_TESTING.md` · `SCALING_REPORT.md`.

---

## 12. Variáveis de ambiente

**Frontend (Vercel, público):** `SIC_API_BASE`.

**Backend (Railway, secreto):** `DATABASE_URL` · `DIRECT_URL` · `JWT_SECRET` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `ASAAS_*` · `IFOOD_*`/`KEETA_*`/`FOOD99_*` · `EVOLUTION_*` · `FIREBASE_*`/`FCM_*` · `FRONTEND_URL` · `API_HOST` · `FRONTEND_DOMAIN_SUFFIX` · `CORS_BASE_ORIGINS` (origens fixas não-tenant; o tenant é validado por allowlist dinâmica) · `ASAAS_SUBCONTA_KEY` · `MAPBOX_TOKEN`/`GRAPHHOPPER_KEY`/`GEOAPIFY_KEY`.

> Nenhum segredo no frontend. Nenhum valor de segredo é registrado nesta spec.

---

## 13. Verificação

- `vite build` (PASS hoje) após refactor; criar `eslint.config` (hoje N/A); suíte pura backend; Playwright smoke.
- `curl` Railway `/health` + `/ready`.
- Teste CORS cross-tenant (A→B negado).
- Testes de isolamento (Fase 3) e de concorrência (Fase 4) verdes.

---

## 14. Rollback

- Cada fase = PR isolado, revertível.
- Cutover Fase 2: reverter `SIC_API_BASE` para `''` + restaurar rota `/api` no Vercel.
- Fase 4: rollback de migrations (planejado antes de aplicar); worker pode voltar a rodar no processo web.
- Fase 6: staging isolado, nunca produção.

---

## 15. Riscos residuais / aceitos

- SSE com polling fallback (janela de reconexão).
- Revogação de token com atraso enquanto Fase 4 não concluída.
- 2 falhas de teste pré-existentes (baseline); `uuid` transitivo sem fix.
- CSP com `unsafe-inline` mantido até refactor de handlers inline.
- Rotação de `JWT_SECRET` causa re-login geral (executar em janela).

---

## 16. Fora de escopo

- Redis/worker distribuído/LB/k8s/read replica **sem** evidência medida.
- Refactor completo de CSP para nonces.
- Troca de framework/ORM/banco.
- Mudanças de regra de negócio além das correções da Fase 3.

---

## 17. Reconciliação com a spec anterior

A spec `2026-09-12-correcoes-seguranca-design.md` (F1–F9) permanece válida e mapeia assim:
- F1 (deps) → Fase 2/3 (pré-requisito de segurança).
- F2 (`trust proxy`), F4 (CORS) → Fase 2.
- F3 (token store persistente) → Fase 4.1.
- F5 (CSP), F6 (rotação JWT) → Fase 2/4.
- F7 (URL Asaas), F8 (WhatsApp senha), F9 (cache LRU) → Fase 3/4.

Esta spec **absorve** os itens acima nos respectivos itens de fase; onde houver conflito de prioridade, prevalece esta.

---

## 18. Perguntas em aberto

Nenhuma. Todas as decisões D1–D18 foram travadas com o responsável.
