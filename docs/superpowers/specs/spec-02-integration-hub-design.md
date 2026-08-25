# Design — Spec 02: Integration Hub

Data: 2026-08-23
Projeto: sic-ia (SaaS ERP multi-tenant, Vercel serverless, backend JS/Express/Prisma)
Status: aprovado pelo usuário (não commitado — ordem do usuário)
Depende de: spec-01 (modelos Integration*/UnifiedOrder/DailyClosing)

## Objetivo

Camada "Integration Hub" que isola regras de marketplaces do restante do ERP:
centraliza recepção de eventos, sincronização, idempotência, retry, espelhamento
de pedidos no ERP e normalização para UnifiedOrder — sem fila/Redis (Vercel
serverless), com isolamento de falha por plataforma.

## Decisão aprovada

- **Processamento híbrido (A):** webhook valida e enfileira rápido
  (`IntegrationEvent` status=received); caminho rápido inline quando leve;
  Vercel Cron drena pendentes + syncs vencidos; botão "Sincronizar agora" para
  sincronização manual. Falha de uma plataforma nunca derruba o ERP.

## Estrutura

Nova pasta `backend/src/hub/` (arquivos novos; nenhum arquivo existente alterado):

| Arquivo | Responsabilidade |
|---|---|
| `adapter.js` | Contrato/interface (JSDoc): `connect, disconnect, refreshToken, syncOrders, getOrder, healthCheck, capabilities` |
| `registry.js` | Factory `getAdapter(platform, ctx)` → adapter; `own` sempre disponível |
| `normalize.js` | Payload do adapter → UnifiedOrder (somente valores informados/estimados) |
| `mirrorPedido.js` | Cria registro em `pedidos` via `sql.nextPedidoId()` + link `pedidoId` |
| `eventBus.js` | IntegrationEvent: idempotência, retry/backoff, correlação |
| `syncScheduler.js` | Seleciona integrações com `nextSync <= now` |
| `webhookHandler.js` | Recepção genérica: assinatura (hook por plataforma — validate), idempotência, enqueue, 200 rápido |
| `errors.js` | HubError; tratamento central de falha de adapter com log estruturado |

## Regras

### Eventos e idempotência
- `platform + externalOrderId` → `UNIQUE(empresaId, platform, externalOrderId)`.
- Duplicata (P2002): skip, `IntegrationEvent(status=skipped)`, log.
- `idempotencyKey` único em IntegrationEvent para webhooks re-enviados.

### Espelho de pedido no ERP (opção A da spec-01)
- Adapter normalizado → `ensureUnifiedOrder()` → se `pedidoId == null`:
  `orderService.criar(...)` como consumidor (arquivo orderService NÃO é alterado),
  com audit `module='integrations'`; após criação, gravar `pedidoId` no UnifiedOrder.
- Capazidades do pedido espelho: cliente, itens, valores, forma de pagamento,
  status inicial `pendente`.

### Vendas próprias
- `ownAdapter.syncOrders()` projeta `pedidos` (janela de datas) → UnifiedOrder
  com `platform='own'` + `pedidoId`. Executado na corrida do cron/sync manual.
- Nenhum hook interno no fluxo atual de pedidos.

### Sync
- `syncOrders(fromDate, toDate)` — limites: padrão últimas 24h; máximo 7 dias por chamada.
- Campos de controle: `lastSuccessfulSync`, `lastAttempt`, `nextSync`,
  `syncStatus`, `errorCount` (modelo da spec-01).
- Backoff: 30s → 2m → 10m → 30m; após 5 falhas → `syncStatus='error'` + alerta.

### Cron / processamento agendado
- Vercel Cron batendo em `POST /api/integrations/cron` com header secreto
  (env `INTEGRATION_CRON_SECRET`).
- Cada execução: drena `IntegrationEvent(status=received)` (máx N=25) e
  integrações com `nextSync <= now` (máx N=10). Nunca loops infinitos.
- Em dev o cron fica desabilitado (rota devolve 204 sem ação); sync manual cobre.

### Webhooks
- `POST /webhooks/:platform` (ifood|food99|keeta) — generic handler:
  1. valida assinatura via hook do adapter (specs 05-07 preenchem validações reais);
  2. identifica empresa (via adapter: externalStoreId → empresaId);
  3. idempotência; 4. enqueue; 5. responde 200 rápido.
- Webhook inválido → 4xx + `IntegrationEvent(status=failed)` sem crash.

### API interna (novas rotas em `backend/src/routes/integrationRoutes.js`)
```
POST   /api/integrations/:platform/connect
POST   /api/integrations/:platform/disconnect
POST   /api/integrations/:platform/sync     { sinceDays? }
GET    /api/integrations/:platform/status
GET    /api/integrations                    (lista do tenant)
POST   /api/integrations/cron               (header secret ó)
POST   /webhooks/ifood|99food|keeta         (público, assinaturas por adapter)
```
- Todas as rotas `/api/integrations*` protegidas por `authenticate` +
  `authorize('superadmin')` (exceto cron). Rota de webhook pública com assinatura.

### Tenancy
- Toda função do hub recebe e filtra por `empresaId`; credenciais por
  `(empresaId, platform)`; erro de tenant inexistente → 404/HubError, sem vazamento.

### Credenciais
- Encapsuladas: hub lê/grava via `integrationCredentialRepository`
  (criptografia AES-256-GCM, chave `INTEGRATION_SECRET_KEY`).
- Nenhum campo `*Encrypted` retornado por API; logs jamais registram tokens.

### Observabilidade
- Log estruturado por operação: `correlationId, tenantId, platform,
  externalOrderId, operation, status, durationMs, error`.
- Erros → `AppLog` (module `integrations`) + `IntegrationEvent.lastError`.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| Timeout Vercel em webhook | Enqueue rápido; processamento no cron |
| Duplicação de pedidos | UNIQUE + idempotência + skip de P2002 |
| Quebra do fluxo atual | Nenhum arquivo existente alterado; hub consome `orderService` sem modificá-lo |
| Uma plataforma fora | try/catch por adapter; estado `error` + retry com backoff; ERP segue |
| Secrets expostas | Criptografia em repouso; API nunca expõe; logs sanitizados |

## Verificação

1. Tests existentes 23/23 continuam passando (nada existente alterado).
2. Rota `POST /api/integrations/own/sync` cria UnifiedOrder a partir de pedidos
   existentes (janela 24h) — smoke test local.
3. Rota de webhook responde 200 e registra evento idempotente (duplicado → skipped).
4. Up de CRON local: env `INTEGRATION_CRON_SECRET`; dev sem ação.

## Fora de escopo

- Validações de assinatura específicas de iFood/99Food/Keeta (specs 05-07).
- Cálculo financeiro/custos/lucro (spec-03).
- Fechamento diário, reconciliação, histórico (spec-04).
- UI das integrações (spec-08).
