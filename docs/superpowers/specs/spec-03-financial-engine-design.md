# Design — Spec 03: Motor Financeiro + Custos

Data: 2026-08-23
Projeto: sic-ia (SaaS ERP multi-tenant, backend JS/Express/Prisma/PostgreSQL)
Status: aprovado pelo usuário (não commitado — ordem do usuário)
Depende de: spec-01 (UnifiedOrder, DailyClosing), spec-02 (hub — para origem de dados própria)

## Objetivo

Motor determinístico que calcula, por pedido unificado e por dia/agregação:
faturamento bruto, descontos, taxas de plataforma/pagamento, receita líquida,
CMV, custos adicionais, lucro e margem — separando claramente "faturamento" de
"lucro". Base para o fechamento diário (spec-04) e dashboard (spec-08).

## Decisão aprovada

- **Custo do produto via campo aditivo em `Produto`** (opção A): `custo Decimal? @default(0)`.

## Mudanças de schema (aditivas)

1. `Produto`:
   ```
   custo Decimal? @default(0) @map("custo")
   ```
   Coluna nova nullable/default 0. Nenhuma query existente alterada; dados
   atuais intactos; rollback: `DROP COLUMN` manual.

2. Modelo novo `FinancialCost`:
   ```
   id         Int @id @default(autoincrement())
   empresaId  Int @map("empresa_id")
   tipo       String            // packaging | fixo | entrega | outro
   nome       String
   valor      Decimal @db.Decimal(10,2)
   ativo      Boolean @default(true)
   createdAt  DateTime @default(now()) @map("criado_em")
   updatedAt  DateTime @updatedAt @map("atualizado_em")
   empresa    Empresa @relation(...)
   @@index([empresaId, tipo])
   @@map("financial_costs")
   ```
   `Empresa` ganha relação `financialCosts FinancialCost[]`.

## Estrutura do motor

`backend/src/financial/` (arquivos novos):

| Arquivo | Responsabilidade |
|---|---|
| `financialEngine.js` | Cálculo determinístico por pedido + agregações |
| `costsRepository.js` | CRUD FinancialCost + custos de produtos (sempre `empresaId` parametrizado) |
| `money.js` | Helper cêntavos/Decimal, arredondamento HALF_EVEN |
| `timezone.js` | Cálculo `financialDate` em America/Sao_Paulo |

## Fórmulas (em centavos internamente)

```
grossSales    = subtotal + deliveryFee            // informado pela plataforma; own = valoresItens
netRevenue    = grossSales − discounts − platformFees − paymentFees
cmv           = Σ (item.qtd × produto.custo)
otherCosts    = Σ custos variáveis por pedido (packaging) + rateio fixos (totalFixoAtivo/30 por dia)
profit        = netRevenue − cmv − otherCosts
profitMargin  = profit / grossSales               // grossSales == 0 → null (sem div/0)
```

- Valores nulos de plataforma → tratados como 0 com marca de origem
  (`valores informados vs estimados vs NULL`); nunca inventar valor.
- Saída sempre `Decimal(10,2)`; resultado determinístico (mesma entrada → mesma saída).

## Agregações (base do fechamento)

```
aggregateDay(empresaId, date)
  → totals (gross, discounts, fees..., net, cmv, others, profit, margin)
  + byPlatform, byPayment, byHour, byProduct (Json, como dá DailyClosing da spec-01)
aggregateRange(empresaId, from, to) → série por dia
```

- Escopo de datas por `financialDate` (America/Sao_Paulo).
- Queries somente via `financialRepository` — sem `EMPRESA_ID=1` hardcoded.

## APIs novas
```
GET /api/financial/costs                    (listar; superadmin)
PUT /api/financial/costs/:id                (upsert/soft toggle ativo)
GET /api/financial/products                 (produtos + custo)
PUT /api/financial/products/:id/custo       (atualizar custo)
GET /api/financial/order-calc/:uoId         (debug cálculo de 1 UnifiedOrder)
```
- Auth: `authenticate` + `authorize('superadmin', 'admin')` (rotas de escrita somente superadmin).

## Testes

`tests/financialEngine.test.js` — tabelado:
- bruto simples; desconto; taxas plataforma+pagamento; delivery;
- CMV com custo definido/zero; embalagem por pedido; fixo rateado /30;
- divisão por zero (margem null); valores nulos; deterministicismo (2 runs iguais);
- arredondamento HALF_EVEN em casos limites.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| Coluna nova em Produto em produção | Aditiva nullable/default 0; `db push`; sem reset; rollback `DROP COLUMN` |
| Faturamento confundido com lucro | Breakdown completo em toda saída; testes explícitos de margem |
| Float em dinheiro | Centavos Int; Decimal(10,2) final |
| Single-tenant (EMPRESA_ID=1) | Repositórios novos sempre parametrizados por `empresaId` |
| Quebrar relatórios atuais | Nada existente alterado; 23/23 testes intactos |

## Fora de escopo

- Fechamento diário + histórico imutável + reconciliação (spec-04).
- UI Financeiro/Dashboard (spec-08).
- Custos por variação/sabores de produto (futuro; YAGNI agora).
