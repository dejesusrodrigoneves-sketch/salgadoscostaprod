# Settlement Semanal por Empresa — Design Spec

> **Status:** Aprovado
> **Data:** 2026-08-24
> **Branch:** main (sem commit até aprovação do plano)

## Visão Geral

Sistema de settlement semanal para multi-tenant. Cada empresa tem conta Asaas própria. Ciclo de vendas: seg-sex. Sábado 00:00, job automático fecha a semana, arquiva dados, prepara pagamento. Segunda, Asaas efetua transferência. Dashboard mostra o que cada empresa tem a receber.

## Contexto

- Pagamentos via Asaas PIX, 2% fee descontado no pagamento
- Split automático: dinheiro vai direto para conta Asaas de cada empresa
- Sem comissão de plataforma no backend (Asaas já cobra 2%)
- Ciclo semanal com reset de contadores

## Modelo de Dados

### Novo Model: WeeklySettlement

```prisma
model WeeklySettlement {
  id              Int       @id @default(autoincrement())
  empresaId       Int
  weekStart       DateTime  // Segunda 00:00
  weekEnd         DateTime  // Sexta 23:59:59
  totalPedidos    Int       // Quantidade de pedidos pagos no ciclo
  totalBruto      Decimal   @db.Decimal(10, 2) // Soma pedido.total
  totalLiquido    Decimal   @db.Decimal(10, 2) // totalBruto * 0.98
  status          String    @default("processando") // processando | pendente | pago | erro
  processedAt     DateTime? // Quando job rodou (sáb 00:00)
  paidAt          DateTime? // Confirmação recebimento
  asaasTransferId String?   // ID transferência Asaas
  createdAt       DateTime  @default(now())

  empresa         Empresa   @relation(fields: [empresaId], references: [id])

  @@unique([empresaId, weekStart])
  @@index([empresaId])
  @@index([status])
}
```

### Campo Novo em Empresa

```prisma
model Empresa {
  // ... campos existentes ...
  deletedAt DateTime? // Soft delete timestamp
}
```

### Campo Novo em Pedido

```prisma
model Pedido {
  // ... campos existentes ...
  semanaNoAcervo Boolean @default(false) // Marca se pedido já foi incluído em settlement
}
```

## Fluxo Semanal

### 1. Acumulação (Seg-Sex)

- Pedidos entram normalmente
- Dinheiro vai para conta Asaas da empresa (split automático)
- Dashboard mostra "semana atual" com totais parciais

### 2. Processamento (Sáb 00:00)

Job automático roda para CADA empresa (inclusive deletadas):

1. Busca pedidos pagos (`status=pago`, `createdAt` entre weekStart e weekEnd)
2. Calcula `totalBruto` (soma `pedido.total`)
3. Calcula `totalLiquido` (`totalBruto * 0.98`)
4. Cria `WeeklySettlement` com status `"pendente"`
5. Marca pedidos: `semanaNoAcervo = true`

**Se empresa não teve pedidos:** não cria settlement.

**Idempotência:** Unique constraint `(empresaId, weekStart)` impede duplicata.

### 3. Confirmação (Segunda)

- Webhook Asaas confirma transferência
- Status → `"pago"`, `paidAt = now()`
- Se empresa deletada e nenhum settlement pendente → hard delete

## Soft Delete de Empresas

### Regra

Empresa com valores a receber não pode ser deletada imediatamente. Recebe soft delete (`deletedAt`), dados continuam existindo até settlement completar.

### Fluxo

```
Admin deleta empresa
  → Set deletedAt = now()
  → Empresa some do sistema (login, público, admin)
  → Settlements continuam processando
  → Quando ÚLTIMO settlement → "pago"
    → Hard delete empresa + todos dados
```

### Bloqueios (Empresa Deletada)

**Login (authService.js):**
```javascript
// Após buscar usuário
if (user.empresa?.deletedAt) {
  throw Object.assign(new Error('Empresa inativa'), { status: 403 });
}
```

**Página pública (resolveEmpresa.js):**
```javascript
// Após buscar empresa
if (empresa.deletedAt) {
  return res.status(404).json({ error: 'Loja não encontrada' });
}
```

**Rotas admin/user (auth.js middleware):**
```javascript
// Após decodificar token
if (decoded.empresaId) {
  const empresa = await sql.buscarEmpresa(decoded.empresaId);
  if (empresa?.deletedAt) {
    return res.status(403).json({ error: 'Empresa inativa' });
  }
}
```

### Hard Delete Automático

Após `confirmarPagamento()`:

```javascript
const pendentes = await sql.countSettlementsPendentes(empresaId);
if (pendentes === 0) {
  const empresa = await sql.buscarEmpresa(empresaId);
  if (empresa?.deletedAt) {
    await hardDeleteEmpresa(empresaId);
  }
}
```

**Ordem de cascade delete (respeitando FK):**
1. LoginLog, AuditLog, AppLog (logs primeiro)
2. ProcessedWebhook
3. WhatsAppInstance
4. ItensPedido
5. Pagamento
6. EntregaDiaria
7. Pedido
8. WeeklySettlement
9. CaixaDiario
10. Horario
11. Cupom
12. Produto
13. Categoria
14. Usuario
15. Cliente
16. Counter
17. Empresa (última)

## Dashboard

### Empresa: Painel Financeiro

**Seção 1 — Card Semana Atual:**
```
Semana: 18/08 - 22/08
A receber: R$ 1.247,32 (líquido)
Status: ● Pendente
Pedidos: 47
```

**Seção 2 — Pedidos do Ciclo:**
- Lista dos pedidos pagos na semana
- Colunas: ID, Data, Valor, Pagamento

**Seção 3 — Histórico (aba "Semanas anteriores"):**
- Lista de settlements passados
- Cada um: período, total, status
- Clique expande → pedidos daquela semana

### Superadmin: Settlements Globais

- Visão de todas as empresas
- Filtro por status
- Indicador: empresas com valores pendentes
- Empresa deletada aparece como: `Empresa X (deletada) — R$ 542,18 pendente`

## API

### Rotas Empresa (autenticadas, scoping por empresaId)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/empresa/settlement/actual` | Settlement semana atual |
| GET | `/api/empresa/settlement/history` | Settlements anteriores (paginado) |
| GET | `/api/empresa/settlement/:id` | Detalhe (pedidos incluídos) |
| GET | `/api/empresa/pedidos-semana` | Pedidos pagos ciclo atual |

### Rotas Superadmin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/settlements` | Settlements globais (todas empresas) |

### Respostas

**GET /api/empresa/settlement/actual:**
```json
{
  "id": 1,
  "weekStart": "2026-08-18T00:00:00Z",
  "weekEnd": "2026-08-22T23:59:59Z",
  "totalPedidos": 47,
  "totalBruto": "1272.78",
  "totalLiquido": "1247.32",
  "status": "pendente",
  "processedAt": "2026-08-23T03:00:00Z",
  "paidAt": null
}
```

**GET /api/empresa/settlement/history:**
```json
{
  "settlements": [...],
  "pagination": { "page": 1, "total": 12 }
}
```

## Arquivos

### Novos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `backend/src/services/settlementService.js` | Lógica: fechar semana, buscar history, confirmar pagamento |
| `backend/src/controllers/settlementController.js` | Rotas empresa + superadmin |
| `backend/src/routes/settlementRoutes.js` | Definição de rotas |
| `backend/src/jobs/weeklySettlement.js` | Cron job sáb 00:00 |

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `backend/prisma/schema.prisma` | +WeeklySettlement, +Empresa.deletedAt |
| `backend/src/app.js` | +settlementRoutes, +cron job import |
| `backend/src/middleware/auth.js` | Verificar deletedAt |
| `backend/src/middleware/resolveEmpresa.js` | Skip empresas deletadas |
| `backend/src/services/authService.js` | Bloquear login empresa deletada |
| `backend/src/controllers/adminController.js` | Soft delete em vez de hard |
| `backend/src/repositories/sqlRepository.js` | +queries settlement |
| `superadmin.html` | Aba settlements globais |
| `painelLoja.html` | Aba financeiro |

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Job roda 2x | Unique constraint (empresaId, weekStart) |
| Empresa sem pedidos | Não cria settlement |
| Asaas demora webhook | Status "pendente" até confirmação |
| Pedido pago sex 23:59 | Entra no ciclo atual |
| Pedido pago sáb 00:01 | Próximo ciclo |
| Deletada com pendente | Soft delete, settlements continuam |
| Settlement falha em deletada | Retry manual + log erro |
| Hard delete prematuro | Só após TODOS settlements "pago" |
| Empresa restaurada | Limpar deletedAt se necessário |
