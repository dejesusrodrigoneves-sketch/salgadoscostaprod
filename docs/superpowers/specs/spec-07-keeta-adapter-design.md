# Design — Spec 07: Adapter Keeta

Data: 2026-08-23
Projeto: sic-ia (SaaS ERP multi-tenant, backend JS/Express/Prisma)
Status: aprovado pelo usuário (não commitado — ordem do usuário)
Depende de: spec-02 (contrato adapter, eventBus, mirrorPedido), spec-01 (IntegrationCredential/UnifiedOrder)

## Objetivo

Integração com Keeta via `keetaAdapter`, no mesmo contrato do hub, usando a
Open API da Keeta. Keeta (grupo Meituan) possui Open API própria; dados
financeiros variam por mercado. Pontos exatos marcados **TO HOMOLOGATE**.

## Adapter — `hub/adapters/keetaAdapter.js`

Implementa `MarketplaceAdapter`:
```
connect, disconnect, refreshToken, syncOrders, getOrder, healthCheck, capabilities
```
`capabilities`:
```
supportsOrders: true
supportsPayments: bool        // TO HOMOLOGATE (dependente do mercado/contrato)
supportsFinancialData: bool   // TO HOMOLOGATE (não presumir que existe)
supportsMenu: bool            // TO HOMOLOGATE (porta do cardápio/loja)
supportsWebhooks: true        // Open API Keeta possui webhook de pedido
supportsPolling: true
supportsStoreManagement: true
```

## Autenticação

- OAuth2 Open API Keeta: `KEETA_CLIENT_ID`, `KEETA_CLIENT_SECRET`, `KEETA_API_BASE`,
  `KEETA_AUTH_BASE` (+ scopes de pedido/loja).
- `access_token` + `refresh_token` em `IntegrationCredential` criptografado;
  `expiresAt` p/ refresh automático + retry único em 401.
- Merchant/store: `externalStoreId` + identificador de loja em `MarketplaceIntegration`.

## Webhooks

`POST /webhooks/keeta` → `keetaAdapter.validate(req)`:
- TO HOMOLOGATE: autenticidade (assinatura/header). Hook retorna `{valid, empresaId, event}`.
- Assinatura inválida → 401 sem processar; senão enfileira via `eventBus`.
- Mapeamento de status de pedido Keeta → interno (TO HOMOLOGATE; se desconhecido
  manter `sourceStatusRaw` + status interno `pendente`).

## Normalização + espelho

`normalize(order)` → UnifiedOrder:
- valores informados quando presentes; ausente → `NULL`/`UNKNOWN`, origem marcada.
- `platformFee`/`netAmount`: só preencher se a Keeta fornecer; nunca estimar
  quando não houver base clara.
- `mirrorPedido` cria `pedidos` via `nextPedidoId()`; `pedidoId` linkado.

## Sync / polling

- `syncOrders(from, to)` (padrão 24h; máx 7 dias): consulta pedidos recentes +
  detalhe; upsert UnifiedOrder.
- Retry/backoff do hub (spec-02).

## APIs de apoio

```
POST /api/integrations/keeta/authorize    (OAuth; superadmin)
POST /api/integrations/keeta/disconnect   (superadmin)
```

## Testes

`tests/keetaAdapter.test.js` (mocks):
- normalize; mapeamento de status (tabelado);
- token expirado → refresh + retry único;
- idempotência (duplicado → skipped);
- campos financeiros ausentes → NULL;
- assinatura inválida → 401;
- healthCheck.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| Dados financeiros da Keeta variam por mercado | `capabilities.financialData` condicional; ausente → NULL |
| Endpoint/assinatura | TO HOMOLOGATE explícito; adapter isolado (1 arquivo) |
| Campos financeiros não fornecidos | Nunca estimar sem base; origem marcada |
| Derrubar ERP | Isolamento do hub |

## Homologação (validar com Open API Keeta)

- Scopes e grant OAuth corretos.
- Assinatura de webhook (header/algoritmo).
- Mapeamento de status de pedido.
- Dados financeiros/taxas por mercado.

## Fora de escopo

- iFood (spec-05), 99Food (spec-06), UI (spec-08).
