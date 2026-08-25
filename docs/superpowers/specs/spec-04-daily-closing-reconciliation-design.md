# Design — Spec 04: Fechamento Diário + Histórico + Reconciliação

Data: 2026-08-23
Projeto: sic-ia (SaaS ERP multi-tenant, backend JS/Express/Prisma/PostgreSQL)
Status: aprovado pelo usuário (não commitado — ordem do usuário)
Depende de: spec-01 (DailyClosing, DailyClosingChange), spec-03 (aggregateDay/cálculo)

## Objetivo

Consolidar todas as vendas do dia (marketplaces + próprias) num demonstrativo
financeiro imutável, com histórico versionado e auditoria de alterações, além
de reconciliação entre plataforma e ERP. Sem conflito com `CaixaDiario`.

## Modelo novo (aditivo)

`Reconciliation`:
```
id           Int @id
empresaId    Int @map("empresa_id")
platform     String
dataInicio   DateTime @map("data_inicio")
dataFim      DateTime @map("data_fim")
totalPlatform Decimal? @map("total_platform")
totalErp     Decimal?  @map("total_erp")
diffs        Json?              // lista de divergências
status       String @default("pending")   // pending | done
createdAt    DateTime @default(now()) @map("criado_em")
@@index([empresaId, platform])
@@map("reconciliations")
```

## Fechamento — `financial/closingService.js`

| Operação | Regra |
|---|---|
| `close(empresaId, date, user, reason?)` | `aggregateDay` → preenche `DailyClosing` (totais + byPlatform/byPayment/byHour/byProduct/items); grava com UNIQUE(empresaId,date) |
| Sem duplo fechamento | status=`closed` → 409; UNIQUE impede repetição |
| Imutável | Fechamento fechado nunca é sobrescrito; mudança = `version+1` + `DailyClosingChange` (before/after/changedBy/reason/changedAt) |
| `reprocess(date, user, reason?)` | Recompute + nova versão + change log |
| `reopen(date, user, reason?)` | status=`draft` + version bump + change log |
| Automático | Vercel Cron `POST /api/financial/closings/cron` (header secret) → fecha dias pendentes dos últimos 7 (idempotente) |
| Dev | Sem cron; fechamento manual via API |

Determinístico: mesmos dados → mesmo fechamento. `financialDate` em
America/Sao_Paulo (pedido 23:58 fica no dia correto).

**Coordenação:** DailyClosing = demonstrativo amplo; `CaixaDiario` = conferência
física do caixa. Nenhum altera o outro; leitura independente.

## Reconciliação — `financial/reconciliationService.js`

Por plataforma num intervalo:
- Fonte plataforma (adapter/sync) **vs** ERP (`unified_orders` + espelho `pedidos`)
- Detecta: ausente no ERP, duplicado, valor/status/pagamento/taxa divergente
- Grava `Reconciliation` com `diffs[]` (campo, externalOrderId, valorPlataforma, valorErp)

| Caso | Resultado |
|---|---|
| Pedido na plataforma, ausente no ERP | `missing_in_erp` |
| Mais de um registro no ERP | `duplicate` |
| Valores diferentes | `amount_mismatch` |
| Status/pagamento/taxa diferente | `status_mismatch` / `fee_mismatch` |

## APIs novas

```
POST /api/financial/closings/cron              (header secret)
POST /api/financial/closings/:date/close       (superadmin)
POST /api/financial/closings/:date/reprocess   (superadmin + reason)
POST /api/financial/closings/:date/reopen      (superadmin + reason)
GET  /api/financial/closings                   (histórico do tenant)
GET  /api/financial/closings/:date             (detalhe completo)
POST /api/reconciliation/:platform/run         (superadmin)
GET  /api/reconciliation                       (listar)
```

## Testes

`tests/closingService.test.js`:
- deterministicismo (2× mesma data → igual);
- duplo close → 409;
- versioning: reopen+reprocess geram versões e `DailyClosingChange`;
- borda de timezone (23:5x America/Sao_Paulo → mesmo dia);
- reconciliação detecta: missing, duplicate, amount_mismatch, status_mismatch;
- fechamento não altera pedidos nem caixa_diario.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| Quebrar CaixaDiario | Não toca; leitura separada |
| Perder histórico | Imutável + versioning + change log |
| Duplo fechamento | UNIQUE(empresaId,date) + status check |
| Cron em produção | Header secret; janela 7 dias; idempotente; sem loop |

## Fora de escopo

- UI Financeiro/Fechamentos/Reconciliação (spec-08).
- Fila de reconciliação automática contínua (agora: sob demanda + cron).
- Alertas (futuro).
