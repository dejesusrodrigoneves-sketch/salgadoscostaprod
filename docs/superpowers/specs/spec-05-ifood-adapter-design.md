# Design — Spec 05: Adapter iFood

Data: 2026-08-23
Projeto: sic-ia (SaaS ERP multi-tenant, backend JS/Express/Prisma)
Status: aprovado pelo usuário (não commitado — ordem do usuário)
Depende de: spec-02 (contrato adapter, eventBus, mirrorPedido), spec-01 (IntegrationCredential/UnifiedOrder)

## Objetivo

Integração com iFood via Adapter isolado, seguindo o contrato `MarketplaceAdapter`
e as regras do hub. Endpoints/assinatura marcados **TO HOMOLOGATE** — implementa
abstração + fluxo; valores exatos conferidos na homologação (regra: não inventar API).

## Adapter — `hub/adapters/ifoodAdapter.js`

Implementa contrato da spec-02:
```
connect, disconnect, refreshToken, syncOrders, getOrder, healthCheck, capabilities
```
`capabilities`:
```
supportsOrders: true
supportsPayments: bool   // parcial, conforme payload
supportsFinancialData: 'estimated'   // dados financeiros estimados
supportsMenu: true
supportsWebhooks: true
supportsPolling: true
supportsStoreManagement: true
```

## Autenticação (OAuth2 iFood)

```
POST <IFOOD_AUTH_BASE>/oauth/token
  - application form; grant conforme tipo de app (client_credentials/authorization_code)
  - access_token + refresh_token → salvar em IntegrationCredential (criptografado)
  - expiresAt controla refresh automático + retry único em 401
```
Config: `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET`, `IFOOD_AUTH_BASE`, `IFOOD_API_BASE`.
Por loja: `externalStoreId` (storeId) + `merchantCode` em `MarketplaceIntegration`.

## Webhooks

`POST /webhooks/ifood` → `ifoodAdapter.validate(req)`:
- **TO HOMOLOGATE** — verificação de autenticidade/assinatura (header provável
  `x-efi-signature`; confirmar em docs iFood). Hook retorna `{ valid, empresaId, event }`.
- Assinatura inválida → 401 sem processamento.
- Mapeamento de status:
  `PLACED→pendente, CONFIRMED→em_preparacao, DISPATCHED→saiu_para_entrega,
   DELIVERED→entregue, CANCELLED→cancelado, DELIVERY_FAILED→falha_entrega`.
- Enfileira via `eventBus` (spec-02) → `IntegrationEvent`; idempotência
  `(empresaId, platform, externalOrderId)`; duplicado → `skipped`.

## Normalização + espelho

`normalize(order)` → UnifiedOrder:
```
subtotal      = Σ itens (informado)
deliveryFee   = taxaEntrega (informado)
discount      = desconto (informado)
platformFee   = estimado: total − (subtotal + deliveryFee − discount)  → flag 'estimated'
paymentAmount = total (informado)
netAmount     = total (informado)
paymentMethod / paymentStatus = payload de pagamento quando presente; senão NULL/UNKNOWN
```
`mirrorPedido` (spec-02): cria `pedidos` via `sql.nextPedidoId()`; grava
`UnifiedOrder.pedidoId`. `orderService` NÃO é alterado (hub é consumidor).

## Sincronização

- `syncOrders(from, to)` — padrão últimas 24h; máx 7 dias por chamada.
- Consulta eventos de mudança de pedidos + detalhe por pedido; upsert UnifiedOrder.
- Retry/backoff conforme hub (spec-02); falhas → `IntegrationEvent.failed` + AppLog.

## APIs de apoio (rotas novas)

```
POST /api/integrations/ifood/authorize     (inicia OAuth; superadmin)
POST /api/integrations/ifood/disconnect    (revoga + limpa credencial; superadmin)
```

## Testes

`tests/ifoodAdapter.test.js` (mocks HTTP/fetch):
- parse pedido → UnifiedOrder correto;
- mapeamento status (tabelados);
- platformFee estimado marcado; campos ausentes → NULL;
- 401 → refresh + retry único;
- idempotência (duplicado → `skipped`);
- assinatura inválida → 401 sem processar;
- healthCheck.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| Endpoint/assinatura divergente | TO HOMOLOGATE explícito; adapter isolado (1 arquivo) p/ ajuste pontual |
| Valores financeiros ausentes | NULL + origem estimada; nunca inventar |
| Token exposto | Credencial criptografada; logs sem tokens |
| Derrubar ERP | Isolamento do hub (try/catch, retry, estado error) |

## Homologação (a validar com docs iFood)

- Assinatura de webhook (header + algoritmo) — confirmar.
- Formato exato do payload de pedido e de eventos.
- Escopos OAuth e grant correto por tipo de app.
- Disponibilidade de dados financeiros por evento (parcial).

## Fora de escopo

- 99Food (spec-06), Keeta (spec-07).
- UI (spec-08).
- Sincronização de cardápio/loja em profundidade (spec-05 só mapeia; render via sync por pedido; expandir em homologação).
