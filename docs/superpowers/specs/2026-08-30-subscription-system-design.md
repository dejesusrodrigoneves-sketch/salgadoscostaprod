# Subscription System — Design Spec

> **⚠️ REGRA GLOBAL: NENHUM COMMIT durante implementação. Todas as mudanças ficam uncommitted até ordem explícita do usuário.**

## Objetivo

Sistema de assinatura recorrente para o SaaS. Cada empresa (tenant) possui uma assinatura com ciclo de vida: TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELED. Cobranças recorrentes via Asaas. Notificações via WhatsApp (Evolution API).

## 1. Arquitetura Geral

```
EMPRESA
 ├── status operacional (ativa/inativa)
 └── Asaas: customer ID, API key, wallet ID

SUBSCRIPTION (1:1 com Empresa)
 ├── status: TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELED
 ├── value: R$100 (fixo)
 ├── billingType: PIX/BOLETO/CREDIT_CARD
 ├── nextDueDate
 ├── trialEndsAt
 └── lastPaymentAt

FLUXOS:
 1. Empresa criada → Subscription (TRIAL, 14 dias)
 2. Trial fim → status PAST_DUE → overlay + 404 no index
 3. Pagamento → Asaas webhook → status ACTIVE → WhatsApp notificação
 4. Próxima cobrança → Asaas subscription recorrente (30 dias)
 5. Inadimplência → 7d/4d/0d/3d/5d/7d/9d/10d WhatsApp → read-only → bloqueio
```

### 1.1 Fluxo de inadimplência

```
7d antes  → WhatsApp lembrete
4d antes  → WhatsApp lembrete
0d (vencimento) → WhatsApp aviso juros
3d após   → WhatsApp 1º lembrete
5d após   → WhatsApp 2º lembrete + READ-ONLY + 404 index
7d após   → WhatsApp 3º lembrete
9d Após   → WhatsApp 4º lembrete
10d após  → WhatsApp aviso final + BLOQUEIO TOTAL
```

Se cliente paga em qualquer etapa → para mensagens + volta ACTIVE.

## 2. Models + Schema

### 2.1 Model `Empresa` — campos adicionados

```prisma
asaasSubscriptionId  String?  @map("asaas_subscription_id")
billingType          String?  @default("PIX") @map("billing_type")
nextDueDate          DateTime? @map("next_due_date")
```

### 2.2 Model `Subscription` — novo

```prisma
model Subscription {
  id                   Int       @id @default(autoincrement())
  empresaId            Int       @unique @map("empresa_id")
  asaasSubscriptionId  String?   @map("asaas_subscription_id")
  status               String    @default("TRIAL")
  value                Decimal   @default(100) @db.Decimal(10, 2)
  billingType          String    @default("PIX") @map("billing_type")
  nextDueDate          DateTime? @map("next_due_date")
  trialEndsAt          DateTime? @map("trial_ends_at")
  lastPaymentAt        DateTime? @map("last_payment_at")
  canceledAt           DateTime? @map("canceled_at")
  createdAt            DateTime  @default(now()) @map("criado_em")
  updatedAt            DateTime  @updatedAt @map("atualizado_em")
  empresa              Empresa   @relation(fields: [empresaId], references: [id])

  @@map("subscriptions")
}
```

### 2.3 Model `SubscriptionNotification` — novo

```prisma
model SubscriptionNotification {
  id              Int      @id @default(autoincrement())
  empresaId       Int      @map("empresa_id")
  tipo            String
  sentAt          DateTime @default(now()) @map("enviado_em")
  createdAt       DateTime @default(now()) @map("criado_em")

  @@map("subscription_notifications")
}
```

### 2.4 Relación Empresa → Subscription

```prisma
// Adicionar no model Empresa:
subscription    Subscription?
```

### 2.5 Model `PricingConfig` — novo

```prisma
model PricingConfig {
  id              Int      @id @default(autoincrement())
  value           Decimal  @db.Decimal(10, 2)
  effectiveDate   DateTime @map("effective_date")
  status          String   @default("PENDING") // PENDING, ACTIVE, EXPIRED
  notifiedAt      DateTime? @map("notified_at")
  createdAt       DateTime @default(now()) @map("criado_em")
  updatedAt       DateTime  @updatedAt @map("atualizado_em")

  @@map("pricing_configs")
}
```

## 3. API Endpoints

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| `POST` | `/api/webhooks/asaas/subscription` | Webhook Asaas (pagamentos) | None (verifica assinatura Asaas) |
| `POST` | `/api/admin/subscription/create` | Criar assinatura Asaas (após trial) | superadmin |
| `GET` | `/api/admin/subscription/:empresaId` | Buscar assinatura da empresa | superadmin |
| `PUT` | `/api/admin/subscription/:empresaId/status` | Atualizar status manual | superadmin |
| `GET` | `/api/empresa/subscription/status` | Status da própria assinatura | admin only |
| `POST` | `/api/empresa/subscription/pay` | Gerar link de pagamento | admin |
| `DELETE` | `/api/empresa/subscription/cancel` | Cancelar assinatura | admin |

### 3.1 Middleware de verificação de acesso

Executa em todas as rotas autenticadas:
- Se `Subscription.status` ∈ `['SUSPENDED', 'PAST_DUE']` e `nextDueDate` passou → retorna 403
- Se `Subscription.status === 'TRIAL'` e `trialEndsAt` passou → retorna 403
- Se `Subscription.status === 'READ_ONLY'` → permite apenas rotas de leitura

## 4. Frontend

### 4.1 Overlay de suspensão (dashboard.html)

- Aparece uma vez ao logar
- Reaparece ao trocar de usuário
- Texto: "Sua empresa está com pagamento pendente. Regularize para ter acesso novamente a todas as funções. Ficará suspensa apenas para leitura até o pagamento ser confirmado."
- Botão "Gerar link de pagamento" → chama `/api/empresa/subscription/pay`
- Badge "X dias de atraso" + "Juros: 0,02%/dia"

### 4.2 Página 404 (404-subscription.html)

- Mensagem genérica "Página não encontrada"
- Contato WhatsApp da empresa → `https://wa.me/{telefoneEmpresa}` (busca telefone da Empresa pelo slug na URL)
- Empresa identificada pelo slug na URL (ex: `salgadoscosta.empresa.com` → slug = `salgadoscosta`)
- Redirect automático: empresas com `status === 'SUSPENDED'` ou `PAST_DUE` com `nextDueDate` > 10 dias → redirecionam index.html para `404-subscription.html`

### 4.3 Sidebar (dashboard.html)

- Se `Subscription.status === 'READ_ONLY'` → esconde menus de criação (Pedidos, Lançar Pedido, etc.)
- Mantém menus de visualização (Relatórios, Financeiro)

## 5. Notificações + Cron Jobs

### 5.1 Cron job de verificação (diário)

```
todos os dias às 08:00:
  1. Buscar assinaturas com nextDueDate <= hoje + 7 dias
  2. Enviar WhatsApp conforme etapa:
     - 7d antes → lembrete
     - 4d antes → lembrete
     - 0d → aviso juros
     - 3d após → 1º lembrete
     - 5d após → 2º lembrete + read-only
     - 7d após → 3º lembrete
     - 9d Após → 4º lembrete
     - 10d após → aviso final + bloqueio
  3. Se cliente pagou (lastPaymentAt > última notificação) → parar envios
  4. Gravar em SubscriptionNotification para evitar duplicatas
```

### 5.2 Webhook Asaas (POST /api/webhooks/asaas/subscription)

```
evento: PAYMENT_RECEIVED
  → Buscar assinatura por asaasSubscriptionId
  → Atualizar status = ACTIVE
  → Atualizar lastPaymentAt = now()
  → Atualizar nextDueDate = now() + 30 dias
  → Enviar WhatsApp: "Pagamento confirmado! Sua assinatura foi ativada."
  → Atualizar Empresa.status = ATIVA

evento: SUBSCRIPTION_DELETED
  → Atualizar status = CANCELED
  → Enviar WhatsApp: "Assinatura cancelada."
```

### 5.3 Evolution API (WhatsApp)

- Reutiliza integração existente (já tem `whatsappInstances` no schema)
- Função `enviarWhatsApp(telefone, mensagem)` → service compartilhado

## 6. Fluxo completo de criação de assinatura

```
1. Superadmin cadastra empresa → cria customer no Asaas → grava asaasSubcontaId
2. EmpresaCriada → Subscription criada (TRIAL, 14 dias, nextDueDate = now + 14d)
3. Após 14 dias → cron job detecta trial vencido → status = PAST_DUE
4. Empresa loga → overlay de suspensão aparece
5. Empresa clica "Gerar link de pagamento" → backend cria assinatura Asaas
   - billingType = empresa.billingType (PIX padrão)
   - value = R$100
   - nextDueDate = data de hoje
   - cycle = MONTHLY
   - externalReference = empresa.id
6. Cliente paga → webhook Asaas → PAYMENT_RECEIVED
7. Atualiza: Subscription.status = ACTIVE, lastPaymentAt = now, nextDueDate = now + 30d
8. WhatsApp: "Pagamento confirmado! Assinatura ativada."
9. A cada 30 dias → Asaas gera cobrança automaticamente
```

## 7. Escopo + Limites

### Incluído neste spec

- Model Subscription + migração Prisma
- Model PricingConfig + migração Prisma
- Campos adicionais no Empresa
- Backend: service, controller, routes (subscription + webhook + pricing)
- Middleware de verificação de acesso
- Cron job de notificações (diário)
- Cron job de efetivação de preço (diário)
- Frontend: overlay suspensão, página 404, sidebar read-only
- Integração Asaas (assinatura recorrente)
- Integração Evolution API (WhatsApp)
- Dashboard de billing no superadmin
- Relatório de inadimplência
- Cancelamento de assinatura pelo cliente
- Gerenciamento de valor da mensalidade (superadmin)

### 7.1 Dashboard de billing no superadmin

- Aba "Billing" no superadmin.html
- Cards: Total empresas ativas, Empresas em trial, Empresas inadimplentes, Receita mensal
- Tabela: Empresa | Status assinatura | Próximo vencimento | Último pagamento | Ações (ver detalhes)
- Filtros: status (TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELED)

### 7.2 Relatório de inadimplência

- Sub-aba dentro de Billing
- Tabela: Empresa | Dias de atraso | Juros acumulado | Total devido | Último contato | Status
- Filtros: período, dias de atraso
- Exportar CSV

### 7.3 Cancelamento de assinatura pelo cliente

- Botão "Cancelar assinatura" no dashboard do admin da empresa
- Confirmação: "Ao cancelar, sua assinatura será encerrada e o acesso será revogado no final do período pago"
- Backend: atualiza `Subscription.status = CANCELED`, `canceledAt = now`
- Asaas: DELETE `/v3/subscriptions/{id}` (encerra cobranças recorrentes)
- WhatsApp: "Sua assinatura foi cancelada. O acesso será encerrado em {dataFim}"

### 7.4 Gerenciamento de valor da mensalidade (superadmin)

**Model `PricingConfig` — novo:**

```prisma
model PricingConfig {
  id              Int      @id @default(autoincrement())
  value           Decimal  @db.Decimal(10, 2)
  effectiveDate   DateTime @map("effective_date")
  status          String   @default("PENDING") // PENDING, ACTIVE, EXPIRED
  notifiedAt      DateTime? @map("notified_at")
  createdAt       DateTime @default(now()) @map("criado_em")
  updatedAt       DateTime  @updatedAt @map("atualizado_em")

  @@map("pricing_configs")
}
```

**Fluxo:**

```
1. Superadmin acessa aba "Billing" → seção "Configurar Mensalidade"
2. Campo: "Valor da mensalidade" (default R$100)
3. Campo: "Data de efetivação" (date picker, mínimo = hoje + 1 dia)
4. Botão "Salvar alterações"
5. Ao salvar:
   → Cria PricingConfig (value, effectiveDate, status=PENDING)
   → Dispara notificação WhatsApp para todas as empresas ativas:
     - Lote de 5 empresas a cada 4 segundos
     - Mensagem: "Olá! Informamos que haverá alteração no valor da mensalidade do sistema. A partir de {effectiveDate}, o valor será R$ {value}. Qualquer dúvida, entre em contato."
   → Grava notifiedAt = now() em PricingConfig
6. No dia da efetivação:
   → Cron job detecta PricingConfig com effectiveDate = hoje e status = PENDING
   → Atualiza status = ACTIVE
   → Atualiza value de todas as Subscription para o novo valor
   → Atualiza assinaturas Asaas (PUT /v3/subscriptions/{id}) com novo value
```

**Endpoint adicional:**

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| `POST` | `/api/admin/pricing` | Criar nova configuração de preço | superadmin |
| `GET` | `/api/admin/pricing` | Listar configurações de preço | superadmin |
| `GET` | `/api/admin/pricing/current` | Preço vigente | superadmin |

### Não incluído (futuro)

- Mudança de plano (Upgrade/Downgrade)

### Variáveis de ambiente necessárias

- `ASAAS_API_KEY` (já existe)
- `ASAAS_ENVIRONMENT` (sandbox/production)
- `EVOLUTION_API_URL` (já existe)
- `EVOLUTION_API_KEY` (já existe)
