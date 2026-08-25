# Design — Spec A: Fundação de Dados (Integration Hub)

Data: 2026-08-23
Projeto: sic-ia (SaaS ERP salgados/multi-tenant)
Status: aprovado pelo usuário (não commitado — ordem do usuário)

## Objetivo

Criar a base de dados para centralizar vendas de marketplaces (iFood, 99Food,
Keeta) + vendas próprias e alimentar o futuro motor financeiro + fechamento
diário. Entregar apenas modelos Prisma novos — zero alteração em tabelas
existentes com dados de produção.

## Decisões aprovadas

- **Opção A (pedidos de marketplace):** pedido externo cria registro na tabela
  `pedidos` existente (fluxo vivo do ERP: painel, caixa, entregas) via
  `sql.nextPedidoId()` (Counter existente) e `UnifiedOrder` aponta para ele
  via `pedidoId`. Sem backfill massivo — somente pedidos novos.
- **100% aditivo:** `prisma db push` — nenhuma tabela existente alterada,
  nenhuma coluna nova em tabelas com produção. `Produto` intocado (custos
  ficam no Spec F).
- **Convênções do projeto seguidas:** `@map` snake_case, `Decimal(10,2)`,
  `empresaId` obrigatório em todos os modelos, índices para queries por tenant.

## Modelos novos

### MarketplaceIntegration
```
id            Int @id @default(autoincrement())
empresaId     Int  @map("empresa_id")
platform      String            // ifood | food99 | keeta | own
externalStoreId String?         @map("external_store_id")
status        String @default("disconnected")  // connected|disconnected|error|expired
syncStatus    String @default("idle")          @map("sync_status")
lastSuccessfulSync DateTime?    @map("last_successful_sync")
lastAttempt   DateTime?         @map("last_attempt")
nextSync      DateTime?         @map("next_sync")
errorCount    Int    @default(0) @map("error_count")
createdAt     DateTime @default(now())  @map("criado_em")
updatedAt     DateTime @updatedAt       @map("atualizado_em")
empresa       Empresa @relation(...)
@@unique([empresaId, platform])
@@index([empresaId, status])
@@map("marketplace_integrations")
```

### IntegrationCredential
```
id            Int @id
empresaId     Int  @map("empresa_id")
platform      String
accessTokenEncrypted  String?  @map("access_token_encrypted")
refreshTokenEncrypted String? @map("refresh_token_encrypted")
expiresAt     DateTime? @map("expira_em")
createdAt / updatedAt
@@unique([empresaId, platform])
@@map("integration_credentials")
```
Secrets: acesso somente backend; criptografados AES-256-GCM em repouso com
chave em `.env` (add `INTEGRATION_SECRET_KEY`). Nunca retornados por API.

### IntegrationEvent
```
id BigInt @id @default(autoincrement())
empresaId Int   @map("empresa_id")
platform  String
eventType   String?  @map("event_type")
externalOrderId String? @map("external_order_id")
payload Json?
status String @default("received")   // received|processed|failed|skipped
attempts Int @default(0)
lastError String? @map("last_error")
idempotencyKey String? @map("idempotency_key")
createdAt @default(now()) @map("criado_em")
processedAt DateTime? @map("processado_em")
@@unique([idempotencyKey])
@@index([empresaId, platform, createdAt])
@@map("integration_events")
```

### UnifiedOrder
```
id            String @id            // gerado: UO-<platform>-<externalOrderId>
empresaId     Int    @map("empresa_id")
platform      String
externalOrderId   String  @map("external_order_id")
externalStoreId   String? @map("external_store_id")
externalCustomerId String? @map("external_customer_id")
pedidoId      String? @map("pedido_id")     // link p/ pedidos (OWN/marketplace)
status        String @default("pendente")
customer      Json?
items         Json?
subtotal      Decimal? @db.Decimal(10,2)
discount      Decimal? @db.Decimal(10,2)
deliveryFee   Decimal? @db.Decimal(10,2)   @map("delivery_fee")
serviceFee    Decimal? @db.Decimal(10,2)   @map("service_fee")
platformFee   Decimal? @db.Decimal(10,2)   @map("platform_fee")
grossAmount   Decimal? @db.Decimal(10,2)   @map("gross_amount")
netAmount     Decimal? @db.Decimal(10,2)   @map("net_amount")
paymentMethod String? @map("payment_method")
paymentStatus String? @map("payment_status")
financialDate DateTime? @map("financial_date")  // America/Sao_Paulo, dia financeiro
orderCreatedAt DateTime? @map("order_created_at")
orderUpdatedAt DateTime? @map("order_updated_at")
synchronizedAt DateTime? @map("sincronizado_em")
sourceStatusRaw String? @map("source_status_raw")
createdAt / updatedAt
@@unique([empresaId, platform, externalOrderId])
@@index([empresaId, platform, createdAt])
@@index([pedidoId])
@@map("unified_orders")
```
Valores de plataforma (informado) nunca misturados com valores calculados pelo
ERP (Spec F calcula custo/lucro — aqui só campos informados/estimados).

### DailyClosing
```
id Int @id
empresaId Int @map("empresa_id")
date DateTime
version Int @default(1)
status String @default("draft")   // draft|closed|reprocessed
grossSales Decimal? @db.Decimal(10,2) @map("gross_sales")
discounts Decimal?  @map("descontos")
platformFees Decimal? @map("platform_fees")
paymentFees Decimal? @map("payment_fees")
deliveryFees Decimal? @map("delivery_fees")
cmv Decimal? @map("cmv")
otherCosts Decimal? @map("other_costs")
netRevenue Decimal? @map("net_revenue")
profit Decimal?
profitMargin Decimal? @map("profit_margin")
byPlatform Json? @map("by_platform")
byPayment Json? @map("by_payment")
byHour Json? @map("by_hour")
byProduct Json? @map("by_product")
totalOrders Int? @map("total_orders")
startedAt DateTime? @map("iniciado_em")
completedAt DateTime? @map("concluido_em")
closedBy Int? @map("closed_by")
createdAt / updatedAt
@@unique([empresaId, date])
@@map("daily_closings")
```

### DailyClosingChange
```
id Int @id
closingId Int @map("closing_id")
version Int
changedBy Int? @map("changed_by")
reason String?
before Json?
after Json?
changedAt DateTime @default(now()) @map("alterado_em")
@@index([closingId])
@@map("daily_closing_changes")
```

### Relações Empresa
Adicionar em `Empresa`: `marketplaceIntegrations MarketplaceIntegration[]`,
`integrationCredentials IntegrationCredential[]`, `integrationEvents IntegrationEvent[]`,
`unifiedOrders UnifiedOrder[]`, `dailyClosings DailyClosing[]`.

## Migração

- `prisma db push` (aditivo; cria tabelas novas + índices).
- Nenhuma coluna/constraint removida ou alterada em tabelas existentes.
- Rollback: SQL manual documentado (DROP TABLE nas novas) — não usar `--force-reset`.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| Quebrar queries existentes | Nenhuma tabela existente tocada; `Empresa` ganha apenas campos de relação (Prisma migrations aditivas) |
| Duplicidade de pedido | `UNIQUE(empresaId, platform, externalOrderId)` + `idempotencyKey UNIQUE` em eventos |
| Token em log/front | Credenciais criptografadas; APIs nunca expõem campos `*Encrypted` |
| Conflito de dia financeiro | `financialDate` calculado em `America/Sao_Paulo` no Spec B+; campo existe desde já |
| Perda de dados ao rodar db push | Nenhuma operação destrutiva; teste no banco de staging antes se disponível |

## Fora de escopo (specs futuros)

- B: Integration Hub (adapters interface, fila/retry, status mapping)
- F: Motor financeiro (custos, CMV, lucro; campo custo em Produto)
- G: Fechamento diário lógico + reconciliação + histórico versionado
- C/D/E: adapters iFood/99Food/Keeta
- H: UI (Integrações/Financeiro/Dashboard/Fechamentos/Logs)

## Verificação

1. `npx prisma db push` aplica sem erro no ambiente dev.
2. `npx prisma generate` ok.
3. Testes existentes continuam passando (23/23 em vitest root).
4. Server sobe (porta 3000) e rotas atuais respondem.
