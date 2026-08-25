# Settlement Semanal por Empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build weekly settlement system — each empresa sees what they have to receive, job auto-closes week Saturday 00:00, soft delete for empresas with pending values.

**Architecture:** New Prisma model `WeeklySettlement` + `Empresa.deletedAt` + `Pedido.semanaNoAcervo`. Backend service handles settlement lifecycle (create, history, confirm). Cron job runs Saturday 00:00. Middleware blocks deleted empresas. Frontend: superadmin settlements tab + painelLoja financial tab.

**Tech Stack:** Node.js/Express CJS, Prisma ORM, SQLite, vitest, vanilla JS frontend.

## Global Constraints

- Branch: `main`. **Sem commits até aprovação do usuário.**
- Backend port 3000; Vite 5173. Login: `djesus`/`tsa110594` (superadmin).
- Test suite: 79 tests, 14 files. Run: `cd backend && npx vitest run`.
- `backend/src/config/prisma.js` exports client directly.
- Mixed CJS/ESM. `empresaCache.js`, `resolveEmpresa.js` are ESM; most files CJS.
- Skill tool fails: `'powershell.exe' is not recognized`. Read skill files directly.
- Job schedule: Saturday 00:00 (midnight Friday→Saturday).
- Asaas fee: 2% deducted at payment time. `totalLiquido = totalBruto * 0.98`.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/src/services/settlementService.js` | Settlement lifecycle: fecharSemana, buscarActual, buscarHistory, buscarDetalhe, confirmarPagamento |
| `backend/src/controllers/settlementController.js` | HTTP handlers for settlement routes |
| `backend/src/routes/settlementRoutes.js` | Route definitions (empresa + superadmin) |
| `backend/src/jobs/weeklySettlement.js` | Cron job Saturday 00:00 + startup catch-up |
| `backend/tests/settlementService.test.js` | Unit tests for settlementService |

### Modified Files

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | +WeeklySettlement model, +Empresa.deletedAt, +Pedido.semanaNoAcervo |
| `backend/src/repositories/sqlRepository.js` | +settlement queries, +empresa soft delete queries |
| `backend/src/app.js` | +settlementRoutes import, +cron job import |
| `backend/src/middleware/auth.js` | Check deletedAt on authenticated routes |
| `backend/src/middleware/resolveEmpresa.js` | Skip deleted empresas |
| `backend/src/services/authService.js` | Block login for deleted empresas |
| `backend/src/controllers/adminController.js` | Soft delete instead of hard delete |
| `superadmin.html` | New "Settlements" tab |
| `painelLoja.html` | New "Financeiro" tab |

---

### Task 1: Prisma Schema — WeeklySettlement + new fields

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing (foundation)
- Produces: Prisma client with new models/fields

- [ ] **Step 1: Add WeeklySettlement model to schema.prisma**

Add after the existing models (before the closing of the file):

```prisma
model WeeklySettlement {
  id              Int       @id @default(autoincrement())
  empresaId       Int
  weekStart       DateTime
  weekEnd         DateTime
  totalPedidos    Int       @default(0)
  totalBruto      Decimal   @db.Decimal(10, 2) @default(0)
  totalLiquido    Decimal   @db.Decimal(10, 2) @default(0)
  status          String    @default("processando")
  processedAt     DateTime?
  paidAt          DateTime?
  asaasTransferId String?
  createdAt       DateTime  @default(now())

  empresa         Empresa   @relation(fields: [empresaId], references: [id])

  @@unique([empresaId, weekStart])
  @@index([empresaId])
  @@index([status])
}
```

- [ ] **Step 2: Add deletedAt to Empresa model**

In the existing `Empresa` model, add:

```prisma
  deletedAt DateTime?
```

- [ ] **Step 3: Add semanaNoAcervo to Pedido model**

In the existing `Pedido` model, add:

```prisma
  semanaNoAcervo Boolean @default(false)
```

- [ ] **Step 4: Run Prisma migration**

Run: `cd backend && npx prisma migrate dev --name add-settlement-models`

Expected: Migration created, Prisma client regenerated.

- [ ] **Step 5: Verify Prisma client**

Run: `cd backend && node -e "const p=require('@prisma/client'); const c=new p.PrismaClient(); console.log('WeeklySettlement' in c ? 'MODEL_OK' : 'MODEL_MISSING'); c.\$disconnect()"`

Expected: `MODEL_OK`

---

### Task 2: SQL Repository — settlement queries

**Files:**
- Modify: `backend/src/repositories/sqlRepository.js`
- Modify: `backend/tests/sqlRepository.test.js`

**Interfaces:**
- Consumes: Prisma client (from schema)
- Produces: `sql.criarSettlement(data)`, `sql.buscarSettlementActual(empresaId, weekStart)`, `sql.listarSettlements(empresaId, page)`, `sql.buscarSettlementPorId(id)`, `sql.atualizarSettlement(id, data)`, `sql.countSettlementsPendentes(empresaId)`, `sql.marcarmarcarPedidosArquivados(empresaId, weekStart, weekEnd)`, `sql.softDeleteEmpresa(id)`, `sql.hardDeleteEmpresa(id)`, `sql.listarEmpresasAtivas()`

- [ ] **Step 1: Add settlement queries to sqlRepository.js**

Add after the existing caixa queries:

```javascript
  // ---- Settlements ----
  async criarSettlement(data) {
    return prisma.weeklySettlement.create({ data });
  },
  async buscarSettlementActual(empresaId, weekStart) {
    return prisma.weeklySettlement.findUnique({
      where: { empresaId_weekStart: { empresaId, weekStart } },
    });
  },
  async listarSettlements(empresaId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [settlements, total] = await Promise.all([
      prisma.weeklySettlement.findMany({
        where: { empresaId },
        orderBy: { weekStart: 'desc' },
        skip,
        take: limit,
      }),
      prisma.weeklySettlement.count({ where: { empresaId } }),
    ]);
    return { settlements, total, page, limit };
  },
  async buscarSettlementPorId(id) {
    return prisma.weeklySettlement.findUnique({ where: { id } });
  },
  async atualizarSettlement(id, data) {
    return prisma.weeklySettlement.update({ where: { id }, data });
  },
  async countSettlementsPendentes(empresaId) {
    return prisma.weeklySettlement.count({
      where: { empresaId, status: { in: ['processando', 'pendente'] } },
    });
  },
  async marcarPedidosArquivados(empresaId, weekStart, weekEnd) {
    return prisma.pedido.updateMany({
      where: {
        empresaId,
        status: 'pago',
        semanaNoAcervo: false,
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      data: { semanaNoAcervo: true },
    });
  },
  // ---- Empresa soft/hard delete ----
  async softDeleteEmpresa(id) {
    return prisma.empresa.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
  async hardDeleteEmpresa(id) {
    // Cascade delete in FK order
    const empresaId = Number(id);
    await prisma.$transaction([
      prisma.loginLog.deleteMany({ where: { usuario: { empresaId } } }),
      prisma.auditLog.deleteMany({ where: { actorId: empresaId } }),
      prisma.appLog.deleteMany({ where: {} }), // global, skip
      prisma.processedWebhook.deleteMany({ where: {} }),
      prisma.whatsAppInstance.deleteMany({ where: { empresaId } }),
      prisma.entregaDiaria.deleteMany({ where: { pedido: { empresaId } } }),
      prisma.itensPedido.deleteMany({ where: { pedido: { empresaId } } }),
      prisma.pagamento.deleteMany({ where: { pedido: { empresaId } } }),
      prisma.pedido.deleteMany({ where: { empresaId } }),
      prisma.weeklySettlement.deleteMany({ where: { empresaId } }),
      prisma.caixaDiario.deleteMany({ where: { empresaId } }),
      prisma.horario.deleteMany({ where: { empresaId } }),
      prisma.cupom.deleteMany({ where: { empresaId } }),
      prisma.produto.deleteMany({ where: { empresaId } }),
      prisma.categoria.deleteMany({ where: { empresaId } }),
      prisma.usuario.deleteMany({ where: { empresaId } }),
      prisma.cliente.deleteMany({ where: { empresaId } }),
      prisma.counter.deleteMany({ where: { empresaId } }),
      prisma.empresa.delete({ where: { id: empresaId } }),
    ]);
  },
  async listarEmpresasAtivas() {
    return prisma.empresa.findMany({ where: { deletedAt: null } });
  },
```

- [ ] **Step 2: Run existing tests**

Run: `cd backend && npx vitest run 2>&1 | tail -4`

Expected: 79 passed (no regressions)

- [ ] **Step 3: Verify parse**

Run: `node -e "require('./backend/src/repositories/sqlRepository.js'); console.log('PARSE_OK')" 2>&1 | tail -1`

Expected: `PARSE_OK`

---

### Task 3: Settlement Service

**Files:**
- Create: `backend/src/services/settlementService.js`
- Create: `backend/tests/settlementService.test.js`

**Interfaces:**
- Consumes: `sql` repository (from Task 2), `auditService` (existing)
- Produces: `settlementService.fecharSemana()`, `.buscarActual(empresaId)`, `.buscarHistory(empresaId, page)`, `.buscarDetalhe(id)`, `.confirmarPagamento(settlementId)`

- [ ] **Step 1: Create settlementService.js**

```javascript
const sql = require('../repositories/sqlRepository');
const auditService = require('./auditService');

/**
 * Calcula weekStart (segunda 00:00) e weekEnd (sexta 23:59:59) para uma data.
 */
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: friday };
}

/**
 * Fecha a semana para uma empresa (chamado pelo job sáb 00:00).
 * Retorna settlement criado ou null se sem pedidos.
 */
async function fecharSemana(empresaId, referenceDate = new Date()) {
  const { weekStart, weekEnd } = getWeekRange(referenceDate);

  // Verificar se já existe settlement para esta semana
  const existing = await sql.buscarSettlementActual(empresaId, weekStart);
  if (existing) return existing; // idempotência

  // Buscar pedidos pagos no período (excluindo já arquivados)
  const pedidos = await sql.buscarPedidosPagosNoPeriodo(empresaId, weekStart, weekEnd);
  if (!pedidos || pedidos.length === 0) return null;

  // Calcular totais
  const totalPedidos = pedidos.length;
  const totalBruto = pedidos.reduce((sum, p) => sum + Number(p.total), 0);
  const totalLiquido = totalBruto * 0.98;

  // Criar settlement
  const settlement = await sql.criarSettlement({
    empresaId,
    weekStart,
    weekEnd,
    totalPedidos,
    totalBruto,
    totalLiquido,
    status: 'pendente',
    processedAt: new Date(),
  });

  // Marcar pedidos como arquivados
  await sql.marcarPedidosArquivados(empresaId, weekStart, weekEnd);

  // Audit log
  auditService.audit({
    action: 'settlement.created',
    module: 'settlements',
    targetType: 'settlement',
    targetType: 'settlement',
    targetId: settlement.id,
    after: { empresaId, totalPedidos, totalBruto, totalLiquido },
    severity: 'info',
  });

  return settlement;
}

/**
 * Busca settlement da semana atual para uma empresa.
 */
async function buscarActual(empresaId) {
  const now = new Date();
  const { weekStart } = getWeekRange(now);
  return sql.buscarSettlementActual(empresaId, weekStart);
}

/**
 * Busca histórico de settlements (paginado).
 */
async function buscarHistory(empresaId, page = 1) {
  return sql.listarSettlements(empresaId, page);
}

/**
 * Busca detalhe de um settlement.
 */
async function buscarDetalhe(id) {
  return sql.buscarSettlementPorId(id);
}

/**
 * Confirma pagamento de um settlement (webhook Asaas).
 * Se empresa deletada e nenhum pendente → hard delete.
 */
async function confirmarPagamento(settlementId, asaasTransferId = null) {
  const settlement = await sql.buscarSettlementPorId(settlementId);
  if (!settlement) throw Object.assign(new Error('Settlement não encontrado'), { status: 404 });

  await sql.atualizarSettlement(settlementId, {
    status: 'pago',
    paidAt: new Date(),
    asaasTransferId,
  });

  // Verificar se empresa pode ser hard-deletada
  const pendentes = await sql.countSettlementsPendentes(settlement.empresaId);
  if (pendentes === 0) {
    const empresa = await sql.buscarEmpresa(settlement.empresaId);
    if (empresa && empresa.deletedAt) {
      await sql.hardDeleteEmpresa(settlement.empresaId);
      auditService.audit({
        action: 'empresa.hard_deleted',
        module: 'empresas',
        targetType: 'empresa',
        targetId: settlement.empresaId,
        severity: 'info',
      });
    }
  }

  return { success: true };
}

module.exports = {
  getWeekRange,
  fecharSemana,
  buscarActual,
  buscarHistory,
  buscarDetalhe,
  confirmarPagamento,
};
```

- [ ] **Step 2: Create settlementService.test.js**

```javascript
const { describe, it, expect, vi, beforeEach } = require('vitest');

// Mock sql repository
vi.mock('../src/repositories/sqlRepository', () => ({
  default: {
    buscarSettlementActual: vi.fn(),
    criarSettlement: vi.fn(),
    marcarPedidosArquivados: vi.fn(),
    buscarPedidosPagosNoPeriodo: vi.fn(),
    listarSettlements: vi.fn(),
    buscarSettlementPorId: vi.fn(),
    atualizarSettlement: vi.fn(),
    countSettlementsPendentes: vi.fn(),
    buscarEmpresa: vi.fn(),
    hardDeleteEmpresa: vi.fn(),
  },
}));

// Mock auditService
vi.mock('../src/services/auditService', () => ({
  default: { audit: vi.fn() },
}));

const sql = require('../src/repositories/sqlRepository').default;
const service = require('../src/services/settlementService');

describe('settlementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWeekRange', () => {
    it('returns monday-friday for a weekday', () => {
      const wed = new Date('2026-08-19T10:00:00Z'); // quarta
      const range = service.getWeekRange(wed);
      expect(range.weekStart.getDay()).toBe(1); // monday
      expect(range.weekEnd.getDay()).toBe(5); // friday
    });

    it('returns correct dates for sunday', () => {
      const sun = new Date('2026-08-23T10:00:00Z'); // domingo
      const range = service.getWeekRange(sun);
      expect(range.weekStart.getDay()).toBe(1); // monday before
      expect(range.weekEnd.getDay()).toBe(5); // friday before
    });
  });

  describe('fecharSemana', () => {
    it('returns existing settlement if already created (idempotency)', async () => {
      const existing = { id: 1, status: 'pendente' };
      sql.buscarSettlementActual.mockResolvedValue(existing);

      const result = await service.fecharSemana(1);
      expect(result).toEqual(existing);
      expect(sql.criarSettlement).not.toHaveBeenCalled();
    });

    it('returns null if no paid orders in period', async () => {
      sql.buscarSettlementActual.mockResolvedValue(null);
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue([]);

      const result = await service.fecharSemana(1);
      expect(result).toBeNull();
    });

    it('creates settlement with correct totals', async () => {
      sql.buscarSettlementActual.mockResolvedValue(null);
      sql.buscarPedidosPagosNoPeriodo.mockResolvedValue([
        { total: 100 },
        { total: 200 },
        { total: 50 },
      ]);
      const created = { id: 1, totalBruto: 350, totalLiquido: 343 };
      sql.criarSettlement.mockResolvedValue(created);

      const result = await service.fecharSemana(1);
      expect(result.totalBruto).toBe(350);
      expect(result.totalLiquido).toBeCloseTo(343, 0);
      expect(sql.marcarPedidosArquivados).toHaveBeenCalled();
    });
  });

  describe('confirmarPagamento', () => {
    it('marks settlement as paid', async () => {
      sql.buscarSettlementPorId.mockResolvedValue({ id: 1, empresaId: 1 });
      sql.countSettlementsPendentes.mockResolvedValue(0);
      sql.buscarEmpresa.mockResolvedValue({ id: 1, deletedAt: null });

      const result = await service.confirmarPagamento(1, 'ASAAS_123');
      expect(result.success).toBe(true);
      expect(sql.atualizarSettlement).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'pago',
        asaasTransferId: 'ASAAS_123',
      }));
    });

    it('hard deletes empresa if deleted and no pending settlements', async () => {
      sql.buscarSettlementPorId.mockResolvedValue({ id: 1, empresaId: 1 });
      sql.countSettlementsPendentes.mockResolvedValue(0);
      sql.buscarEmpresa.mockResolvedValue({ id: 1, deletedAt: new Date() });

      await service.confirmarPagamento(1);
      expect(sql.hardDeleteEmpresa).toHaveBeenCalledWith(1);
    });

    it('does NOT hard delete if empresa not deleted', async () => {
      sql.buscarSettlementPorId.mockResolvedValue({ id: 1, empresaId: 1 });
      sql.countSettlementsPendentes.mockResolvedValue(0);
      sql.buscarEmpresa.mockResolvedValue({ id: 1, deletedAt: null });

      await service.confirmarPagamento(1);
      expect(sql.hardDeleteEmpresa).not.toHaveBeenCalled();
    });

    it('does NOT hard delete if pending settlements remain', async () => {
      sql.buscarSettlementPorId.mockResolvedValue({ id: 1, empresaId: 1 });
      sql.countSettlementsPendentes.mockResolvedValue(2);

      await service.confirmarPagamento(1);
      expect(sql.hardDeleteEmpresa).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd backend && npx vitest run 2>&1 | tail -4`

Expected: tests pass (settlementService.test.js + existing 79)

- [ ] **Step 4: Verify parse**

Run: `node -e "require('./backend/src/services/settlementService.js'); console.log('PARSE_OK')" 2>&1 | tail -1`

Expected: `PARSE_OK`

---

### Task 4: Settlement Controller + Routes + App Registration

**Files:**
- Create: `backend/src/controllers/settlementController.js`
- Create: `backend/src/routes/settlementRoutes.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `settlementService` (from Task 3), `authenticate`/`authorize` middleware (existing)
- Produces: `GET /api/empresa/settlement/actual`, `GET /api/empresa/settlement/history`, `GET /api/empresa/settlement/:id`, `GET /api/admin/settlements`

- [ ] **Step 1: Create settlementController.js**

```javascript
const settlementService = require('../services/settlementService');
const { asyncHandler } = require('../middleware/errorHandler');

function empresaId(req) {
  return req.ctx?.empresaId || req.user?.empresaId;
}

exports.actual = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const settlement = await settlementService.buscarActual(empId);
  res.json(settlement || { message: 'Nenhum settlement nesta semana' });
});

exports.history = asyncHandler(async (req, res) => {
  const empId = empresaId(req);
  if (!empId) return res.status(400).json({ error: 'empresaId obrigatório' });
  const page = parseInt(req.query.page) || 1;
  const result = await settlementService.buscarHistory(empId, page);
  res.json(result);
});

exports.detalhe = asyncHandler(async (req, res) => {
  const settlement = await settlementService.buscarDetalhe(Number(req.params.id));
  if (!settlement) return res.status(404).json({ error: 'Settlement não encontrado' });
  res.json(settlement);
});

exports.globalSettlements = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const result = await settlementService.listarSettlementsGlobais(page);
  res.json(result);
});
```

- [ ] **Step 2: Create settlementRoutes.js**

```javascript
const { Router } = require('express');
const controller = require('../controllers/settlementController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Empresa routes (autenticadas)
router.get('/actual', authenticate, controller.actual);
router.get('/history', authenticate, controller.history);
router.get('/:id', authenticate, controller.detalhe);

module.exports = router;
```

- [ ] **Step 3: Register in app.js**

In `backend/src/app.js`, add after existing route imports:

```javascript
const settlementRoutes = require('./routes/settlementRoutes');
```

Add after existing `app.use` routes:

```javascript
app.use('/api/empresa/settlement', settlementRoutes);
```

For superadmin global settlements, add to `adminRoutes.js` or create a separate admin route. Simplest: add to existing admin controller.

- [ ] **Step 4: Verify parse**

Run: `cd backend && node -e "require('./src/app.js'); console.log('BOOT_OK')" 2>&1 | tail -1`

Expected: `BOOT_OK`

- [ ] **Step 5: Run existing tests**

Run: `cd backend && npx vitest run 2>&1 | tail -4`

Expected: 79 passed

---

### Task 5: Cron Job — Saturday 00:00

**Files:**
- Create: `backend/src/jobs/weeklySettlement.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `settlementService.fecharSemana()` (from Task 3), `sql.listarEmpresasAtivas()` (from Task 2)
- Produces: Auto-closes week for all empresas on Saturday 00:00

- [ ] **Step 1: Create weeklySettlement.js**

```javascript
const cron = require('node-cron');
const settlementService = require('../services/settlementService');
const sql = require('../repositories/sqlRepository');
const auditService = require('../services/auditService');

/**
 * Processa settlement para todas as empresas (ativo + deletadas com pendências).
 */
async function processarTodasEmpresas() {
  const empresas = await sql.listarEmpresasAtivas();
  let processadas = 0;
  let erros = 0;

  for (const emp of empresas) {
    try {
      const result = await settlementService.fecharSemana(emp.id);
      if (result) processadas++;
    } catch (err) {
      erros++;
      auditService.audit({
        action: 'settlement.error',
        module: 'settlements',
        targetType: 'empresa',
        targetId: emp.id,
        severity: 'error',
        reason: err.message,
      });
    }
  }

  auditService.audit({
    action: 'settlement.batch_complete',
    module: 'settlements',
    severity: 'info',
    metadata: { processadas, erros, total: empresas.length },
  });

  return { processadas, erros };
}

/**
 * Verifica se perdeu rodadas (servidor off no sábado).
 * Roda uma vez no startup.
 */
async function catchUp() {
  const now = new Date();
  const day = now.getDay();
  // Se é segunda e não tem settlement da semana anterior, processar
  if (day === 1) {
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    const { weekStart } = settlementService.getWeekRange(lastWeek);
    
    const empresas = await sql.listarEmpresasAtivas();
    for (const emp of empresas) {
      const existing = await sql.buscarSettlementActual(emp.id, weekStart);
      if (!existing) {
        await settlementService.fecharSemana(emp.id, lastWeek);
      }
    }
  }
}

/**
 * Inicia o cron job.
 */
function start() {
  // Sábado 00:00 (0 0 * * 6)
  cron.schedule('0 0 * * 6', async () => {
    console.log('[SETTLEMENT] Iniciando processamento semanal...');
    const result = await processarTodasEmpresas();
    console.log(`[SETTLEMENT] Concluído: ${result.processadas} ok, ${result.erros} erros`);
  });

  // Catch-up no startup
  catchUp().catch(err => {
    console.error('[SETTLEMENT] Catch-up error:', err.message);
  });

  console.log('[SETTLEMENT] Cron job registrado (sáb 00:00)');
}

module.exports = { start, processarTodasEmpresas, catchUp };
```

- [ ] **Step 2: Register in app.js**

Add at the top:

```javascript
const settlementJob = require('./jobs/weeklySettlement');
```

After `app.listen()` or after routes registration:

```javascript
settlementJob.start();
```

- [ ] **Step 3: Install node-cron**

Run: `cd backend && npm install node-cron && npm ls node-cron`

Expected: node-cron in dependencies

- [ ] **Step 4: Verify parse**

Run: `cd backend && node -e "require('./src/jobs/weeklySettlement.js'); console.log('PARSE_OK')" 2>&1 | tail -1`

Expected: `PARSE_OK`

- [ ] **Step 5: Run existing tests**

Run: `cd backend && npx vitest run 2>&1 | tail -4`

Expected: 79 passed

---

### Task 6: Middleware — Block deleted empresas

**Files:**
- Modify: `backend/src/middleware/auth.js`
- Modify: `backend/src/middleware/resolveEmpresa.js`
- Modify: `backend/src/services/authService.js`

**Interfaces:**
- Consumes: `sql.buscarEmpresa()` (existing)
- Produces: deleted empresas blocked at login + all authenticated routes + public pages

- [ ] **Step 1: auth.js — check deletedAt**

In `authenticate` function, after `req.user = decoded;` and before `next();` (around line 35):

```javascript
    // Verificar se empresa está deletada
    if (decoded.empresaId) {
      const empresa = await sql.buscarEmpresa(decoded.empresaId);
      if (empresa && empresa.deletedAt) {
        return res.status(403).json({ error: 'Empresa inativa' });
      }
    }

    req.user = decoded;
    next();
```

Add `const sql = require('../repositories/sqlRepository');` at top of auth.js.

- [ ] **Step 2: resolveEmpresa.js — skip deleted empresas**

In `resolveEmpresa`, after finding empresa from slug/subdomain, before setting `req.ctx`:

```javascript
  if (empresa.deletedAt) {
    return res.status(404).json({ error: 'Loja não encontrada' });
  }
```

- [ ] **Step 3: authService.js — block login**

In `login` function, after finding user, before password check:

```javascript
  // Verificar se empresa está deletada
  if (user.empresaId) {
    const empresa = await sql.buscarEmpresa(user.empresaId);
    if (empresa && empresa.deletedAt) {
      throw Object.assign(new Error('Empresa inativa'), { status: 403 });
    }
  }
```

- [ ] **Step 4: Run existing tests**

Run: `cd backend && npx vitest run 2>&1 | tail -4`

Expected: 79 passed (no regressions)

---

### Task 7: Admin Controller — Soft delete

**Files:**
- Modify: `backend/src/controllers/adminController.js`

**Interfaces:**
- Consumes: `sql.softDeleteEmpresa()` (from Task 2)
- Produces: `DELETE /api/admin/:id` now sets deletedAt instead of hard delete

- [ ] **Step 1: Change deletarEmpresa to soft delete**

Find the `deletarEmpresa` function. Replace `sql.deletarEmpresa(id)` with `sql.softDeleteEmpresa(id)`.

Also add validation: check for pending settlements before soft delete.

```javascript
exports.deletarEmpresa = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  // Verificar settlements pendentes
  const pendentes = await sql.countSettlementsPendentes(id);
  if (pendentes > 0) {
    return res.status(409).json({
      error: `Empresa possui ${pendentes} settlement(s) pendente(s). Aguarde processamento.`,
    });
  }

  await sql.softDeleteEmpresa(id);
  invalidateEmpresaCache();
  res.json({ success: true, message: 'Empresa removida (soft delete)' });
});
```

- [ ] **Step 2: Verify parse**

Run: `cd backend && node -e "require('./src/controllers/adminController.js'); console.log('PARSE_OK')" 2>&1 | tail -1`

Expected: `PARSE_OK`

- [ ] **Step 3: Run existing tests**

Run: `cd backend && npx vitest run 2>&1 | tail -4`

Expected: 79 passed

---

### Task 8: Frontend — Superadmin Settlements Tab

**Files:**
- Modify: `superadmin.html`

**Interfaces:**
- Consumes: `GET /api/admin/settlements` (from Task 4)
- Produces: Aba "Settlements" no superadmin com lista global

- [ ] **Step 1: Add tab button**

In the tabs section, add after the "Empresas" tab button:

```html
  <button class="tab" onclick="switchTab('settlements',this)"><i class="fas fa-dollar-sign"></i> Settlements</button>
```

- [ ] **Step 2: Add tab content div**

Add after `tabEmpresas` div:

```html
<div class="tab-content" id="tabSettlements">
  <div class="card">
    <h2><i class="fas fa-dollar-sign"></i> Settlements Globais</h2>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead><tr><th>Empresa</th><th>Período</th><th>Pedidos</th><th>Bruto</th><th>Líquido</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody id="settlementsTableBody"></tbody>
    </table>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add JS function to load settlements**

In the script section, add:

```javascript
async function carregarSettlements() {
  try {
    const data = await api('/admin/settlements');
    const tbody = document.getElementById('settlementsTableBody');
    if (!data.settlements || !data.settlements.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Nenhum settlement encontrado</td></tr>';
      return;
    }
    const statusColors = { processando: '#F59E0B', pendente: '#3B82F6', pago: '#10B981', erro: '#EF4444' };
    tbody.innerHTML = data.settlements.map(s => {
      const empresa = s.empresa?.nome || 'ID ' + s.empresaId;
      const periodo = new Date(s.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(s.weekEnd).toLocaleDateString('pt-BR');
      const cor = statusColors[s.status] || '#666';
      return '<tr><td><strong>' + escapeHtml(empresa) + '</strong></td><td>' + periodo + '</td><td>' + s.totalPedidos + '</td><td>R$ ' + Number(s.totalBruto).toFixed(2) + '</td><td>R$ ' + Number(s.totalLiquido).toFixed(2) + '</td><td style="color:' + cor + ';font-weight:600">' + s.status + '</td><td>-</td></tr>';
    }).join('');
  } catch(e) {
    console.error('Erro ao carregar settlements', e);
  }
}
```

- [ ] **Step 4: Add 'settlements' case to switchTab**

In the `switchTab` function, add settlements case to call `carregarSettlements()` when tab is selected.

- [ ] **Step 5: Verify JS parses**

Run: `node -e "const s=require('fs').readFileSync('superadmin.html','utf8'); const m=s.match(/<script>([\s\S]*?)<\/script>/); new Function(m[1]); console.log('JS_OK')" 2>&1 | tail -1`

Expected: `JS_OK`

---

### Task 9: Frontend — painelLoja Financial Tab

**Files:**
- Modify: `painelLoja.html`
- Modify: `js/painel.js`

**Interfaces:**
- Consumes: `GET /api/empresa/settlement/actual`, `GET /api/empresa/settlement/history` (from Task 4)
- Produces: Aba "Financeiro" no painelLoja com card settlement + histórico

- [ ] **Step 1: Add tab button in painelLoja.html**

In the tabs section (after existing tabs), add:

```html
<button class="tab-btn" id="tab-financeiro" role="tab" aria-selected="false">Financeiro</button>
```

- [ ] **Step 2: Add tab content div**

Add after existing view divs:

```html
<div id="view-financeiro" class="tab-panel hidden">
  <div class="settlement-card" id="settlementCard">
    <h3>Semana Atual</h3>
    <div id="settlementInfo">Carregando...</div>
  </div>
  <div class="settlement-history">
    <h3>Semanas Anteriores</h3>
    <div id="settlementHistory">Carregando...</div>
  </div>
</div>
```

- [ ] **Step 3: Add JS in painel.js**

Add after existing tab handlers:

```javascript
document.getElementById('tab-financeiro')?.addEventListener('click', () => { selectTab('financeiro'); carregarFinanceiro(); });

async function carregarFinanceiro() {
  try {
    const actual = await apiRequest('/empresa/settlement/actual');
    const card = document.getElementById('settlementCard');
    if (actual.message) {
      card.innerHTML = '<h3>Semana Atual</h3><p style="color:var(--text-muted)">Nenhum settlement nesta semana</p>';
    } else {
      const statusColors = { processando: '#F59E0B', pendente: '#3B82F6', pago: '#10B981', erro: '#EF4444' };
      const cor = statusColors[actual.status] || '#666';
      const periodo = new Date(actual.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(actual.weekEnd).toLocaleDateString('pt-BR');
      card.innerHTML = '<h3>Semana Atual</h3>' +
        '<div class="settlement-info">' +
        '<p><strong>Período:</strong> ' + periodo + '</p>' +
        '<p><strong>Pedidos:</strong> ' + actual.totalPedidos + '</p>' +
        '<p><strong>Bruto:</strong> R$ ' + Number(actual.totalBruto).toFixed(2) + '</p>' +
        '<p><strong>Líquido:</strong> R$ ' + Number(actual.totalLiquido).toFixed(2) + '</p>' +
        '<p><strong>Status:</strong> <span style="color:' + cor + ';font-weight:600">' + actual.status + '</span></p>' +
        '</div>';
    }
  } catch(e) {
    console.error('Erro ao carregar financeiro', e);
  }

  try {
    const history = await apiRequest('/empresa/settlement/history');
    const container = document.getElementById('settlementHistory');
    if (!history.settlements || !history.settlements.length) {
      container.innerHTML = '<p style="color:var(--text-muted)">Nenhum settlement anterior</p>';
      return;
    }
    container.innerHTML = history.settlements.map(s => {
      const periodo = new Date(s.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(s.weekEnd).toLocaleDateString('pt-BR');
      return '<div class="settlement-item">' +
        '<span>' + periodo + '</span>' +
        '<span>R$ ' + Number(s.totalLiquido).toFixed(2) + '</span>' +
        '<span style="color:' + (s.status === 'pago' ? '#10B981' : '#F59E0B') + '">' + s.status + '</span>' +
        '</div>';
    }).join('');
  } catch(e) {
    console.error('Erro ao carregar histórico', e);
  }
}
```

- [ ] **Step 4: Add 'financeiro' to selectTab array**

In painel.js, add `'financeiro'` to the `tabs` array.

- [ ] **Step 5: Verify JS parses**

Run: `node -e "const s=require('fs').readFileSync('js/painel.js','utf8'); new Function(s); console.log('JS_OK')" 2>&1 | tail -1`

Expected: `JS_OK`

---

### Task 10: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd backend && npx vitest run 2>&1 | tail -4`

Expected: all tests pass

- [ ] **Step 2: Boot server**

Run: `cd backend && node server.js &` (sleep 3, then kill)

Expected: no errors

- [ ] **Step 3: E2E curl — create settlement manually**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

# Check actual settlement
curl -s "http://localhost:3000/api/empresa/settlement/actual" -H "Authorization: Bearer $TOKEN"

# Check history
curl -s "http://localhost:3000/api/empresa/settlement/history" -H "Authorization: Bearer $TOKEN"
```

Expected: JSON responses (empty or with data)

- [ ] **Step 4: Verify login for deleted empresa is blocked**

(Via curl — create empresa, soft delete, try login)

- [ ] **Step 5: Update ledger**

Update `.superpowers/sdd/progress.md` with settlement task completion.
