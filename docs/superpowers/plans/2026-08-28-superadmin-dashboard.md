# Superadmin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global SaaS dashboard to superadmin.html showing aggregate financial data across all empresas, with per-empresa drill-down via dropdown selector.

**Architecture:** Backend provides 2 new API endpoints (summary + empresas list) using Prisma raw SQL for aggregates. Frontend adds Dashboard as first tab in superadmin.html with dark theme, 7 global cards, 4 per-empresa cards, and a dropdown selector. All queries require superadmin auth.

**Tech Stack:** Express.js (CJS routes/controller), Prisma ($queryRaw), ESM service, vanilla JS frontend (IIFE pattern), CSS custom properties for dark theme.

## Global Constraints

- Backend module system: services are ESM (`import`), routes/controllers are CJS (`require`)
- Prisma singleton: `import prisma from '../config/prisma.js'` (ESM) or `const prisma = require('../config/prisma')` (CJS)
- Auth middleware: `authenticate` + `authorize('superadmin')` from `../middleware/auth`
- Dark theme vars: `--secondary: #0E100F`, `--surface: #191919`, `--text: #FFFCE1`, `--primary: #F26D3D`
- Frontend auth token: `localStorage.getItem('authUser')` → `{ token }`
- No commits per user directive
- Port 3000 backend, Vite 5173 dev

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/services/superadminDashboardService.js` | ESM. SQL aggregates for summary + empresas. |
| Create | `backend/src/controllers/superadminDashboardController.js` | CJS. Request handlers. |
| Create | `backend/src/routes/superadminDashboardRoutes.js` | CJS. Router + auth middleware. |
| Modify | `backend/src/app.js:33-112` | Mount dashboard routes. |
| Create | `js/superadminDashboard.js` | IIFE. Fetch + render cards/table/selector. |
| Modify | `superadmin.html:1-27` | Add Dashboard tab button + tab-content div + dark theme CSS + script tag. |

---

### Task 1: Backend Service (ESM)

**Files:**
- Create: `backend/src/services/superadminDashboardService.js`

**Interfaces:**
- Produces: `getSummary(empresaId?)`, `getEmpresas()`

- [ ] **Step 1: Create service file**

```javascript
// backend/src/services/superadminDashboardService.js (ESM)
import prisma from '../config/prisma.js';

export async function getSummary(empresaId = null) {
  if (empresaId) {
    // Single empresa
    const row = await prisma.$queryRaw`
      SELECT
        e.id as "empresaId",
        e.nome as "empresaNome",
        e.slug as "empresaSlug",
        COALESCE(p."pedidosMes", 0)::int as "pedidosMes",
        COALESCE(r."recebidoMes", 0)::float as "recebidoMes",
        COALESCE(a."aReceber", 0)::float as "aReceber"
      FROM "Empresa" e
      LEFT JOIN (
        SELECT "empresaId", COUNT(*)::int as "pedidosMes"
        FROM "Pedido"
        WHERE "criadoEm" >= date_trunc('month', NOW())
          AND "empresaId" = ${parseInt(empresaId)}
        GROUP BY "empresaId"
      ) p ON p."empresaId" = e.id
      LEFT JOIN (
        SELECT "empresaId", SUM(valor)::float as "recebidoMes"
        FROM "FinancialEntry"
        WHERE status = 'paid'
          AND "paidAt" >= date_trunc('month', NOW())
          AND "empresaId" = ${parseInt(empresaId)}
        GROUP BY "empresaId"
      ) r ON r."empresaId" = e.id
      LEFT JOIN (
        SELECT "empresaId", SUM(valor)::float as "aReceber"
        FROM "FinancialEntry"
        WHERE status IN ('pending', 'overdue')
          AND "empresaId" = ${parseInt(empresaId)}
        GROUP BY "empresaId"
      ) a ON a."empresaId" = e.id
      WHERE e.id = ${parseInt(empresaId)}
    `;
    if (!row.length) return null;
    const r = row[0];
    return {
      empresaId: r.empresaId,
      empresaNome: r.empresaNome,
      empresaSlug: r.empresaSlug,
      pedidosMes: r.pedidosMes,
      recebidoMes: r.recebidoMes,
      aReceber: r.aReceber,
      ticketMedio: r.pedidosMes > 0 ? r.recebidoMes / r.pedidosMes : 0,
    };
  }

  // Global summary
  const totalEmpresas = await prisma.empresa.count();
  const empresasAtivas = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT p."empresaId")::int as count
    FROM "Pedido" p
    WHERE p."criadoEm" > NOW() - INTERVAL '30 days'
  `;
  const pedidosMes = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Pedido"
    WHERE "criadoEm" >= date_trunc('month', NOW())
  `;
  const pedidosHoje = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Pedido"
    WHERE "criadoEm" >= CURRENT_DATE
  `;
  const recebidoMes = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0)::float as total
    FROM "FinancialEntry"
    WHERE status = 'paid'
      AND "paidAt" >= date_trunc('month', NOW())
  `;
  const aReceber = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0)::float as total
    FROM "FinancialEntry"
    WHERE status IN ('pending', 'overdue')
  `;

  const pedidosMesCount = pedidosMes[0]?.count || 0;
  const recebidoMesVal = recebidoMes[0]?.total || 0;

  return {
    totalEmpresas,
    empresasAtivas: empresasAtivas[0]?.count || 0,
    pedidosMes: pedidosMesCount,
    pedidosHoje: pedidosHoje[0]?.count || 0,
    recebidoMes: recebidoMesVal,
    aReceber: aReceber[0]?.total || 0,
    ticketMedio: pedidosMesCount > 0 ? recebidoMesVal / pedidosMesCount : 0,
  };
}

export async function getEmpresas() {
  const rows = await prisma.$queryRaw`
    SELECT
      e.id,
      e.nome,
      e.slug,
      COALESCE(p."pedidosMes", 0)::int as "pedidosMes",
      COALESCE(r."recebidoMes", 0)::float as "recebidoMes",
      COALESCE(a."aReceber", 0)::float as "aReceber",
      CASE WHEN EXISTS (
        SELECT 1 FROM "Pedido" WHERE "empresaId" = e.id AND "criadoEm" > NOW() - INTERVAL '30 days'
      ) THEN 'ativa' ELSE 'inativa' END as status
    FROM "Empresa" e
    LEFT JOIN (
      SELECT "empresaId", COUNT(*)::int as "pedidosMes"
      FROM "Pedido"
      WHERE "criadoEm" >= date_trunc('month', NOW())
      GROUP BY "empresaId"
    ) p ON p."empresaId" = e.id
    LEFT JOIN (
      SELECT "empresaId", SUM(valor)::float as "recebidoMes"
      FROM "FinancialEntry"
      WHERE status = 'paid' AND "paidAt" >= date_trunc('month', NOW())
      GROUP BY "empresaId"
    ) r ON r."empresaId" = e.id
    LEFT JOIN (
      SELECT "empresaId", SUM(valor)::float as "aReceber"
      FROM "FinancialEntry"
      WHERE status IN ('pending', 'overdue')
      GROUP BY "empresaId"
    ) a ON a."empresaId" = e.id
    ORDER BY e.nome
  `;
  return rows.map(r => ({
    id: r.id,
    nome: r.nome,
    slug: r.slug,
    pedidosMes: r.pedidosMes,
    recebidoMes: r.recebidoMes,
    aReceber: r.aReceber,
    status: r.status,
  }));
}
```

---

### Task 2: Backend Controller (CJS)

**Files:**
- Create: `backend/src/controllers/superadminDashboardController.js`

**Interfaces:**
- Consumes: `getSummary(empresaId)`, `getEmpresas()` from Task 1
- Produces: `getSummary(req, res)`, `getEmpresas(req, res)`

- [ ] **Step 1: Create controller file**

```javascript
// backend/src/controllers/superadminDashboardController.js (CJS)
const { getSummary, getEmpresas } = require('../services/superadminDashboardService');

async function getSummaryController(req, res) {
  try {
    const { empresaId } = req.query;
    const summary = await getSummary(empresaId ? parseInt(empresaId) : null);
    if (!summary) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }
    res.json(summary);
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Erro ao carregar resumo do dashboard' });
  }
}

async function getEmpresasController(req, res) {
  try {
    const empresas = await getEmpresas();
    res.json({ empresas });
  } catch (err) {
    console.error('Dashboard empresas error:', err);
    res.status(500).json({ error: 'Erro ao carregar empresas do dashboard' });
  }
}

module.exports = { getSummaryController, getEmpresasController };
```

---

### Task 3: Backend Routes (CJS)

**Files:**
- Create: `backend/src/routes/superadminDashboardRoutes.js`

**Interfaces:**
- Consumes: `getSummaryController`, `getEmpresasController` from Task 2
- Produces: Express Router mounted at `/api/admin/dashboard`

- [ ] **Step 1: Create routes file**

```javascript
// backend/src/routes/superadminDashboardRoutes.js (CJS)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getSummaryController, getEmpresasController } = require('../controllers/superadminDashboardController');

const router = Router();

router.get('/summary', authenticate, authorize('superadmin'), getSummaryController);
router.get('/empresas', authenticate, authorize('superadmin'), getEmpresasController);

module.exports = router;
```

---

### Task 4: Mount Routes in app.js

**Files:**
- Modify: `backend/src/app.js:33-34` (add require) and `backend/src/app.js:111-112` (add use)

**Interfaces:**
- Consumes: `superadminDashboardRoutes` from Task 3

- [ ] **Step 1: Add require after line 34**

At `backend/src/app.js`, after line 34 (`const marketplaceWebhookRoutes = require('./routes/marketplaceWebhookRoutes');`), add:

```javascript
const superadminDashboardRoutes = require('./routes/superadminDashboardRoutes');
```

- [ ] **Step 2: Add route mounting after line 112**

At `backend/src/app.js`, after line 112 (`app.use('/api/webhooks', marketplaceWebhookRoutes);`), add:

```javascript
app.use('/api/admin/dashboard', superadminDashboardRoutes);
```

---

### Task 5: Frontend JS (IIFE)

**Files:**
- Create: `js/superadminDashboard.js`

**Interfaces:**
- Consumes: `GET /api/admin/dashboard/summary`, `GET /api/admin/dashboard/empresas`
- Produces: `carregarDashboard()`, `carregarEmpresasDashboard()`, `onEmpresaChange()`

- [ ] **Step 1: Create JS file**

```javascript
// js/superadminDashboard.js
(function() {
  const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';

  function getToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('authUser'));
      return auth?.token;
    } catch { return null; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatCurrency(val) {
    return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  async function apiFetch(path) {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  async function carregarEmpresasDashboard() {
    try {
      const data = await apiFetch('/api/admin/dashboard/empresas');
      const select = document.getElementById('dashEmpresaSelect');
      if (!select || !data.empresas) return;
      select.innerHTML = '<option value="">Todas as Empresas (Visão Geral)</option>';
      data.empresas.forEach(function(e) {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nome + ' (' + e.slug + ')' + (e.status === 'inativa' ? ' - Inativa' : '');
        select.appendChild(opt);
      });
    } catch (err) {
      console.error('Erro ao carregar empresas do dashboard:', err);
    }
  }

  async function carregarDashboard() {
    try {
      const select = document.getElementById('dashEmpresaSelect');
      const empresaId = select?.value || '';
      const params = empresaId ? '?empresaId=' + empresaId : '';
      const summary = await apiFetch('/api/admin/dashboard/summary' + params);

      const badge = document.getElementById('dashEmpresaBadge');
      const title = document.getElementById('dashTitle');
      const cardsContainer = document.getElementById('dashCards');
      const tableCard = document.getElementById('dashTableCard');

      if (empresaId && summary.empresaNome) {
        // Single empresa view
        badge.innerHTML = '<i class="fas fa-building"></i> ' + escapeHtml(summary.empresaNome);
        title.textContent = summary.empresaNome + ' - ' + summary.empresaSlug;
        cardsContainer.innerHTML = [
          { icon: 'fa-shopping-cart', value: summary.pedidosMes, label: 'PEDIDOS NO MÊS' },
          { icon: 'fa-check-circle', value: formatCurrency(summary.recebidoMes), label: 'RECEBIDO NO MÊS' },
          { icon: 'fa-hourglass-half', value: formatCurrency(summary.aReceber), label: 'A RECEBER' },
          { icon: 'fa-receipt', value: formatCurrency(summary.ticketMedio), label: 'TICKET MÉDIO' },
        ].map(function(c) {
          return '<div class="dash-card"><div class="dash-card-icon"><i class="fas ' + c.icon + '"></i></div><div class="dash-card-value">' + c.value + '</div><div class="dash-card-label">' + c.label + '</div></div>';
        }).join('');
        tableCard.style.display = 'none';
      } else {
        // Global view
        badge.innerHTML = '<i class="fas fa-globe"></i> Global';
        title.textContent = 'Visão Geral do SaaS';
        cardsContainer.innerHTML = [
          { icon: 'fa-store', value: summary.totalEmpresas, label: 'TOTAL EMPRESAS' },
          { icon: 'fa-bolt', value: summary.empresasAtivas, label: 'EMPRESAS ATIVAS' },
          { icon: 'fa-shopping-cart', value: summary.pedidosMes, label: 'PEDIDOS NO MÊS' },
          { icon: 'fa-calendar-day', value: summary.pedidosHoje, label: 'PEDIDOS HOJE' },
          { icon: 'fa-check-circle', value: formatCurrency(summary.recebidoMes), label: 'RECEBIDO NO MÊS' },
          { icon: 'fa-hourglass-half', value: formatCurrency(summary.aReceber), label: 'A RECEBER' },
          { icon: 'fa-receipt', value: formatCurrency(summary.ticketMedio), label: 'TICKET MÉDIO' },
        ].map(function(c) {
          return '<div class="dash-card"><div class="dash-card-icon"><i class="fas ' + c.icon + '"></i></div><div class="dash-card-value">' + c.value + '</div><div class="dash-card-label">' + c.label + '</div></div>';
        }).join('');
        tableCard.style.display = '';
        await renderEmpresasTable();
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    }
  }

  async function renderEmpresasTable() {
    try {
      const data = await apiFetch('/api/admin/dashboard/empresas');
      const tbody = document.getElementById('dashEmpresasBody');
      if (!tbody || !data.empresas) return;
      tbody.innerHTML = data.empresas.map(function(e) {
        var statusClass = e.status === 'ativa' ? 'status-active' : 'status-inactive';
        return '<tr>' +
          '<td><div class="empresa-name">' + escapeHtml(e.nome) + '</div><div class="empresa-slug">' + escapeHtml(e.slug) + '</div></td>' +
          '<td>' + e.pedidosMes + '</td>' +
          '<td class="amount-positive">' + formatCurrency(e.recebidoMes) + '</td>' +
          '<td class="amount-pending">' + formatCurrency(e.aReceber) + '</td>' +
          '<td><span class="status-badge ' + statusClass + '">' + (e.status === 'ativa' ? 'Ativa' : 'Inativa') + '</span></td>' +
          '</tr>';
      }).join('');
    } catch (err) {
      console.error('Erro ao renderizar tabela:', err);
    }
  }

  // Expose globally for superadmin.html onclick
  window.carregarDashboard = carregarDashboard;
  window.onEmpresaChange = function() { carregarDashboard(); };

  // Auto-load on script parse
  document.addEventListener('DOMContentLoaded', function() {
    carregarEmpresasDashboard().then(carregarDashboard);
  });
})();
```

---

### Task 6: Frontend HTML Modifications

**Files:**
- Modify: `superadmin.html` (add Dashboard tab + tab-content + dark theme CSS + script tag)

**Interfaces:**
- Consumes: `carregarDashboard()`, `onEmpresaChange()` from Task 5

- [ ] **Step 1: Add dark theme CSS**

At the top of `superadmin.html`, inside `<head>`, after the existing `<link>` tags (after line 12), add:

```html
<style>
  /* Superadmin Dashboard dark theme override */
  body { background: var(--secondary, #0E100F); color: var(--text, #FFFCE1); }
  .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
  .tabs .tab { padding: 10px 20px; border: 1px solid #333; border-radius: 8px; background: transparent; color: #7C7C6F; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px; }
  .tabs .tab.active { background: var(--primary, #F26D3D); color: white; border-color: var(--primary, #F26D3D); }
  .empresa-selector { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 14px 20px; background: var(--surface, #191919); border-radius: 16px; border: 1px solid #2a2a2a; }
  .empresa-selector label { font-size: 12px; color: #7C7C6F; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
  .empresa-selector select { flex: 1; padding: 8px 12px; border: 1px solid #333; border-radius: 8px; background: #111; color: var(--text, #FFFCE1); font-size: 13px; font-family: inherit; font-weight: 500; cursor: pointer; }
  .empresa-selector select:focus { outline: none; border-color: var(--primary, #F26D3D); }
  .empresa-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(242,109,61,0.15); color: var(--primary, #F26D3D); }
  .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .dash-header h2 { font-size: 14px; font-weight: 600; color: #7C7C6F; }
  .btn-refresh { padding: 8px 16px; border: 1px solid #333; border-radius: 8px; background: transparent; color: var(--text, #FFFCE1); font-size: 12px; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px; }
  .dash-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .dash-card { background: var(--surface, #191919); border-radius: 16px; padding: 20px; border-left: 4px solid var(--primary, #F26D3D); }
  .dash-card-icon { font-size: 20px; color: var(--primary, #F26D3D); margin-bottom: 8px; opacity: 0.8; }
  .dash-card-value { font-size: 28px; font-weight: 800; color: var(--text, #FFFCE1); line-height: 1.2; }
  .dash-card-label { font-size: 11px; color: #7C7C6F; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .dash-table-card { background: var(--surface, #191919); border-radius: 16px; padding: 20px; }
  .dash-table-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .dash-table-card h3 i { color: var(--primary, #F26D3D); }
  .dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .dash-table th { text-align: left; padding: 12px; color: #7C7C6F; font-weight: 600; border-bottom: 1px solid #2a2a2a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .dash-table td { padding: 14px 12px; border-bottom: 1px solid #1e1e1e; }
  .empresa-name { font-weight: 700; }
  .empresa-slug { font-size: 11px; color: #7C7C6F; font-family: monospace; }
  .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .status-active { background: rgba(16,185,129,0.15); color: #10B981; }
  .status-inactive { background: rgba(124,124,111,0.15); color: #7C7C6F; }
  .amount-positive { color: #10B981; font-weight: 600; }
  .amount-pending { color: #F59E0B; font-weight: 600; }
  @media (max-width: 1024px) { .dash-cards { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .dash-cards { grid-template-columns: 1fr; } .dash-card-value { font-size: 22px; } }
</style>
```

- [ ] **Step 2: Add Dashboard tab button**

At `superadmin.html:18-26`, replace the tabs div content. Add Dashboard as first button before Usuários:

```html
<div class="tabs">
  <button class="tab active" onclick="switchTab('dashboard',this)"><i class="fas fa-chart-line"></i> Dashboard</button>
  <button class="tab" onclick="switchTab('usuarios',this)"><i class="fas fa-users"></i> Usuários</button>
  <button class="tab" onclick="switchTab('senhas',this)"><i class="fas fa-key"></i> Gerenciar Senhas</button>
  <button class="tab" onclick="switchTab('registros',this)"><i class="fas fa-scroll"></i> Registros</button>
  <button class="tab" onclick="switchTab('clientes',this)"><i class="fas fa-user-tie"></i> Clientes</button>
  <button class="tab" onclick="switchTab('empresas',this)"><i class="fas fa-store"></i> Empresas</button>
  <button class="tab" onclick="switchTab('settlements',this)"><i class="fas fa-dollar-sign"></i> Settlements</button>
  <button class="tab" onclick="switchTab('integracoes',this)"><i class="fas fa-plug"></i> Integrações</button>
</div>
```

- [ ] **Step 3: Add Dashboard tab-content div**

After the closing `</div>` of the tabs div (after the new tabs block), before `<!-- Users tab -->`, add:

```html
<!-- Dashboard tab -->
<div class="tab-content active" id="tabDashboard">
  <div class="empresa-selector">
    <label><i class="fas fa-building"></i> Visualizar:</label>
    <select id="dashEmpresaSelect" onchange="onEmpresaChange()">
      <option value="">Todas as Empresas (Visão Geral)</option>
    </select>
    <span class="empresa-badge" id="dashEmpresaBadge"><i class="fas fa-globe"></i> Global</span>
  </div>
  <div class="dash-header">
    <h2 id="dashTitle">Visão Geral do SaaS</h2>
    <button class="btn-refresh" onclick="carregarDashboard()"><i class="fas fa-sync-alt"></i> Atualizar</button>
  </div>
  <div class="dash-cards" id="dashCards"></div>
  <div class="dash-table-card" id="dashTableCard">
    <h3><i class="fas fa-building"></i> Empresas - Resumo Financeiro</h3>
    <table class="dash-table">
      <thead><tr><th>Empresa</th><th>Pedidos Mês</th><th>Recebido</th><th>A Receber</th><th>Status</th></tr></thead>
      <tbody id="dashEmpresasBody"></tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 4: Add script tag**

At the bottom of `superadmin.html`, before the closing `</body>` tag (before line 684), add:

```html
<script src="js/superadminDashboard.js"></script>
```

- [ ] **Step 5: Add dashboard to switchTab map**

At `superadmin.html:276`, the `map` object maps tab names to tab-content IDs. Add `dashboard`:

Change line 276 from:
```javascript
const map = { usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', registros: 'tabRegistros', clientes: 'tabClientes', settlements: 'tabSettlements', integracoes: 'tabIntegracoes' };
```
To:
```javascript
const map = { dashboard: 'tabDashboard', usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', registros: 'tabRegistros', clientes: 'tabClientes', settlements: 'tabSettlements', integracoes: 'tabIntegracoes' };
```

- [ ] **Step 6: Add dashboard to activarTabPorQuery**

At `superadmin.html:645`, add `'dashboard'` to the valid tabs list:

Change line 645 from:
```javascript
if (tab && ['usuarios', 'senhas', 'clientes', 'registros', 'empresas', 'settlements', 'integracoes'].includes(tab)) {
```
To:
```javascript
if (tab && ['dashboard', 'usuarios', 'senhas', 'clientes', 'registros', 'empresas', 'settlements', 'integracoes'].includes(tab)) {
```

---

### Task 7: Verify and Test

- [ ] **Step 1: Start backend**

```bash
cd backend && node server.js
```

Expected: Server starts on port 3000, no errors.

- [ ] **Step 2: Test API endpoints**

```bash
# Get token first
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}'

# Test global summary (use token from above)
curl http://localhost:3000/api/admin/dashboard/summary -H "Authorization: Bearer <TOKEN>"

# Test empresas list
curl http://localhost:3000/api/admin/dashboard/empresas -H "Authorization: Bearer <TOKEN>"

# Test single empresa
curl "http://localhost:3000/api/admin/dashboard/summary?empresaId=2" -H "Authorization: Bearer <TOKEN>"
```

Expected: JSON responses matching spec shapes.

- [ ] **Step 3: Open browser**

Navigate to `http://localhost:3000/superadmin.html`, login as djesus/tsa110594.

Expected: Dashboard tab active, 7 cards loaded, empresa selector populated, table shows 4 empresas.

- [ ] **Step 4: Test empresa selector**

Select "Salgados Costa" from dropdown.

Expected: Cards change to 4 (Pedidos Mês, Recebido, A Receber, Ticket Médio), table hidden, badge shows "Salgados Costa".

Select "Todas as Empresas" again.

Expected: Returns to global view with 7 cards + table.
