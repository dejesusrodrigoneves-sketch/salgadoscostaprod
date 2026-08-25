# Design — Spec 06: Adapter 99Food

Data: 2026-08-23
Projeto: sic-ia (SaaS ERP multi-tenant, backend JS/Express/Prisma)
Status: aprovado pelo usuário (não commitado — ordem do usuário)
Depende de: spec-02 (contrato adapter, eventBus, mirrorPedido), spec-01 (IntegrationCredential/UnifiedOrder)

## Objetivo

Integração com 99Food via `food99Adapter`, no mesmo contrato do hub. A API oficial
da 99Food é menos documentada/publicada que a do iFood p/ determinados parceiros;
portanto os pontos de endpoint/assinatura são marcados **TO HOMOLOGATE**, com a
camada pronta para receber as credenciais/contratos reais.

## Adapter — `hub/adapters/food99Adapter.js`

Implementa `MarketplaceAdapter`:
```
connect, disconnect, refreshToken, syncOrders, getOrder, healthCheck, capabilities
```
`capabilities`:
```
supportsOrders: true
supportsPayments: false        // não assume dados de pagamento
supportsFinancialData: 'limited'   // quase nenhum valor financeiro detalhado
supportsMenu: false            // cardápio não exposto oficialmente p/ todos parceiros
supportsWebhooks: bool         // TO HOMOLOGATE (webhook disponível? senão polling)
supportsPolling: true
supportsStoreManagement: false
```

## Autenticação

- TO HOMOLOGATE: se a 99Food entregar OAuth/Api-Key por parceiro, seguir o mesmo
  padrão de credencial criptografada (`IntegrationCredential`). Caso use apenas
  token estático/parceiro, guardar `accessTokenEncrypted` sem refresh.
- Config: `FOOD99_CLIENT_ID`, `FOOD99_CLIENT_SECRET`, `FOOD99_API_BASE`
  (placeholders no `.env.example`).

## Fluxo (baseado em polling, quando sem webhook)

- `syncOrders(from, to)`: consulta pedidos por intervalo + detalhe por pedido
  (TO HOMOLOGATE: caminhos exatos e query de intervalo).
- Estado de pedido → `UnifiedOrder.status` (mapeamento de status TO HOMOLOGATE;
  se não documentado, manter `sourceStatusRaw` e status interno `pendente` até
  confirmação em homologação).
- Sem dados de pagamento/cardápio por padrão → campos ficam `NULL`.

## Webhooks (se disponível)

`POST /webhooks/99food` → `food99Adapter.validate(req)`:
- TO HOMOLOGATE: autenticidade (header/assinatura) conforme contrato real.
- Assinatura inválida → 401 sem processar; senão enfileira via `eventBus`.

## Normalização + espelho

`normalize(order)` → UnifiedOrder (mesma disciplina da spec-05):
- valores informados quando presente; ausente → `NULL`/`UNKNOWN`, sem inventar.
- `mirrorPedido` cria `pedidos` via `nextPedidoId()`; `pedidoId` linkado.

## Testes

`tests/food99Adapter.test.js` (mocks):
- normalize com dados parciais → campos ausentes `NULL`;
- capacidade `supportsFinancialData='limited'` refletida;
- sync via polling mapeia pedidos;
- idempotência (duplicado → skipped);
- assinatura inválida → 401 (se webhook);
- healthCheck.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| API pouco documentada | TO HOMOLOGATE; abstraction pronta; sem inventar endpoints |
| Valores financeiros ausentes | NULL + origem; plataforma não derruba o ERP |
| Webhook inexistente | Polling como caminho primário |

## Homologação (validar com docs 99Food)

- Tipo de credencial (OAuth vs token parceiro).
- Existe webhook? Header/assinatura? Ou só polling?
- Mapeamento de status dos pedidos.
- Dados financeiros/taxas disponíveis.

## Fora de escopo

- iFood (spec-05), Keeta (spec-07), UI (spec-08).
