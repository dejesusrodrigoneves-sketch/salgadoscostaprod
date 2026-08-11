# Audit Log Cleanup — 90-Day Retention

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all client audit logs from DB and enforce 90-day rolling retention on all audit logs, running cleanup at server startup.

**Architecture:** Two new functions in `auditRepository.js` (`deleteClienteLogs`, `deleteOldLogs`) called once at server startup in `server.js`. Client logs are permanently excluded (already filtered in `auditService.js:59`). Old logs beyond 90 days are purged on each boot.

**Tech Stack:** Node.js, Express, Prisma ORM, PostgreSQL (Supabase)

## Global Constraints

- Node.js >= 18
- Prisma schema at `backend/prisma/schema.prisma`
- Database: Supabase (us-east-1 pooler) + Neon (sa-east-1 direct)
- Test runner: Vitest
- No new dependencies
- No new abstractions

---

## File Map

| File | Responsibility |
|------|---------------|
| `backend/src/repositories/auditRepository.js` | Add `deleteClienteLogs()` and `deleteOldLogs(days)` |
| `backend/server.js` | Call cleanup functions at startup |
| `backend/tests/auditCleanup.test.js` | Unit tests for new repository functions |

---

### Task 1: Add `deleteClienteLogs` to auditRepository

**Files:**
- Modify: `backend/src/repositories/auditRepository.js:53-55`
- Test: `backend/tests/auditCleanup.test.js`

**Interfaces:**
- Consumes: `prisma.auditLog.deleteMany`
- Produces: `async function deleteClienteLogs() → Promise<number>` (count of deleted rows)

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/auditCleanup.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the module
const mockDeleteMany = vi.fn();
vi.mock('../src/config/prisma', () => ({
  default: { auditLog: { deleteMany: mockDeleteMany } }
}));

describe('auditRepository cleanup', () => {
  beforeEach(() => {
    mockDeleteMany.mockReset();
  });

  it('deleteClienteLogs calls deleteMany with actorType=cliente', async () => {
    mockDeleteMany.mockResolvedValue({ count: 5 });
    const { deleteClienteLogs } = await import('../src/repositories/auditRepository.js');
    const count = await deleteClienteLogs();
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { actorType: 'cliente' }
    });
    expect(count).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/auditCleanup.test.js`
Expected: FAIL — `deleteClienteLogs is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/src/repositories/auditRepository.js` before `module.exports`:

```js
async function deleteClienteLogs() {
  const result = await prisma.auditLog.deleteMany({
    where: { actorType: 'cliente' }
  });
  return result.count;
}
```

Update `module.exports`:

```js
module.exports = { createManyAudit, createManyAppLog, listAudit, listActors, deleteClienteLogs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/auditCleanup.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/auditRepository.js backend/tests/auditCleanup.test.js
git commit -m "feat(audit): add deleteClienteLogs to purge client audit entries"
```

---

### Task 2: Add `deleteOldLogs` to auditRepository

**Files:**
- Modify: `backend/src/repositories/auditRepository.js`
- Modify: `backend/tests/auditCleanup.test.js`

**Interfaces:**
- Consumes: `prisma.auditLog.deleteMany`
- Produces: `async function deleteOldLogs(days = 90) → Promise<number>` (count of deleted rows)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/auditCleanup.test.js`:

```js
it('deleteOldLogs deletes records older than N days', async () => {
  mockDeleteMany.mockResolvedValue({ count: 12 });
  const { deleteOldLogs } = await import('../src/repositories/auditRepository.js');
  const count = await deleteOldLogs(90);
  expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  const call = mockDeleteMany.mock.calls[0][0];
  expect(call.where.createdAt.lt).toBeInstanceOf(Date);
  // Verify cutoff is ~90 days ago
  const diff = Date.now() - call.where.createdAt.lt.getTime();
  expect(diff).toBeGreaterThan(89 * 86400000);
  expect(diff).toBeLessThan(91 * 86400000);
  expect(count).toBe(12);
});

it('deleteOldLogs defaults to 90 days', async () => {
  mockDeleteMany.mockResolvedValue({ count: 0 });
  const { deleteOldLogs } = await import('../src/repositories/auditRepository.js');
  await deleteOldLogs();
  const call = mockDeleteMany.mock.calls[0][0];
  const diff = Date.now() - call.where.createdAt.lt.getTime();
  expect(diff).toBeGreaterThan(89 * 86400000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/auditCleanup.test.js`
Expected: FAIL — `deleteOldLogs is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/src/repositories/auditRepository.js`:

```js
async function deleteOldLogs(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });
  return result.count;
}
```

Update `module.exports`:

```js
module.exports = { createManyAudit, createManyAppLog, listAudit, listActors, deleteClienteLogs, deleteOldLogs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/auditCleanup.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/auditRepository.js backend/tests/auditCleanup.test.js
git commit -m "feat(audit): add deleteOldLogs for 90-day retention"
```

---

### Task 3: Run cleanup at server startup

**Files:**
- Modify: `backend/server.js:5-7`

**Interfaces:**
- Consumes: `deleteClienteLogs()`, `deleteOldLogs(90)` from `auditRepository.js`
- Produces: cleanup runs once at boot, logs results

- [ ] **Step 1: Write the failing test**

No unit test for server.js startup side-effects. Manual verification in Step 4.

- [ ] **Step 2: Modify server.js**

Replace `backend/server.js` content:

```js
const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/config/logger');

app.listen(config.port, async () => {
  logger.info(`Servidor iniciado na porta ${config.port}`);

  // Audit cleanup: purge client logs + enforce 90-day retention
  try {
    const auditRepo = require('./src/repositories/auditRepository');
    const deletedClientes = await auditRepo.deleteClienteLogs();
    const deletedOld = await auditRepo.deleteOldLogs(90);
    if (deletedClientes > 0) logger.info(`Audit cleanup: ${deletedClientes} logs de clientes removidos`);
    if (deletedOld > 0) logger.info(`Audit cleanup: ${deletedOld} logs com 90+ dias removidos`);
    if (deletedClientes === 0 && deletedOld === 0) logger.info('Audit cleanup: nenhum log para remover');
  } catch (err) {
    logger.error('Audit cleanup falhou:', err.message);
  }
});
```

- [ ] **Step 3: Verify server starts without errors**

Run: `cd backend && node server.js`
Expected: `Servidor iniciado na porta 3000` + `Audit cleanup: ... logs ...`
Kill with Ctrl+C after verifying output.

- [ ] **Step 4: Run full test suite**

Run: `cd backend && npx vitest run`
Expected: All tests pass (entregaService pre-existing failure is unrelated)

- [ ] **Step 5: Rebuild dist**

Run: `cd "C:\Users\djesus\Downloads\projects-vscode\sic-ia - Copy" && npx vite build`
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Commit**

```bash
git add backend/server.js
git commit -m "feat(audit): run cleanup at startup — client logs + 90d retention"
```

---

### Task 4: Verify end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Start server and check logs**

Run: `cd backend && node server.js`
Verify: Startup shows audit cleanup message with counts

- [ ] **Step 2: Verify superadmin audit tab**

Open `superadmin.html?tab=registros`
Verify: No client actions (register, login, update) appear in timeline

- [ ] **Step 3: Verify clients tab loads**

Open `superadmin.html?tab=clientes`
Verify: Client list populates (from Task 1 fix)

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix(audit): end-to-end verification"
```
