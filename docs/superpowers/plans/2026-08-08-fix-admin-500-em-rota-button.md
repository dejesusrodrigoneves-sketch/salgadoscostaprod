# Fix Admin 500 Error & Em Rota Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 500 error on `/api/pedidos` caused by invalid Prisma query, restore admin page rendering, and ensure "Em Rota" button appears and works correctly for delivery orders.

**Architecture:** The issue stems from `sqlRepository.listarPedidosFiltrados` receiving raw `req.query` without validation/sanitization, causing Prisma to reject the query. The "Em Rota" button visibility depends on `tipoEntrega === 'delivery'` check. Admin page appears white because API failure prevents card rendering.

**Tech Stack:** Node.js, Express, Prisma ORM, vanilla JS frontend (admin.html), SQLite/PostgreSQL database.

## Global Constraints

- No commits until explicit approval
- All changes must be backward compatible
- Preserve existing API contracts
- Follow existing code patterns (vanilla JS, CommonJS backend)
- Test with existing data (no migrations required)

---

### Task 1: Sanitize/Validate Filters in sqlRepository.listarPedidosFiltrados

**Files:**
- Modify: `backend/src/repositories/sqlRepository.js:39-52`
- Test: `backend/tests/sqlRepository.test.js` (create if needed)

**Interfaces:**
- Consumes: `filtros` object from `req.query` (may contain empty strings, undefined, invalid dates)
- Produces: Valid Prisma `where` clause for `pedido.findMany`

- [ ] **Step 1: Write failing test for empty/invalid filters**

```javascript
// backend/tests/sqlRepository.test.js
const sql = require('../repositories/sqlRepository');

describe('listarPedidosFiltrados - filter sanitization', () => {
  test('handles empty status string', async () => {
    const result = await sql.listarPedidosFiltrados({ status: '' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('handles invalid date strings', async () => {
    const result = await sql.listarPedidosFiltrados({ 
      createdAtFrom: 'invalid-date',
      createdAtTo: 'also-invalid'
    });
    expect(Array.isArray(result)).toBe(true);
  });

  test('handles undefined filtros', async () => {
    const result = await sql.listarPedidosFiltrados({});
    expect(Array.isArray(result)).toBe(true);
  });

  test('handles null filtros', async () => {
    const result = await sql.listarPedidosFiltrados(null);
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- sqlRepository.test.js
```
Expected: FAIL - tests don't pass because empty string status creates invalid Prisma query

- [ ] **Step 3: Implement filter sanitization in sqlRepository.js**

```javascript
// backend/src/repositories/sqlRepository.js - replace listarPedidosFiltrados (lines 39-52)
async listarPedidosFiltrados(filtros = {}) {
  const where = { empresaId: EMPRESA_ID };
  
  // Sanitize status filter - ignore empty strings
  if (filtros.status && typeof filtros.status === 'string' && filtros.status.trim() !== '') {
    const statusList = filtros.status.split(',').map(s => s.trim()).filter(Boolean);
    if (statusList.length === 1) where.status = statusList[0];
    else if (statusList.length > 1) where.status = { in: statusList };
  }
  
  // Sanitize date filters - ignore invalid dates
  const hasDateFilter = filtros.createdAtFrom || filtros.createdAtTo;
  if (hasDateFilter) {
    where.createdAt = {};
    if (filtros.createdAtFrom) {
      const fromDate = new Date(filtros.createdAtFrom);
      if (!isNaN(fromDate.getTime())) where.createdAt.gte = fromDate;
    }
    if (filtros.createdAtTo) {
      const toDate = new Date(filtros.createdAtTo);
      if (!isNaN(toDate.getTime())) where.createdAt.lte = toDate;
    }
    // Remove createdAt if no valid dates were added
    if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
  }
  
  // Sanitize order - default to desc, only accept 'asc' or 'desc'
  const order = (filtros.order === 'asc') ? 'asc' : 'desc';
  
  return prisma.pedido.findMany({ 
    where, 
    orderBy: { createdAt: order }, 
    include: { itens: true } 
  });
},
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npm test -- sqlRepository.test.js
```
Expected: PASS - all filter sanitization tests pass

- [ ] **Step 5: Manual verification - test API endpoint**

```bash
# Start server and test
curl "http://localhost:3000/api/pedidos"
curl "http://localhost:3000/api/pedidos?status="
curl "http://localhost:3000/api/pedidos?status=pendente,producao"
curl "http://localhost:3000/api/pedidos?createdAtFrom=invalid"
```
Expected: All return 200 with JSON array (not 500)

---

### Task 2: Improve Admin Page Error Handling (Prevent White Page)

**Files:**
- Modify: `admin.html:1304-1350` (carregarPedidos function)

**Interfaces:**
- Consumes: `api('/pedidos')` promise
- Produces: Rendered order cards or error state UI

- [ ] **Step 1: Write failing test for error state rendering** (manual/integration)

```javascript
// Test: Simulate API failure and verify UI shows error state, not blank page
// Open admin.html in browser, mock fetch to reject, verify toast + empty state message
```

- [ ] **Step 2: Implement error state UI in carregarPedidos**

```javascript
// admin.html - replace carregarPedidos function (lines 1304-1350)
async function carregarPedidos() {
  try {
    var openIds = [];
    document.querySelectorAll('.order-card.open').forEach(function(c) {
      if (c.dataset.id) openIds.push(c.dataset.id);
    });
    var pedidos = await api('/pedidos');
    
    // Clear containers
    Object.values(containers).forEach(function(c) { c.innerHTML = ''; });
    
    if (!pedidos || pedidos.length === 0) {
      // Show empty state instead of blank containers
      Object.keys(containers).forEach(function(key) {
        containers[key].innerHTML = '<div class="empty-state">Nenhum pedido encontrado</div>';
      });
    } else {
      pedidos.forEach(function(p) {
        if (!p.status) return;
        var container = containers[p.status];
        if (!container) return;
        var card = renderCard(p, p.id);
        container.appendChild(card);
      });
    }
    
    updateStats();
    atualizarBadgeEsteira();

    openIds.forEach(function(id) {
      var card = document.querySelector('.order-card[data-id="' + id + '"]');
      if (card) card.classList.add('open');
    });

    var pendentesAtuais = pedidos.filter(function(p) { return p.status === 'pendente'; });
    var novosIds = pendentesAtuais.filter(function(p) {
      return !pendentesAnteriores.some(function(a) { return a.id === p.id; });
    });

    if (novosIds.length > 0) {
      tocarAlarmeNovoPedido();
      var abaAtiva = document.querySelector('.tab.active');
      if (abaAtiva && abaAtiva.dataset.tab !== 'pendente') {
        var tabPendente = document.querySelector('.tab[data-tab="pendente"]');
        if (tabPendente) tabPendente.click();
      }
    }

    if (pendentesAtuais.length > 0 && !beepLoopId) beepLoop();
    else if (pendentesAtuais.length === 0 && beepLoopId) pararBeepLoop();

    pendentesAnteriores = pendentesAtuais;
    primeiraCarga = false;
  } catch(e) {
    console.error('Erro ao carregar pedidos:', e);
    // Show error state in containers instead of leaving them blank
    Object.values(containers).forEach(function(c) {
      c.innerHTML = '<div class="error-state">Erro ao carregar pedidos. <button onclick="carregarPedidos()">Tentar novamente</button></div>';
    });
    toast('Erro ao carregar pedidos. Tentando novamente...', 'danger');
  }
}
```

- [ ] **Step 3: Add empty/error state CSS**

```css
/* admin.html or css/style.css */
.empty-state, .error-state {
  padding: var(--s-32);
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
.error-state button {
  margin-top: var(--s-12);
  padding: var(--s-8) var(--s-16);
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
}
.error-state button:hover {
  background: var(--primary-hover);
}
```

- [ ] **Step 4: Manual verification**

1. Start server: `node backend/src/app.js`
2. Open admin.html in browser
3. Verify page loads without white screen
4. Check network tab - `/api/pedidos` returns 200
5. Verify cards render correctly

---

### Task 3: Fix "Em Rota" Button Visibility & Functionality

**Files:**
- Modify: `admin.html:378` (button render condition), `admin.html:415-432` (event handler)
- Modify: `admin.html:579-581` (deveMostrarEmRota function)

**Interfaces:**
- Consumes: `p.tipoEntrega` from pedido object
- Produces: Visible/clickable "Em Rota" button for delivery orders

- [ ] **Step 1: Analyze current behavior**

Current `deveMostrarEmRota` (line 579-581):
```javascript
function deveMostrarEmRota(tipoEntrega) {
  return String(tipoEntrega || '').toLowerCase() === 'delivery';
}
```

Button only shows for `tipoEntrega === 'delivery'`. If orders have other values (e.g., 'entrega', 'delivery ', 'Delivery'), button won't show.

- [ ] **Step 2: Fix deveMostrarEmRota to be more permissive**

```javascript
// admin.html - replace deveMostrarEmRota function (lines 579-581)
function deveMostrarEmRota(tipoEntrega) {
  const tipo = String(tipoEntrega || '').toLowerCase().trim();
  // Accept common delivery variants
  return ['delivery', 'entrega', 'entrega delivery'].includes(tipo);
}
```

- [ ] **Step 3: Verify event handler works correctly**

The event handler at lines 415-432 already:
1. Opens driver selection modal
2. Sends PATCH to `/pedidos/:id/status` with `{ status: 'em_rota', entregadorId }`
3. Creates entrega record via POST `/entregas`
4. Reloads cards

This logic looks correct. Just verify the button renders and is clickable.

- [ ] **Step 4: Manual verification**

1. Create a test order with `tipoEntrega: 'delivery'` (or 'entrega')
2. Move order to 'pronto' status
3. Open admin page
4. Verify "Em Rota" button appears (truck icon)
5. Click button → driver modal opens → select driver → order moves to 'em_rota'
6. Verify toast shows success and cards reload

---

### Task 4: End-to-End Integration Test

**Files:**
- Test: Manual browser test + API tests

**Interfaces:**
- Full flow: API → Frontend rendering → Button interaction → Status change

- [ ] **Step 1: Full regression test checklist**

```bash
# 1. API Health
curl http://localhost:3000/api/pedidos                    # 200 OK
curl http://localhost:3000/api/pedidos?status=pendente    # 200 OK
curl http://localhost:3000/api/pedidos?status=            # 200 OK (not 500)
curl http://localhost:3000/api/pedidos?order=asc          # 200 OK

# 2. Frontend
# Open http://localhost:3000/admin.html
# - Page loads (no white screen)
# - Stats badges show counts
# - Tabs work (Pendentes, Produção, Pronto, Em Rota, Finalizados)
# - Cards render with correct status

# 3. Em Rota Flow
# - Create order with tipoEntrega=delivery
# - Accept → Produção → Pronto
# - "Em Rota" button visible on Pronto card
# - Click → driver modal → select → success toast
# - Order moves to Em Rota tab
# - Badge counts update

# 4. Error Recovery
# - Stop backend server
# - Refresh admin page
# - Error state shows in containers with "Tentar novamente" button
# - Restart server → click retry → cards load
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-08-fix-admin-500-em-rota-button.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**