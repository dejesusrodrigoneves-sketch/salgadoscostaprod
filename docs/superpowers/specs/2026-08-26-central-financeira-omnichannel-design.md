# Central Financeira Omnichannel Multi-Tenant — Design (Fase 1)

Data: 2026-08-26
Status: aprovado (aguardando revisão do usuário antes do plano de implementação)

## 1. Objetivo

Centralizar em um único local os valores financeiros de todas as fontes de venda de uma empresa:

- SaaS próprio (dados já existentes: `Pedido` + `Pagamento`)
- iFood
- Keeta
- 99Food
- futuros marketplaces

Cada empresa/tenant conecta suas próprias contas de marketplace. O SaaS consolida automaticamente em um balanço financeiro único. A funcionalidade é uma camada financeira independente do catálogo.

Fora de escopo: sincronização de produtos, catálogo, cardápio, estoque, preços, imagens, mapeamento de produtos entre marketplaces.

## 2. Decisões registradas

| # | Decisão |
|---|---------|
| 1 | Sem dados mock/aleatórios. Providers dormentes até credenciais no `.env` |
| 2 | `DailyClosing` é o fechamento oficial consolidado; `CaixaDiario` permanece operacional (abertura/sangria) |
| 3 | UI: abas novas no `dashboard.html` + seção "Integrações" no `superadmin.html` |
| 4 | Fonte SaaS: pedidos finalizados e pagos viram `FinancialEntry`; PIX alimenta "recebido" |
| 5 | Fuso fixo `America/Sao_Paulo` (config, sem campo por empresa) |
| 6 | Admin: status das integrações env-driven (somente leitura) |
| 7 | Sync + fechamento manuais (botões) |
| 8 | Fechamento re-gerável (upsert auditado) |
| 9 | OAuth por empresa, fluxo real completo, todas as plataformas |
| 10 | Credenciais só no backend (`.env`), nunca no frontend |

## 3. Arquitetura

```
backend/src/integrations/
├── core/
│   ├── types.js            (Platform, FinancialEntryType, NormalizedEntry/Settlement)
│   ├── interfaces.js       (FinancialMarketplaceProvider)
│   ├── normalizers/
│   └── registry.js         (FinancialProviderRegistry)
├── saas/
│   └── SaasFinancialProvider.js        ← ativo (Pedido+Pagamento)
├── ifood/  keeta/  ninefood/           ← isConfigured = env creds
│   ├── client.js  auth.js  normalizer.js  provider.js
│   └── oauth.js  (authorizeUrl, exchangeCode, refreshToken, revoke)
└── future/
```

Regras de arquitetura:

- O core financeiro NUNCA contém `if (platform === 'IFOOD') ...`. Lógica específica fica dentro do provider.
- Providers transformam dados externos em um padrão interno normalizado; o core consome apenas dados normalizados.
- Registry: `providerRegistry.get('IFOOD' | 'KEETA' | 'NINEFOOD' | 'SAAS')`.
- Novo marketplace futuro = novo provider + auth + normalizer + registro. Nenhuma reescrita do core/dashboard/conciliação/fechamento.

## 4. Interface do Provider

```js
// FinancialMarketplaceProvider (adaptado ao projeto, não obrigatoriamente TS)
{
  platform: 'IFOOD' | 'KEETA' | 'NINEFOOD' | 'SAAS',
  isConfigured(): boolean,
  buildAuthorizeUrl(state): string | null,   // null se não configurado
  exchangeCode(code): Promise<{ accessToken, refreshToken, expiresIn, externalAccountId }>,
  refreshToken(refreshToken): Promise<{ accessToken, refreshToken, expiresIn }>,
  revoke(accessToken): Promise<void>,
  syncFinancialData(connection, from, to): Promise<NormalizedEntry[]>,
  syncSettlements(connection, from, to): Promise<NormalizedSettlement[]>,
  handleWebhook(payload): Promise<void>,
}
```

Provider dormente: `isConfigured()` retorna `false` quando a credencial correspondente não está no `.env`; `sync*` retorna `[]`; `buildAuthorizeUrl` retorna `null`; rotas respondem 503 "não configurado".

## 5. Modelo de dados (7 tabelas novas, 1 migration incremental)

| Tabela | Campos-chave | Unique |
|--------|-------------|--------|
| `PlatformConnection` | empresaId, platform, status, externalAccountId, accessTokenEnc, refreshTokenEnc, tokenExpiresAt, lastSyncAt, lastError, createdAt, updatedAt | `(empresaId, platform)` |
| `FinancialEntry` | empresaId, source, externalId, type, grossAmount, discountAmount, platformFee, paymentFee, deliveryAmount, otherFees, netAmount, expectedAmount, receivedAmount, transactionDate, settlementDate, status, createdAt, updatedAt | `(empresaId, source, externalId)` |
| `Settlement` | empresaId, source, externalSettlementId, expectedAmount, actualAmount, settlementDate, status, createdAt | `(empresaId, source, externalSettlementId)` |
| `Reconciliation` | empresaId, source, settlementId?, expectedAmount, receivedAmount, difference, status, resolvedAt, resolvedBy, reason, createdAt | — |
| `DailyClosing` | empresaId, date (Date), grossAmount, discountAmount, feesAmount, netAmount, receivedAmount, receivableAmount, divergenceAmount, status, generatedBy, generatedAt, updatedAt | `(empresaId, date)` |
| `WebhookEvent` | empresaId, platform, externalEventId, eventType, receivedAt, processedAt, status, error, createdAt | (futuro) |
| `OAuthState` | nonce (id), empresaId, usuarioId, platform, expiresAt, usedAt, createdAt | `(nonce)` |

- Valores monetários: `Decimal @db.Decimal(10,2)`. Nunca floating point.
- `OAuthState` expira em 10 min, single-use (marca `usedAt` no callback), tenant-bound, guarda `usuarioId` para auditoria.
- Índices: `FinancialEntry(empresaId, source, transactionDate)`, `(empresaId, settlementDate)`, `(empresaId, status)`, `Settlement(empresaId, settlementDate)`, `DailyClosing(empresaId, date)`.
- Migrations incrementais. Nunca `DROP TABLE` / `migrate reset` em produção.

### Enums/status
- `Platform`: `SAAS`, `IFOOD`, `KEETA`, `NINEFOOD`
- `FinancialEntryType`: `SALE`, `REFUND`, `CANCELLATION`, `FEE`, `ADJUSTMENT`
- `FinancialStatus`: `PENDING`, `PAID`, `RECONCILED`, `DIVERGENT`
- `ConnectionStatus`: `NOT_CONNECTED`, `CONNECTING`, `CONNECTED`, `SYNCING`, `TOKEN_EXPIRED`, `ERROR`, `DISCONNECTED`

## 6. Segurança anti-IDOR (central)

Regra: nenhuma rota de financeiro/integração aceita `slug` ou `empresaId` vindo de link/body. Tenant sempre vem do token JWT ou do `state` nonce (DB).

### Fluxo OAuth (sem slug em NENHUMA URL)

```
dashboard.html → aba Integrações → [Conectar iFood]
        ↓
POST /api/financeiro/integrations/IFOOD/connect     ← AUTH obrigatório (Bearer)
        ↓
backend: empresaId = req.ctx.empresaId (do TOKEN, cross-check auth.js)
         provider.isConfigured()? → 503 se não
         nonce = randomBytes(32) → OAuthState(nonce, empresaId, usuarioId, IFOOD, 10min)
         redirect_uri = env OAUTH_REDIRECT_BASE + /callback  (NUNCA req.headers.host)
         → { url: ifood.com/oauth?...&state=nonce }
        ↓
frontend window.location = url (browser vai ao marketplace oficial)
        ↓
lojista autoriza → marketplace → GET /callback?code&state     ← SÓ code+state, SEM slug/empresaId
        ↓
backend: state → lookup OAuthState (nonce) → empresaId+usuarioId VEM DO DB
         valida: existe, não usado (single-use), não expirado, platform match
         marca usedAt → code→tokens → criptografa → upsert PlatformConnection
         audit (actor=usuarioId do state) → redirect dashboard.html?integracao=ifood&ok=1
```

Garantias:

- URL do callback contém apenas `code` + `state` (parâmetros OAuth padrão).
- `empresaId` resolvido do `OAuthState` no DB — link não carrega identidade de empresa.
- `state` não forjável (32 bytes aleatórios, server-side, single-use, expira 10min).
- Replay bloqueado (`usedAt`).
- `redirect_uri` fixo via env — Host header poisoning impossível.
- Iniciação exige JWT autenticado — só a própria empresa inicia o próprio fluxo.

### Rotas financeiras
- `empresaId` SEMPRE de `req.ctx`/`req.user.empresaId` (middleware `authenticate` + `resolveEmpresa` cross-check).
- Body/query/params nunca aceitam `empresaId`/`slug` — ignorados ou 400.

## 7. Fluxo financeiro (SaaS ativo)

```
Pedido+Pagamento pagos → SaasProvider.normalize → FinancialEntry (idempotente)
                                                      ↓
[Gerar fechamento] → consolida entries do dia → DailyClosing (upsert+audit)
                                                      ↓
Reconciliation: expected (net) vs received (PIX paid / Settlement)
                                                      ↓
Dashboard Financeiro (hoje/7d/30d/mês/período, por plataforma)
```

Regras de normalização SaaS (fonte real):

- Entrada: todo `Pedido` finalizado e pago (`paymentStatus` pago/confirmado, ou pagamento em dinheiro/cartão na loja).
- `grossAmount` = `total`; `discountAmount` = `desconto`; `fees` = `taxasEntrega` + `taxasCartao`; `netAmount` = bruto − desconto − taxas.
- `receivedAmount` alimentado pelo `Pagamento` Asaas PIX pago.
- `externalId` = `pedidoId`; idempotência via unique `(empresaId, SAAS, pedidoId)`.
- Fonte da verdade: dados do marketplace não são recalculados arbitrariamente; divergência é exibida, não corrigida.

## 8. Endpoints

### Lojista (`/api/financeiro/*` — `authenticate` + `requireEmpresa`, tenant do token)

- `GET /balance` — balanço consolidado com filtros (`periodo`: hoje/ontem/7d/30d/mes/mes_anterior/personalizado; `plataforma`: todas/saas/ifood/keeta/ninefood).
- `GET /entries` — lançamentos paginados + filtros.
- `GET /closings` — fechamentos diários.
- `GET /reconciliations` — conciliações.
- `GET /integrations` — status das conexões da empresa.
- `POST /sync` — sincroniza fontes (SaaS ativo; marketplaces apenas se configurados).
- `POST /closing` — gera/regenera `DailyClosing` da data (upsert auditado).
- `POST /integrations/:platform/connect` — inicia OAuth (503 se dormente; cria `OAuthState`).
- `GET /integrations/:platform/callback` — público (marketplace); resolve tenant via `state`.
- `POST /integrations/:platform/disconnect` — revoga + limpa tokens + preserva histórico + audit.

### Admin (`/api/admin/integracoes/*` — superadmin)

- `GET /` — status providers (env-driven) + conexões/erros/últimas syncs por plataforma.
- `GET /:platform` — saúde detalhada (status, última sync, último webhook, erros, empresas conectadas).

### Webhooks (dormentes)

- `POST /api/webhooks/ifood|keeta|99food` → 503 até creds configuradas.

## 9. Frontend

### `dashboard.html` — aba Integrações (por empresa)
- Cards iFood/Keeta/99Food.
- Sem creds: "Indisponível — aguardando liberação" (desabilitado, UI pronta).
- Com creds: `[Conectar iFood]` → POST connect → redirect → volta `?integracao=ifood&ok=1`.
- Conectado: status, última sync, `[Sincronizar agora] [Desconectar]`; expirado: `[Reconectar]`.
- Nenhum slug/empresaId em URLs — identidade via token da sessão.

### `dashboard.html` — aba Financeiro
- Balanço consolidado (vendas brutas, descontos, taxas, líquido, recebido, a receber, divergência).
- Visão por canal (SaaS/iFood/Keeta/99Food + TOTAL).
- Filtros (hoje/ontem/7d/30d/mês/período; plataforma).
- Fechamento diário + botões `[Sincronizar agora]` e `[Gerar fechamento]`.
- Conciliação (esperado/recebido/diferença/status).

### `superadmin.html` — seção Integrações
- Cards por marketplace: configurado/não (via env), conexões por plataforma, última sync, erros.

## 10. Env novas (opcionais)

```
IFOOD_CLIENT_ID / IFOOD_CLIENT_SECRET
KEETA_CLIENT_ID / KEETA_CLIENT_SECRET
NINEFOOD_CLIENT_ID / NINEFOOD_CLIENT_SECRET
MARKETPLACE_ENV=sandbox
OAUTH_REDIRECT_BASE=https://salgadoscosta.vercel.app
```

Ausentes → providers dormentes, rotas 503, sistema atual intacto.

## 11. Segurança

- Tokens marketplace: AES-256-GCM (`utils/crypto.js` reutilizado).
- Secrets nunca no frontend, nunca em logs (proibido `VITE_CLIENT_SECRET`, `VITE_ACCESS_TOKEN`, etc.).
- State OAuth: nonce + expiração + single-use (DB) + tenant-bound.
- Tenant isolation: `empresaId` sempre do token/ctx, nunca do body/query.
- Auditoria: quem conectou/desconectou/sincronizou/reprocessou/fechou. Logs registram eventos (INTEGRATION_CONNECTED, SYNC_STARTED, etc.) nunca secrets.
- LGPD: mínimo necessário; sem PII em logs.

## 12. Testes

- IDOR/segurança: callback com state de empresa B → negado; connect sem token → 401; body com `empresaId` alheio → ignorado; state reutilizado → 400; state expirado → 400.
- OAuth: state válido/inválido/single-use.
- Idempotência: sync 2× → 1 entry.
- Multi-tenant: empresa A não lê B.
- Dormentes: sem creds → 503/`[]`, sem erro.
- DailyClosing upsert + auditoria.
- Reconciliation matched/divergent.
- Registry + normalizers (unit).

## 13. Arquivos

Criar (~35):

- `integrations/core/*` (types, interfaces, registry, normalizers)
- `integrations/saas/*`, `integrations/ifood/*`, `integrations/keeta/*`, `integrations/ninefood/*` (provider + oauth + client + normalizer)
- Services: `financialSyncService`, `financialDashboardService`, `dailyClosingService`, `reconciliationService`, `platformConnectionService`
- Routes/controllers: `financeiroRoutes`, `adminIntegracoesRoutes`
- Testes (~10)

Alterar (7):

- `schema.prisma` (7 tabelas + enums)
- `app.js` (mount rotas)
- `dashboard.html` (abas Financeiro + Integrações)
- `superadmin.html` (seção Integrações)
- `js/` (helper financeiro)
- `.env.example` (novas vars)
- `migrations/` (nova migration)

## 14. Pendências externas (Fase 2-4)

- Credenciais iFood/Keeta/99Food (usuário coleta → `.env`).
- Homologação oficial por marketplace.
- Ajuste de `client.js`/`normalizer.js` conforme documentação real de cada API.
