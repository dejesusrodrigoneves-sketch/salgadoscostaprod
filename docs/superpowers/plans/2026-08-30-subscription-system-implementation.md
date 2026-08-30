# Subscription System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ REGRA GLOBAL: NENHUM COMMIT durante implementação. Todas as mudanças ficam uncommitted até ordem explícita do usuário.**

**Goal:** Implement subscription billing system with Asaas recurring payments, WhatsApp notifications, and access control.

**Architecture:** New Prisma models (Subscription, PricingConfig, SubscriptionNotification, PlatformSettings) + Empresa fields. Backend services for Asaas integration, WhatsApp notifications, cron jobs. Frontend overlay/404/sidebar changes. Single-file changes where possible.

**Tech Stack:** Node.js, Prisma, Express, Asaas API, Evolution API (WhatsApp), vanilla JS frontend.

## Global Constraints

- No commits until user requests
- Branch `main` → push to `prod main` remote
- Backend: mixed CJS/ESM (services ESM, routes/controllers CJS)
- Node 22.12+ supports `require()` of ESM
- Prisma schema uses `@@map` for snake_case table names
- Auth stored in `localStorage.authUser` = `{ id, username, role, lojaNome, token, _expiry }`
- Role values: `superadmin`, `admin`, `user`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema.prisma` | Modify | Add Subscription, PricingConfig, SubscriptionNotification, PlatformSettings models + Empresa fields |
| `backend/src/services/subscriptionService.js` | Create | Subscription CRUD, Asaas integration |
| `backend/src/services/pricingService.js` | Create | PricingConfig CRUD, price change notifications |
| `backend/src/services/whatsappNotifyService.js` | Create | WhatsApp notification helper (reuses Evolution API) |
| `backend/src/controllers/subscriptionController.js` | Create | Subscription API handlers |
| `backend/src/controllers/pricingController.js` | Create | Pricing API handlers |
| `backend/src/controllers/webhookAsaasController.js` | Create | Asaas webhook handler |
| `backend/src/routes/subscriptionRoutes.js` | Create | Subscription + webhook routes |
| `backend/src/routes/pricingRoutes.js` | Create | Pricing routes |
| `backend/src/middleware/subscriptionGuard.js` | Create | Access control middleware |
| `backend/src/cron/subscriptionCron.js` | Create | Daily notification + price effective date cron |
| `superadmin.html` | Modify | Add Billing tab |
| `js/superadminBilling.js` | Create | Billing dashboard frontend |
| `dashboard.html` | Modify | Add overlay suspension + sidebar read-only |
| `404-subscription.html` | Create | 404 page for delinquent companies |
| `js/subscriptionOverlay.js` | Create | Overlay suspension logic |

---

### Task 1: Prisma Schema — Models + Empresa Fields

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Subscription, PricingConfig, SubscriptionNotification models + Empresa subscription fields

- [ ] **Step 1: Add Empresa subscription fields**

Add after `asaasCreatedAt` in model Empresa:

```prisma
  asaasSubscriptionId  String?  @map("asaas_subscription_id")
  billingType          String?  @default("PIX") @map("billing_type")
  nextDueDate          DateTime? @map("next_due_date")
  whatsappNumber       String?  @map("whatsapp_number")
  subscription         Subscription?
```

- [ ] **Step 2: Add Subscription model**

Add before `@@map("empresas")` closing:

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

- [ ] **Step 3: Add PricingConfig model**

```prisma
model PricingConfig {
  id              Int      @id @default(autoincrement())
  value           Decimal  @db.Decimal(10, 2)
  effectiveDate   DateTime @map("effective_date")
  status          String   @default("PENDING")
  notifiedAt      DateTime? @map("notified_at")
  createdAt       DateTime @default(now()) @map("criado_em")
  updatedAt       DateTime  @updatedAt @map("atualizado_em")

  @@map("pricing_configs")
}
```

- [ ] **Step 4: Add SubscriptionNotification model**

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

- [ ] **Step 5: Add PlatformSettings model**

Global config store (support WhatsApp number, pricing defaults, etc).

```prisma
model PlatformSettings {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     String
  createdAt DateTime @default(now()) @map("criado_em")
  updatedAt DateTime @updatedAt @map("atualizado_em")

  @@map("platform_settings")
}
```

- [ ] **Step 6: Run Prisma migrate**

Run: `cd backend && npx prisma migrate dev --name add_subscription_system`
Expected: Migration created successfully

- [ ] **Step 7: Verify schema compiles**

Run: `cd backend && npx prisma generate`
Expected: Client generated successfully

---

### Task 2: WhatsApp Notification Service

**Files:**
- Create: `backend/src/services/whatsappNotifyService.js`

**Interfaces:**
- Consumes: Evolution API config (existing)
- Produces: `enviarWhatsApp(telefone, mensagem)` function

- [ ] **Step 1: Create service file**

```javascript
// backend/src/services/whatsappNotifyService.js (ESM)
import prisma from '../config/prisma.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

/**
 * Get platform support WhatsApp number from PlatformSettings.
 * Used as fallback on 404 page and for platform-level notifications.
 */
export async function getSupportWhatsApp() {
  const setting = await prisma.platformSettings.findUnique({
    where: { key: 'support_whatsapp' }
  });
  return setting?.value || null;
}

/**
 * Get empresa-specific WhatsApp number.
 * Falls back to PlatformSettings.support_whatsapp if empresa has none.
 */
export async function getEmpresaWhatsApp(empresaId) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { telefone: true, whatsappNumber: true }
  });
  
  if (empresa?.whatsappNumber) return empresa.whatsappNumber;
  if (empresa?.telefone) return empresa.telefone;
  
  return getSupportWhatsApp();
}

export async function enviarWhatsApp(telefone, mensagem) {
  if (!telefone || !mensagem) return false;
  
  // Find active WhatsApp instance
  const instance = await prisma.whatsappInstance.findFirst({
    where: { connectionStatus: 'open' }
  });
  
  if (!instance) {
    console.warn('[WhatsApp] Nenhuma instância ativa encontrada');
    return false;
  }

  try {
    const cleanPhone = telefone.replace(/\D/g, '');
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: mensagem
      })
    });
    
    if (!response.ok) {
      console.error('[WhatsApp] Erro ao enviar:', response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[WhatsApp] Erro:', error.message);
    return false;
  }
}

export async function enviarWhatsAppLote(telefones, mensagem, delayMs = 4000, loteSize = 5) {
  let enviados = 0;
  
  for (let i = 0; i < telefones.length; i += loteSize) {
    const lote = telefones.slice(i, i + loteSize);
    
    await Promise.allSettled(
      lote.map(async (tel) => {
        const success = await enviarWhatsApp(tel, mensagem);
        if (success) enviados++;
      })
    );
    
    // Wait between batches
    if (i + loteSize < telefones.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return enviados;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "import('./backend/src/services/whatsappNotifyService.js').then(() => console.log('OK'))"`
Expected: OK

---

### Task 3: Subscription Service

**Files:**
- Create: `backend/src/services/subscriptionService.js`

**Interfaces:**
- Consumes: prisma, whatsappNotifyService
- Produces: getSubscription, createTrial, updateStatus, getSubscriptionByEmpresaId

- [ ] **Step 1: Create service file**

```javascript
// backend/src/services/subscriptionService.js (ESM)
import prisma from '../config/prisma.js';
import { enviarWhatsApp, getEmpresaWhatsApp } from './whatsappNotifyService.js';

const TRIAL_DAYS = 14;
const INTEREST_RATE_DAILY = 0.0002; // 0.02%
const READ_ONLY_AFTER_DAYS = 5;
const BLOCK_AFTER_DAYS = 10;

export async function createTrialSubscription(empresaId) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  
  return prisma.subscription.create({
    data: {
      empresaId,
      status: 'TRIAL',
      value: 100,
      billingType: 'PIX',
      nextDueDate: trialEndsAt,
      trialEndsAt
    }
  });
}

export async function getSubscriptionByEmpresaId(empresaId) {
  return prisma.subscription.findUnique({
    where: { empresaId }
  });
}

export async function updateSubscriptionStatus(empresaId, status) {
  return prisma.subscription.update({
    where: { empresaId },
    data: { status }
  });
}

export async function processPayment(empresaId) {
  const subscription = await getSubscriptionByEmpresaId(empresaId);
  if (!subscription) return null;
  
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 30);
  
  const updated = await prisma.subscription.update({
    where: { empresaId },
    data: {
      status: 'ACTIVE',
      lastPaymentAt: new Date(),
      nextDueDate
    }
  });
  
  // Notify via WhatsApp
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  const phone = await getEmpresaWhatsApp(empresaId);
  if (phone) {
    await enviarWhatsApp(
      phone,
      'Pagamento confirmado! Sua assinatura foi ativada. Próxima cobrança em 30 dias.'
    );
  }
  
  return updated;
}

export async function cancelSubscription(empresaId) {
  const subscription = await getSubscriptionByEmpresaId(empresaId);
  if (!subscription) return null;
  
  const updated = await prisma.subscription.update({
    where: { empresaId },
    data: {
      status: 'CANCELED',
      canceledAt: new Date()
    }
  });
  
  // Notify via WhatsApp
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  const phone = await getEmpresaWhatsApp(empresaId);
  if (phone) {
    await enviarWhatsApp(
      phone,
      'Sua assinatura foi cancelada. O acesso será encerrado no final do período pago.'
    );
  }
  
  return updated;
}

export function calculateInterest(amount, daysOverdue) {
  return amount * INTEREST_RATE_DAILY * daysOverdue;
}

export function getDaysOverdue(nextDueDate) {
  if (!nextDueDate) return 0;
  const now = new Date();
  const due = new Date(nextDueDate);
  if (now <= due) return 0;
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

export function getAccessLevel(subscription) {
  if (!subscription) return 'BLOCKED';
  
  const daysOverdue = getDaysOverdue(subscription.nextDueDate);
  
  switch (subscription.status) {
    case 'TRIAL':
      return trialEndsAt > new Date() ? 'FULL' : 'BLOCKED';
    case 'ACTIVE':
      return 'FULL';
    case 'PAST_DUE':
      return daysOverdue >= READ_ONLY_AFTER_DAYS ? 'READ_ONLY' : 'FULL';
    case 'SUSPENDED':
      return 'BLOCKED';
    case 'CANCELED':
      return 'BLOCKED';
    default:
      return 'BLOCKED';
  }
}
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "import('./backend/src/services/subscriptionService.js').then(() => console.log('OK'))"`
Expected: OK

---

### Task 4: Pricing Service

**Files:**
- Create: `backend/src/services/pricingService.js`

**Interfaces:**
- Consumes: prisma, whatsappNotifyService
- Produces: createPricingConfig, getCurrentPricing, applyPricing

- [ ] **Step 1: Create service file**

```javascript
// backend/src/services/pricingService.js (ESM)
import prisma from '../config/prisma.js';
import { enviarWhatsAppLote } from './whatsappNotifyService.js';

export async function createPricingConfig(value, effectiveDate) {
  return prisma.pricingConfig.create({
    data: {
      value,
      effectiveDate: new Date(effectiveDate),
      status: 'PENDING'
    }
  });
}

export async function getCurrentPricing() {
  return prisma.pricingConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPricingHistory() {
  return prisma.pricingConfig.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function notifyPriceChange(pricingConfig) {
  const empresas = await prisma.empresa.findMany({
    where: { deletedAt: null },
    select: { telefone: true, whatsappNumber: true, nome: true }
  });
  
  const telefones = empresas
    .map(e => e.whatsappNumber || e.telefone)
    .filter(Boolean);
  
  const effectiveDate = new Date(pricingConfig.effectiveDate).toLocaleDateString('pt-BR');
  const message = `Olá! Informamos que haverá alteração no valor da mensalidade do sistema. A partir de ${effectiveDate}, o valor será R$ ${pricingConfig.value}. Qualquer dúvida, entre em contato.`;
  
  const enviados = await enviarWhatsAppLote(telefones, message, 4000, 5);
  
  await prisma.pricingConfig.update({
    where: { id: pricingConfig.id },
    data: { notifiedAt: new Date() }
  });
  
  return { total: telefones.length, enviados };
}

export async function applyPricing(pricingConfigId) {
  const config = await prisma.pricingConfig.findUnique({
    where: { id: pricingConfigId }
  });
  
  if (!config || config.status !== 'PENDING') return null;
  
  // Update all subscriptions
  await prisma.subscription.updateMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    data: { value: config.value }
  });
  
  // Mark config as active
  await prisma.pricingConfig.update({
    where: { id: pricingConfigId },
    data: { status: 'ACTIVE' }
  });
  
  // Mark previous configs as expired
  await prisma.pricingConfig.updateMany({
    where: {
      id: { not: pricingConfigId },
      status: 'ACTIVE'
    },
    data: { status: 'EXPIRED' }
  });
  
  return config;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "import('./backend/src/services/pricingService.js').then(() => console.log('OK'))"`
Expected: OK

---

### Task 5: Subscription Controller

**Files:**
- Create: `backend/src/controllers/subscriptionController.js`

**Interfaces:**
- Consumes: subscriptionService
- Produces: Express route handlers

- [ ] **Step 1: Create controller file**

```javascript
// backend/src/controllers/subscriptionController.js (CJS)
const subscriptionService = require('../services/subscriptionService.js');

async function getSubscriptionController(req, res) {
  try {
    const { empresaId } = req.params;
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(parseInt(empresaId));
    if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada' });
    res.json(subscription);
  } catch (e) {
    console.error('Subscription get error:', e);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

async function getMySubscriptionController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });
    
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(empresaId);
    if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada' });
    
    const daysOverdue = subscriptionService.getDaysOverdue(subscription.nextDueDate);
    const interest = subscriptionService.calculateInterest(subscription.value, daysOverdue);
    const accessLevel = subscriptionService.getAccessLevel(subscription);
    
    res.json({
      ...subscription,
      daysOverdue,
      interest,
      accessLevel,
      totalDue: Number(subscription.value) + interest
    });
  } catch (e) {
    console.error('Subscription get error:', e);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

async function createSubscriptionController(req, res) {
  try {
    const { empresaId } = req.params;
    const subscription = await subscriptionService.createTrialSubscription(parseInt(empresaId));
    res.status(201).json(subscription);
  } catch (e) {
    console.error('Subscription create error:', e);
    res.status(500).json({ error: 'Erro ao criar assinatura' });
  }
}

async function updateStatusController(req, res) {
  try {
    const { empresaId } = req.params;
    const { status } = req.body;
    const subscription = await subscriptionService.updateSubscriptionStatus(parseInt(empresaId), status);
    res.json(subscription);
  } catch (e) {
    console.error('Subscription update error:', e);
    res.status(500).json({ error: 'Erro ao atualizar assinatura' });
  }
}

async function payController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });
    
    const empresa = await require('../config/prisma.js').default.empresa.findUnique({
      where: { id: empresaId }
    });
    
    if (!empresa?.asaasSubcontaId) {
      return res.status(400).json({ error: 'Cliente Asaas não cadastrado' });
    }
    
    // Create Asaas subscription here (Task 8 will implement full Asaas integration)
    // For now, return a placeholder
    res.json({ 
      message: 'Link de pagamento gerado',
      empresaId,
      asaasCustomerId: empresa.asaasSubcontaId
    });
  } catch (e) {
    console.error('Subscription pay error:', e);
    res.status(500).json({ error: 'Erro ao gerar pagamento' });
  }
}

async function cancelController(req, res) {
  try {
    const empresaId = req.user.empresaId || req.user.empresa?.id;
    if (!empresaId) return res.status(400).json({ error: 'Empresa não identificada' });
    
    const subscription = await subscriptionService.cancelSubscription(empresaId);
    res.json({ message: 'Assinatura cancelada', subscription });
  } catch (e) {
    console.error('Subscription cancel error:', e);
    res.status(500).json({ error: 'Erro ao cancelar assinatura' });
  }
}

module.exports = {
  getSubscriptionController,
  getMySubscriptionController,
  createSubscriptionController,
  updateStatusController,
  payController,
  cancelController
};
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "require('./backend/src/controllers/subscriptionController.js')"`
Expected: No error

---

### Task 6: Pricing Controller

**Files:**
- Create: `backend/src/controllers/pricingController.js`

**Interfaces:**
- Consumes: pricingService
- Produces: Express route handlers

- [ ] **Step 1: Create controller file**

```javascript
// backend/src/controllers/pricingController.js (CJS)
const pricingService = require('../services/pricingService.js');

async function createPricingController(req, res) {
  try {
    const { value, effectiveDate } = req.body;
    if (!value || !effectiveDate) {
      return res.status(400).json({ error: 'Valor e data de efetivação são obrigatórios' });
    }
    
    const config = await pricingService.createPricingConfig(value, effectiveDate);
    
    // Notify all companies
    const notifyResult = await pricingService.notifyPriceChange(config);
    
    res.status(201).json({ 
      config,
      notifications: notifyResult
    });
  } catch (e) {
    console.error('Pricing create error:', e);
    res.status(500).json({ error: 'Erro ao criar configuração de preço' });
  }
}

async function getPricingController(req, res) {
  try {
    const history = await pricingService.getPricingHistory();
    res.json(history);
  } catch (e) {
    console.error('Pricing get error:', e);
    res.status(500).json({ error: 'Erro ao buscar preços' });
  }
}

async function getCurrentPricingController(req, res) {
  try {
    const current = await pricingService.getCurrentPricing();
    res.json(current || { value: 100, status: 'DEFAULT' });
  } catch (e) {
    console.error('Pricing current error:', e);
    res.status(500).json({ error: 'Erro ao buscar preço vigente' });
  }
}

module.exports = {
  createPricingController,
  getPricingController,
  getCurrentPricingController
};
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "require('./backend/src/controllers/pricingController.js')"`
Expected: No error

---

### Task 7: Subscription Guard Middleware

**Files:**
- Create: `backend/src/middleware/subscriptionGuard.js`

**Interfaces:**
- Consumes: subscriptionService
- Produces: Express middleware

- [ ] **Step 1: Create middleware file**

```javascript
// backend/src/middleware/subscriptionGuard.js (CJS')
const subscriptionService = require('../services/subscriptionService.js');

async function subscriptionGuard(req, res, next) {
  try {
    // Skip for superadmin
    if (req.user?.role === 'superadmin') return next();
    
    const empresaId = req.user?.empresaId || req.user?.empresa?.id;
    if (!empresaId) return next();
    
    const subscription = await subscriptionService.getSubscriptionByEmpresaId(empresaId);
    if (!subscription) return next();
    
    const accessLevel = subscriptionService.getAccessLevel(subscription);
    
    if (accessLevel === 'BLOCKED') {
      return res.status(403).json({ 
        error: 'Assinatura inativa',
        message: 'Sua empresa está com pagamento pendente. Regularize para ter acesso.',
        subscriptionStatus: subscription.status
      });
    }
    
    if (accessLevel === 'READ_ONLY') {
      // Allow only GET requests
      if (req.method !== 'GET') {
        return res.status(403).json({ 
          error: 'Acesso somente leitura',
          message: 'Sua empresa está com pagamento pendente. Acesso limitado a consulta.',
          subscriptionStatus: subscription.status
        });
      }
    }
    
    // Add subscription info to request
    req.subscription = subscription;
    req.accessLevel = accessLevel;
    
    next();
  } catch (error) {
    console.error('Subscription guard error:', error);
    next(); // Don't block on error
  }
}

module.exports = { subscriptionGuard };
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "require('./backend/src/middleware/subscriptionGuard.js')"`
Expected: No error

---

### Task 8: Subscription Routes

**Files:**
- Create: `backend/src/routes/subscriptionRoutes.js`

**Interfaces:**
- Consumes: subscriptionController, subscriptionGuard
- Produces: Express router

- [ ] **Step 1: Create routes file**

```javascript
// backend/src/routes/subscriptionRoutes.js (CJS)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth.js');
const { subscriptionGuard } = require('../middleware/subscriptionGuard.js');
const {
  getSubscriptionController,
  getMySubscriptionController,
  createSubscriptionController,
  updateStatusController,
  payController,
  cancelController
} = require('../controllers/subscriptionController.js');

const router = Router();

// Admin routes (superadmin)
router.get('/admin/subscription/:empresaId', authenticate, authorize('superadmin'), getSubscriptionController);
router.post('/admin/subscription/:empresaId', authenticate, authorize('superadmin'), createSubscriptionController);
router.put('/admin/subscription/:empresaId/status', authenticate, authorize('superadmin'), updateStatusController);

// Empresa routes (admin only)
router.get('/empresa/subscription/status', authenticate, authorize('admin'), subscriptionGuard, getMySubscriptionController);
router.post('/empresa/subscription/pay', authenticate, authorize('admin'), subscriptionGuard, payController);
router.delete('/empresa/subscription/cancel', authenticate, authorize('admin'), subscriptionGuard, cancelController);

module.exports = router;
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "require('./backend/src/routes/subscriptionRoutes.js')"`
Expected: No error

---

### Task 9: Pricing Routes

**Files:**
- Create: `backend/src/routes/pricingRoutes.js`

**Interfaces:**
- Consumes: pricingController
- Produces: Express router

- [ ] **Step 1: Create routes file**

```javascript
// backend/src/routes/pricingRoutes.js (CJS)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth.js');
const {
  createPricingController,
  getPricingController,
  getCurrentPricingController
} = require('../controllers/pricingController.js');

const router = Router();

router.post('/admin/pricing', authenticate, authorize('superadmin'), createPricingController);
router.get('/admin/pricing', authenticate, authorize('superadmin'), getPricingController);
router.get('/admin/pricing/current', authenticate, authorize('superadmin'), getCurrentPricingController);

module.exports = router;
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "require('./backend/src/routes/pricingRoutes.js')"`
Expected: No error

---

### Task 10: Mount Routes in app.js

**Files:**
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: subscriptionRoutes, pricingRoutes
- Produces: Mounted routes

- [ ] **Step 1: Add require statements**

After existing route requires, add:

```javascript
const subscriptionRoutes = require('./routes/subscriptionRoutes.js');
const pricingRoutes = require('./routes/pricingRoutes.js');
```

- [ ] **Step 2: Mount routes**

After existing route mounts, add:

```javascript
app.use('/api', subscriptionRoutes);
app.use('/api', pricingRoutes);
```

- [ ] **Step 3: Verify app.js compiles**

Run: `node -e "require('./backend/src/app.js')"`
Expected: No error

---

### Task 11: Subscription Cron Jobs

**Files:**
- Create: `backend/src/cron/subscriptionCron.js`

**Interfaces:**
- Consumes: subscriptionService, pricingService, prisma
- Produces: Cron job functions

- [ ] **Step 1: Create cron file**

```javascript
// backend/src/cron/subscriptionCron.js (ESM)
import prisma from '../config/prisma.js';
import { enviarWhatsApp, getEmpresaWhatsApp } from '../services/whatsappNotifyService.js';

const NOTIFICATION_TYPES = {
  7: '7d_antes',
  4: '4d_antes',
  0: 'vencimento',
  3: '3d_apos',
  5: '5d_apos',
  7: '7d_apos',
  9: '9d_apos',
  10: '10d_apos'
};

const MESSAGES = {
  7: (nome) => `Olá ${nome}! Faltam 7 dias para vencimento da sua assinatura. Mantenha seu pagamento em dia.`,
  4: (nome) => `Olá ${nome}! Faltam 4 dias para vencimento da sua assinatura. Não esqueça de regularizar.`,
  0: (nome) => `Olá ${nome}! Sua assinatura vence hoje. O não pagamento acarretará juros de 0,02% ao dia.`,
  3: (nome) => `Olá ${nome}! Sua assinatura está com 3 dias de atraso. Regularize para evitar juros.`,
  5: (nome) => `Olá ${nome}! Sua assinatura está com 5 dias de atraso. Acesso será limitado a leitura.`,
  7: (nome) => `Olá ${nome}! Sua assinatura está com 7 dias de atraso. Acesso已被 restringido.`,
  9: (nome) => `Olá ${nome}! Sua assinatura está com 9 dias de atraso. Último aviso antes do bloqueio.`,
  10: (nome) => `Olá ${nome}! Sua assinatura está com 10 dias de atraso. Acesso已被 bloqueado. Regularize para reativar.`
};

export async function runSubscriptionCron() {
  console.log('[Subscription Cron] Iniciando verificação...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Find subscriptions that need notifications
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      nextDueDate: { not: null }
    },
    include: { empresa: true }
  });
  
  let notificationsSent = 0;
  
  for (const sub of subscriptions) {
    const phone = await getEmpresaWhatsApp(sub.empresaId);
    if (!phone) continue;
    
    const dueDate = new Date(sub.nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
    
    // Check if should notify
    let notificationDay = null;
    if (diffDays === 7) notificationDay = 7;
    else if (diffDays === 4) notificationDay = 4;
    else if (diffDays === 0) notificationDay = 0;
    else if (diffDays === -3) notificationDay = 3;
    else if (diffDays === -5) notificationDay = 5;
    else if (diffDays === -7) notificationDay = 7;
    else if (diffDays === -9) notificationDay = 9;
    else if (diffDays === -10) notificationDay = 10;
    
    if (notificationDay === null) continue;
    
    // Check if already notified today
    const alreadyNotified = await prisma.subscriptionNotification.findFirst({
      where: {
        empresaId: sub.empresaId,
        tipo: NOTIFICATION_TYPES[notificationDay],
        sentAt: {
          gte: new Date(today.toISOString().split('T')[0])
        }
      }
    });
    
    if (alreadyNotified) continue;
    
    // Check if paid after last notification
    if (sub.lastPaymentAt && sub.lastPaymentAt > sub.nextDueDate) continue;
    
    // Send notification
    const message = MESSAGES[notificationDay](sub.empresa.nome);
    const sent = await enviarWhatsApp(phone, message);
    
    if (sent) {
      await prisma.subscriptionNotification.create({
        data: {
          empresaId: sub.empresaId,
          tipo: NOTIFICATION_TYPES[notificationDay]
        }
      });
      notificationsSent++;
    }
    
    // Update status to PAST_DUE if overdue
    if (diffDays < 0 && sub.status === 'ACTIVE') {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE' }
      });
    }
    
    // Block after 10 days
    if (diffDays <= -10 && sub.status !== 'SUSPENDED') {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'SUSPENDED' }
      });
    }
  }
  
  console.log(`[Subscription Cron] ${notificationsSent} notificações enviadas`);
}

export async function runPricingCron() {
  console.log('[Pricing Cron] Verificando efetivação de preços...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pendingConfigs = await prisma.pricingConfig.findMany({
    where: {
      status: 'PENDING',
      effectiveDate: { lte: today }
    }
  });
  
  for (const config of pendingConfigs) {
    // Update all subscriptions
    await prisma.subscription.updateMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      data: { value: config.value }
    });
    
    // Mark config as active
    await prisma.pricingConfig.update({
      where: { id: config.id },
      data: { status: 'ACTIVE' }
    });
    
    // Mark previous configs as expired
    await prisma.pricingConfig.updateMany({
      where: {
        id: { not: config.id },
        status: 'ACTIVE'
      },
      data: { status: 'EXPIRED' }
    });
    
    console.log(`[Pricing Cron] Preço atualizado para R$ ${config.value}`);
  }
}
```

- [ ] **Step 2: Verify file compiles**

Run: `node -e "import('./backend/src/cron/subscriptionCron.js').then(() => console.log('OK'))"`
Expected: OK

---

### Task 12: 404 Subscription Page

**Files:**
- Create: `404-subscription.html`

**Interfaces:**
- Consumes: slug from URL query param
- Produces: 404 page with WhatsApp contact

- [ ] **Step 1: Create HTML file**

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página não encontrada</title>
  <link rel="stylesheet" href="css/tokens.css">
  <style>
    body {
      background: var(--secondary, #0E100F);
      color: var(--text, #FFFCE1);
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 500px;
    }
    .error-code {
      font-size: 120px;
      font-weight: 800;
      color: var(--primary, #F26D3D);
      line-height: 1;
      margin-bottom: 20px;
    }
    .error-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .error-message {
      font-size: 16px;
      color: var(--text-muted, #7C7C6F);
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .whatsapp-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 28px;
      background: #25D366;
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .whatsapp-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(37, 211, 102, 0.3);
    }
    .whatsapp-btn i {
      font-size: 20px;
    }
    .company-name {
      font-size: 14px;
      color: var(--text-muted, #7C7C6F);
      margin-top: 20px;
    }
  </style>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body>
  <div class="container">
    <div class="error-code">404</div>
    <h1 class="error-title">Página não encontrada</h1>
    <p class="error-message">
      Esta página não está disponível no momento.<br>
      Entre em contato com o suporte para mais informações.
    </p>
    <a id="whatsappLink" href="#" class="whatsapp-btn" target="_blank">
      <i class="fab fa-whatsapp"></i>
      Contatar Suporte
    </a>
    <p id="companyName" class="company-name"></p>
  </div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    if (slug) {
      fetch(`/api/empresa/${slug}/contact`)
        .then(r => r.json())
        .then(data => {
          const phone = data.telefone || data.supportWhatsApp;
          if (phone) {
            const clean = phone.replace(/\D/g, '');
            document.getElementById('whatsappLink').href = `https://wa.me/55${clean}`;
            document.getElementById('companyName').textContent = data.nome || '';
          }
        })
        .catch(() => {});
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify HTML syntax**

Open in browser or use HTML validator.

---

### Task 13: Subscription Overlay Script

**Files:**
- Create: `js/subscriptionOverlay.js`

**Interfaces:**
- Consumes: authUser from localStorage
- Produces: Overlay DOM element

- [ ] **Step 1: Create JS file**

```javascript
// js/subscriptionOverlay.js
(function() {
  const OVERLAY_KEY = 'subscriptionOverlayDismissed';
  const USER_KEY = 'lastOverlayUser';
  
  function getAuthUser() {
    try {
      return JSON.parse(localStorage.getItem('authUser') || '{}');
    } catch { return {}; }
  }
  
  function shouldShowOverlay() {
    const authUser = getAuthUser();
    const currentUsername = authUser.username;
    const lastUser = localStorage.getItem(USER_KEY);
    
    // Show if user changed
    if (currentUsername !== lastUser) {
      localStorage.removeItem(OVERLAY_KEY);
      localStorage.setItem(USER_KEY, currentUsername);
      return true;
    }
    
    // Show if not dismissed
    return !localStorage.getItem(OVERLAY_KEY);
  }
  
  async function checkSubscriptionAndShowOverlay() {
    const authUser = getAuthUser();
    if (!authUser.token || authUser.role === 'superadmin') return;
    
    try {
      const res = await fetch('/api/empresa/subscription/status', {
        headers: { 'Authorization': 'Bearer ' + authUser.token }
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      
      if (data.status === 'PAST_DUE' || data.status === 'SUSPENDED') {
        if (shouldShowOverlay()) {
          showOverlay(data);
        }
      }
    } catch (e) {
      console.error('Subscription overlay error:', e);
    }
  }
  
  function showOverlay(subscription) {
    const daysOverdue = subscription.daysOverdue || 0;
    const interest = subscription.interest || 0;
    const totalDue = subscription.totalDue || subscription.value;
    
    const overlay = document.createElement('div');
    overlay.id = 'subscriptionOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: #191919;
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 100%;
        text-align: center;
        border: 1px solid #2a2a2a;
      ">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2 style="color: #FFFCE1; font-size: 20px; margin-bottom: 16px;">
          Pagamento Pendente
        </h2>
        <p style="color: #7C7C6F; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          Sua empresa está com pagamento pendente. Regularize para ter acesso novamente a todas as funções.
          Ficará suspensa apenas para leitura até o pagamento ser confirmado.
        </p>
        ${daysOverdue > 0 ? `
          <div style="
            background: rgba(242, 109, 61, 0.1);
            border: 1px solid rgba(242, 109, 61, 0.3);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
          ">
            <div style="color: #F26D3D; font-weight: 700; font-size: 14px;">
              ${daysOverdue} dias de atraso
            </div>
            <div style="color: #7C7C6F; font-size: 12px; margin-top: 4px;">
              Juros: R$ ${interest.toFixed(2)} (0,02%/dia)
            </div>
            <div style="color: #FFFCE1; font-weight: 700; font-size: 16px; margin-top: 8px;">
              Total: R$ ${totalDue.toFixed(2)}
            </div>
          </div>
        ` : ''}
        <button id="payNowBtn" style="
          background: #F26D3D;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
          margin-bottom: 12px;
        ">
          Gerar Link de Pagamento
        </button>
        <button id="dismissOverlayBtn" style="
          background: transparent;
          color: #7C7C6F;
          border: 1px solid #333;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          width: 100%;
        ">
          Fechar
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('payNowBtn').addEventListener('click', async () => {
      try {
        const authUser = getAuthUser();
        const res = await fetch('/api/empresa/subscription/pay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authUser.token
          }
        });
        
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } catch (e) {
        console.error('Pay error:', e);
      }
    });
    
    document.getElementById('dismissOverlayBtn').addEventListener('click', () => {
      overlay.remove();
      localStorage.setItem(OVERLAY_KEY, 'true');
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        localStorage.setItem(OVERLAY_KEY, 'true');
      }
    });
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkSubscriptionAndShowOverlay);
  } else {
    checkSubscriptionAndShowOverlay();
  }
})();
```

- [ ] **Step 2: Verify file syntax**

Run: `node --check js/subscriptionOverlay.js`
Expected: No error

---

### Task 14: Dashboard.html Changes (Overlay + Sidebar)

**Files:**
- Modify: `dashboard.html`

**Interfaces:**
- Consumes: subscriptionOverlay.js
- Produces: Modified dashboard with overlay + sidebar read-only

- [ ] **Step 1: Add overlay script**

Before closing `</body>`, add:

```html
<script src="js/subscriptionOverlay.js"></script>
```

- [ ] **Step 2: Modify sidebar for read-only mode**

In the `renderMenu()` function, add check for read-only:

```javascript
// After role check, add subscription status check
let subscriptionStatus = 'ACTIVE';
try {
  const subRes = await fetch('/api/empresa/subscription/status', {
    headers: { 'Authorization': 'Bearer ' + authUser.token }
  });
  if (subRes.ok) {
    const subData = await subRes.json();
    subscriptionStatus = subData.status;
  }
} catch (e) {}
```

- [ ] **Step 3: Hide creation menus if read-only**

In menuSections building, wrap creation items:

```javascript
if (subscriptionStatus !== 'SUSPENDED' && subscriptionStatus !== 'PAST_DUE') {
  // Show all menus
} else {
  // Only show read-only menus
}
```

- [ ] **Step 4: Verify changes**

Open dashboard.html in browser, check sidebar renders correctly.

---

### Task 15: Superadmin Billing Tab

**Files:**
- Modify: `superadmin.html`
- Create: `js/superadminBilling.js`

**Interfaces:**
- Consumes: subscription API, pricing API
- Produces: Billing dashboard UI

- [ ] **Step 1: Add Billing tab to superadmin.html**

In the tabs section, add:

```html
<button class="tab" onclick="switchTab('billing',this)"><i class="fas fa-credit-card"></i> Billing</button>
```

- [ ] **Step 2: Add tab content**

After the Dashboard tab content, add:

```html
<!-- Billing tab -->
<div class="tab-content" id="tabBilling">
  <div class="dash-cards" id="billingCards"></div>
  <div class="dash-table-card">
    <h3><i class="fas fa-credit-card"></i> Assinaturas</h3>
    <table class="dash-table">
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Status</th>
          <th>Próximo Vencimento</th>
          <th>Último Pagamento</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody id="billingTableBody"></tbody>
    </table>
  </div>
  <div class="dash-table-card" style="margin-top: 24px;">
    <h3><i class="fas fa-dollar-sign"></i> Configurar Mensalidade</h3>
    <div style="display: flex; gap: 16px; align-items: end;">
      <div>
        <label style="font-size: 12px; color: #7C7C6F;">Valor (R$)</label>
        <input type="number" id="pricingValue" value="100" step="0.01" style="
          padding: 10px; border: 1px solid #333; border-radius: 8px;
          background: #111; color: #FFFCE1; font-size: 14px; width: 150px;
        ">
      </div>
      <div>
        <label style="font-size: 12px; color: #7C7C6F;">Data de Efetivação</label>
        <input type="date" id="pricingDate" style="
          padding: 10px; border: 1px solid #333; border-radius: 8px;
          background: #111; color: #FFFCE1; font-size: 14px;
        ">
      </div>
      <button onclick="savePricing()" style="
        padding: 10px 20px; background: #F26D3D; color: white;
        border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
      ">
        Salvar Alterações
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Create superadminBilling.js**

```javascript
// js/superadminBilling.js
(function() {
  const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';
  
  function getToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('authUser'));
      return auth?.token;
    } catch { return null; }
  }
  
  async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...options.headers
      }
    });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }
  
  async function loadBillingDashboard() {
    try {
      // Load subscriptions
      const subs = await apiFetch('/api/admin/subscription/list');
      
      // Calculate stats
      const stats = {
        total: subs.length,
        active: subs.filter(s => s.status === 'ACTIVE').length,
        trial: subs.filter(s => s.status === 'TRIAL').length,
        delinquent: subs.filter(s => ['PAST_DUE', 'SUSPENDED'].includes(s.status)).length,
        revenue: subs.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + Number(s.value), 0)
      };
      
      // Render cards
      document.getElementById('billingCards').innerHTML = `
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-building"></i></div>
          <div class="dash-card-value">${stats.total}</div>
          <div class="dash-card-label">TOTAL EMPRESAS</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-check-circle"></i></div>
          <div class="dash-card-value">${stats.active}</div>
          <div class="dash-card-label">ATIVAS</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-clock"></i></div>
          <div class="dash-card-value">${stats.trial}</div>
          <div class="dash-card-label">EM TRIAL</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="dash-card-value">${stats.delinquent}</div>
          <div class="dash-card-label">INADIMPLENTES</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-dollar-sign"></i></div>
          <div class="dash-card-value">R$ ${stats.revenue.toLocaleString('pt-BR')}</div>
          <div class="dash-card-label">RECEITA MENSAL</div>
        </div>
      `;
      
      // Render table
      const tbody = document.getElementById('billingTableBody');
      tbody.innerHTML = subs.map(sub => `
        <tr>
          <td>${sub.empresa?.nome || 'ID ' + sub.empresaId}</td>
          <td><span class="status-badge status-${sub.status.toLowerCase()}">${sub.status}</span></td>
          <td>${sub.nextDueDate ? new Date(sub.nextDueDate).toLocaleDateString('pt-BR') : '-'}</td>
          <td>${sub.lastPaymentAt ? new Date(sub.lastPaymentAt).toLocaleDateString('pt-BR') : '-'}</td>
          <td>
            <button onclick="viewSubscription(${sub.empresaId})" style="
              padding: 6px 12px; background: #F26D3D; color: white;
              border: none; border-radius: 6px; cursor: pointer; font-size: 12px;
            ">Ver</button>
          </td>
        </tr>
      `).join('');
      
    } catch (e) {
      console.error('Billing load error:', e);
    }
  }
  
  window.savePricing = async function() {
    const value = parseFloat(document.getElementById('pricingValue').value);
    const date = document.getElementById('pricingDate').value;
    
    if (!value || !date) {
      alert('Preencha valor e data');
      return;
    }
    
    try {
      await apiFetch('/api/admin/pricing', {
        method: 'POST',
        body: JSON.stringify({ value, effectiveDate: date })
      });
      alert('Configuração salva e notificações enviadas!');
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    }
  };
  
  window.viewSubscription = function(empresaId) {
    // TODO: Implement view details modal
    console.log('View subscription:', empresaId);
  };
  
  // Load on tab switch
  window.loadBillingDashboard = loadBillingDashboard;
})();
```

- [ ] **Step 4: Add script to superadmin.html**

```html
<script src="js/superadminBilling.js"></script>
```

- [ ] **Step 5: Update switchTab map**

In the switchTab function, add:

```javascript
if (tab === 'billing') loadBillingDashboard();
```

---

### Task 16: Asaas Integration (Webhook + Customer Creation)

**Files:**
- Create: `backend/src/controllers/webhookAsaasController.js`

**Interfaces:**
- Consumes: subscriptionService, prisma
- Produces: Webhook handler

- [ ] **Step 1: Create webhook controller**

```javascript
// backend/src/controllers/webhookAsaasController.js (CJS)
const subscriptionService = require('../services/subscriptionService.js');
const prisma = require('../config/prisma.js').default;

async function webhookAsaasController(req, res) {
  try {
    const { event, payment } = req.body;
    
    console.log('[Asaas Webhook] Evento recebido:', event);
    
    if (event === 'PAYMENT_RECEIVED') {
      const subscription = await prisma.subscription.findFirst({
        where: { asaasSubscriptionId: payment.subscription }
      });
      
      if (subscription) {
        await subscriptionService.processPayment(subscription.empresaId);
        console.log('[Asaas Webhook] Pagamento processado para empresa:', subscription.empresaId);
      }
    }
    
    if (event === 'SUBSCRIPTION_DELETED') {
      const subscription = await prisma.subscription.findFirst({
        where: { asaasSubscriptionId: req.body.subscription?.id }
      });
      
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED', canceledAt: new Date() }
        });
        console.log('[Asaas Webhook] Assinatura cancelada:', subscription.empresaId);
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Asaas Webhook] Erro:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = { webhookAsaasController };
```

- [ ] **Step 2: Add webhook route to subscriptionRoutes.js**

Add after other routes:

```javascript
const { webhookAsaasController } = require('../controllers/webhookAsaasController.js');
router.post('/webhooks/asaas/subscription', webhookAsaasController);
```

- [ ] **Step 3: Verify file compiles**

Run: `node -e "require('./backend/src/controllers/webhookAsaasController.js')"`
Expected: No error

---

### Task 17: Empresa Creation — Auto-create Subscription + Asaas Customer

**Files:**
- Modify: `backend/src/controllers/empresaController.js` (or wherever empresas are created)

**Interfaces:**
- Consumes: subscriptionService, Asaas API
- Produces: Auto-created subscription on empresa creation

- [ ] **Step 1: Add subscription creation to empresa creation flow**

After empresa is created, add:

```javascript
// Auto-create subscription (trial)
const { createTrialSubscription } = require('../services/subscriptionService.js');
await createTrialSubscription(empresa.id);
```

- [ ] **Step 2: Add Asaas customer creation**

After empresa is created, if Asaas is configured:

```javascript
// Create Asaas customer
if (empresa.cpfCnpj && empresa.email) {
  const asaasResponse = await fetch('https://api-sandbox.asaas.com/v3/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_API_KEY
    },
    body: JSON.stringify({
      name: empresa.nome,
      cpfCnpj: empresa.cpfCnpj,
      email: empresa.email,
      phone: empresa.telefone
    })
  });
  
  if (asaasResponse.ok) {
    const asaasData = await asaasResponse.json();
    await prisma.empresa.update({
      where: { id: empresa.id },
      data: { asaasSubcontaId: asaasData.id }
    });
  }
}
```

---

### Task 18: Subscription Status Endpoint (List All for Superadmin)

**Files:**
- Modify: `backend/src/controllers/subscriptionController.js`

**Interfaces:**
- Consumes: prisma
- Produces: List all subscriptions endpoint

- [ ] **Step 1: Add listAllSubscriptionsController**

```javascript
async function listAllSubscriptionsController(req, res) {
  try {
    const subscriptions = await require('../config/prisma.js').default.subscription.findMany({
      include: { empresa: { select: { id: true, nome: true, slug: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(subscriptions);
  } catch (e) {
    console.error('Subscription list error:', e);
    res.status(500).json({ error: 'Erro ao listar assinaturas' });
  }
}

module.exports = {
  // ... existing exports
  listAllSubscriptionsController
};
```

- [ ] **Step 2: Add route to subscriptionRoutes.js**

```javascript
router.get('/admin/subscription/list', authenticate, authorize('superadmin'), listAllSubscriptionsController);
```

---

### Task 19: Empresa Contact Endpoint (for 404 page)

**Files:**
- Modify: `backend/src/routes/empresaRoutes.js` (or create new)

**Interfaces:**
- Consumes: prisma
- Produces: Public endpoint for 404 page

- [ ] **Step 1: Add public endpoint**

```javascript
// No auth required — used by 404 page
router.get('/empresa/:slug/contact', async (req, res) => {
  try {
    const empresa = await prisma.empresa.findUnique({
      where: { slug: req.params.slug },
      select: { nome: true, telefone: true, whatsappNumber: true }
    });
    
    // Fallback: get platform support WhatsApp from PlatformSettings
    let supportWhatsApp = null;
    try {
      const setting = await prisma.platformSettings.findUnique({
        where: { key: 'support_whatsapp' }
      });
      supportWhatsApp = setting?.value || null;
    } catch (e) {}
    
    res.json({
      nome: empresa?.nome || null,
      telefone: empresa?.whatsappNumber || empresa?.telefone || null,
      supportWhatsApp
    });
  } catch (e) {
    res.json({});
  }
});
```

---

### Task 20: Verify Complete System

**Files:**
- All created/modified files

**Interfaces:**
- Full system integration test

- [ ] **Step 1: Run Prisma migrate**

Run: `cd backend && npx prisma migrate dev`
Expected: Migration applied

- [ ] **Step 2: Start server**

Run: `cd backend && node server.js`
Expected: Server starts on port 3000

- [ ] **Step 3: Test endpoints**

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

# Get subscription status
curl -s http://localhost:3000/api/empresa/subscription/status -H "Authorization: Bearer $TOKEN"

# Get pricing history
curl -s http://localhost:3000/api/admin/pricing -H "Authorization: Bearer $TOKEN"

# List all subscriptions
curl -s http://localhost:3000/api/admin/subscription/list -H "Authorization: Bearer $TOKEN"
```

Expected: All endpoints return valid JSON

- [ ] **Step 4: Verify frontend**

Open `http://localhost:3000/superadmin.html` in browser
- Login as superadmin
- Check Billing tab renders
- Check pricing form works

- [ ] **Step 5: Clean up test files**

Remove any temporary test files created during verification.
