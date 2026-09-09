# Admin Criar Filiais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin (papel `admin`) to create filiais under their matriz store, with superadmin approval workflow.

**Architecture:** 3-layer approach — Prisma schema change → backend (routes + controller + repository) → frontend (admin filiais page + superadmin fixes + auth response). Each layer is independently testable.

**Tech Stack:** Node/Express, Prisma ORM, PostgreSQL, vanilla HTML/JS, Playwright for testing.

## Global Constraints

- `empresaTipo !== 'filial'` = "can create filiais" (matriz definition)
- Filiais created by admin → `status='pending'` (not usable until superadmin approves)
- Filiais created by superadmin → `status='active'` (direct)
- Soft delete preserves all data (pedidos, financeiro, settlements)
- Admin ownership: `parentEmpresaId === req.user.empresaId`
- Superadmin-only: approve, list pending
- Platform: `FOOD99` (env vars)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema.prisma` | Modify:11-79 | Add `status`, `createdBy`, `justificativa`, `createdByUser` relation |
| `backend/src/routes/adminRoutes.js` | Modify:29-35 | Reorder filiais routes before superadmin gate |
| `backend/src/controllers/adminController.js` | Modify:169-212 | Update `criarFilial`, add `aprovarFilial`, `deletarFilial`, `listarFiliaisPendentes` |
| `backend/src/repositories/sqlRepository.js` | Modify:302-339 | Update `criarFilial`, `listarFiliais`, add `aprovarFilial`, `listarFiliaisPendentes` |
| `backend/src/services/authService.js` | Modify:95-116 | Add `empresaId`, `empresaTipo` to login response |
| `filiais.html` | Create | Admin filiais management page |
| `js/filiais.js` | Create | Frontend logic for filiais.html |
| `js/superadminDashboard.js` | Modify:116-217 | Fix URL, add approve/delete, update form |
| `superadmin.html` | Modify | Add filiais table with expanded columns |
| `dashboard.html` | Modify:140 | Fix menu check: `!== 'filial'` |
| `login.html` | Modify | authUser spread includes `empresaId`, `empresaTipo` |

---

## Task 1: Prisma Schema Change

**Files:**
- Modify: `backend/prisma/schema.prisma:11-79`

**Interfaces:**
- Consumes: none (foundation)
- Produces: Empresa model with `status`, `createdBy`, `justificativa`, `createdByUser` relation

- [ ] **Step 1: Add fields to Empresa model**

Open `backend/prisma/schema.prisma`, find `model Empresa` block. Add after line 76 (`themeApproved`):

```prisma
   status          String    @default("active") @map("status")
   createdBy       Int?      @map("created_by")
   justificativa   String?   @map("justificativa")
   createdByUser   Usuario?  @relation("FilialCreator", fields: [createdBy], references: [id])
```

- [ ] **Step 2: Add reverse relation to Usuario model**

Open `backend/prisma/schema.prisma`, find `model Usuario`. Add after existing relations:

```prisma
   createdFiliais  Empresa[] @relation("FilialCreator")
```

- [ ] **Step 3: Validate and generate**

```bash
cd backend && npx prisma validate
```

Expected: `✔ Validated the Prisma schema`

```bash
cd backend && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Create migration**

```bash
cd backend && npx prisma migrate dev --name add-filiais-status-createdby
```

Expected: Migration created, applied successfully.

---

## Task 2: Backend Repository Updates

**Files:**
- Modify: `backend/src/repositories/sqlRepository.js:302-339`

**Interfaces:**
- Consumes: Prisma Empresa model (Task 1)
- Produces: `criarFilial`, `listarFiliais`, `aprovarFilial`, `listarFiliaisPendentes`

- [ ] **Step 1: Update `criarFilial` to accept new fields**

Find `criarFilial` (line 309). Replace with:

```js
  async criarFilial(data) {
    const { parentEmpresaId, themeSettingsPai, status, createdBy, justificativa } = data;
    return prisma.empresa.create({
      data: {
        nome: data.nome,
        slug: data.slug,
        parentEmpresaId: Number(parentEmpresaId),
        empresaTipo: 'filial',
        themeSettings: themeSettingsPai || null,
        themeApproved: true,
        status: status || 'active',
        createdBy: createdBy || null,
        justificativa: justificativa || null,
      },
    });
  },
```

- [ ] **Step 2: Update `listarFiliais` to filter deleted**

Find `listarFiliais` (line 303). Add `deletedAt: null`:

```js
  async listarFiliais(parentEmpresaId) {
    return prisma.empresa.findMany({
      where: { parentEmpresaId: Number(parentEmpresaId), deletedAt: null },
      orderBy: { nome: 'asc' },
    });
  },
```

- [ ] **Step 3: Add `aprovarFilial`**

After `verificarLoopFilial`, add:

```js
  async aprovarFilial(id) {
    return prisma.empresa.update({
      where: { id: Number(id) },
      data: { status: 'active' },
    });
  },
```

- [ ] **Step 4: Add `listarFiliaisPendentes`**

After `aprovarFilial`, add:

```js
  async listarFiliaisPendentes() {
    return prisma.empresa.findMany({
      where: { status: 'pending', empresaTipo: 'filial', deletedAt: null },
      include: {
        parentEmpresa: { select: { id: true, nome: true, slug: true } },
        createdByUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
```

- [ ] **Step 5: Verify syntax**

```bash
cd backend && node -e "require('./src/repositories/sqlRepository')"
```

Expected: No output (no syntax error).

---

## Task 3: Backend Controller Updates

**Files:**
- Modify: `backend/src/controllers/adminController.js:169-253`

**Interfaces:**
- Consumes: repository functions (Task 2)
- Produces: controller functions for routes

- [ ] **Step 1: Update `criarFilial` controller**

Find `exports.criarFilial` (line 171). Replace entire function:

```js
exports.criarFilial = asyncHandler(async (req, res) => {
  const { nome, justificativa } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const isSuperadmin = req.user.role === 'superadmin';

  // Superadmin: must send parentEmpresaId
  let parentEmpresaId;
  if (isSuperadmin) {
    parentEmpresaId = Number(req.body.parentEmpresaId);
    if (!parentEmpresaId || !Number.isInteger(parentEmpresaId)) {
      return res.status(400).json({ error: 'parentEmpresaId é obrigatório' });
    }
  } else {
    // Admin: force own empresa
    parentEmpresaId = req.user.empresaId;
  }

  // Verify matriz exists and is not filial
  const matriz = await sql.buscarEmpresa(parentEmpresaId);
  if (!matriz) {
    return res.status(404).json({ error: 'Matriz não encontrada' });
  }
  if (!isSuperadmin && matriz.empresaTipo === 'filial') {
    return res.status(403).json({ error: 'Somente loja matriz pode criar filiais' });
  }

  // Verify loop
  const isLoop = await sql.verificarLoopFilial(parentEmpresaId, parentEmpresaId);
  if (isLoop) {
    return res.status(400).json({ error: 'Loop de vínculo detectado' });
  }

  // Generate slug from name
  const slugNorm = normalizarSlug(nome);
  if (!slugNorm) {
    return res.status(400).json({ error: 'Nome inválido para slug' });
  }
  const existente = await sql.buscarEmpresaPorSlug(slugNorm);
  if (existente) {
    return res.status(409).json({ error: 'Já existe loja com esse nome' });
  }

  // Create filial
  const filial = await sql.criarFilial({
    nome: nome.trim(),
    slug: slugNorm,
    parentEmpresaId,
    themeSettingsPai: matriz.themeSettings,
    status: isSuperadmin ? 'active' : 'pending',
    createdBy: req.user.id,
    justificativa: justificativa || null,
  });

  try { invalidateEmpresaCache(slugNorm); } catch (e) {}
  res.status(201).json(filial);
});
```

- [ ] **Step 2: Add `aprovarFilial` controller**

After `criarFilial`, add:

```js
exports.aprovarFilial = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const filial = await sql.buscarEmpresa(id);
  if (!filial) {
    return res.status(404).json({ error: 'Filial não encontrada' });
  }
  if (filial.empresaTipo !== 'filial') {
    return res.status(400).json({ error: 'Empresa não é filial' });
  }
  if (filial.status === 'active') {
    return res.status(400).json({ error: 'Filial já está ativa' });
  }

  const atualizada = await sql.aprovarFilial(id);
  try { invalidateEmpresaCache(filial.slug); } catch (e) {}
  res.json(atualizada);
});
```

- [ ] **Step 3: Add `deletarFilial` controller**

After `aprovarFilial`, add:

```js
exports.deletarFilial = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const filial = await sql.buscarEmpresa(id);
  if (!filial) {
    return res.status(404).json({ error: 'Filial não encontrada' });
  }
  if (filial.empresaTipo !== 'filial') {
    return res.status(400).json({ error: 'Empresa não é filial' });
  }

  // Admin: can only delete own filiais
  if (req.user.role === 'admin' && filial.parentEmpresaId !== req.user.empresaId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  await sql.softDeleteEmpresa(id);
  try { invalidateEmpresaCache(filial.slug); } catch (e) {}
  res.json({ success: true, message: 'Filial removida (soft delete)' });
});
```

- [ ] **Step 4: Add `listarFiliaisPendentes` controller**

After `deletarFilial`, add:

```js
exports.listarFiliaisPendentes = asyncHandler(async (req, res) => {
  const filiais = await sql.listarFiliaisPendentes();
  res.json(filiais);
});
```

- [ ] **Step 5: Add ownership check to `atualizarParent`**

Find `exports.atualizarParent` (line 229). Add after line 238 (`if (!empresa)`):

```js
  // Admin: can only update own filiais
  if (req.user.role === 'admin' && empresa.parentEmpresaId !== req.user.empresaId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
```

- [ ] **Step 6: Verify syntax**

```bash
cd backend && node -e "require('./src/controllers/adminController')"
```

Expected: No output (no syntax error).

---

## Task 4: Backend Routes Restructure

**Files:**
- Modify: `backend/src/routes/adminRoutes.js:29-35`

**Interfaces:**
- Consumes: controller functions (Task 3)
- Produces: route definitions

- [ ] **Step 1: Reorder filiais routes before superadmin gate**

Find lines 29-35 (filiais routes inside superadmin block). Move them BEFORE `router.use(authenticate, authorize('superadmin'))` (line 15):

```js
const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const authService = require('../services/authService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const clientAdminController = require('../controllers/clientAdminController');
const orderController = require('../controllers/orderController');
const adminController = require('../controllers/adminController');

const router = Router();

// Filiais routes (before superadmin gate)
router.post('/filiais', authenticate, authorize('superadmin', 'admin'), adminController.criarFilial);
router.get('/filiais/pendentes', authenticate, authorize('superadmin'), adminController.listarFiliaisPendentes);
router.get('/empresas/:id/filiais', authenticate, authorize('superadmin', 'admin'), adminController.listarFiliais);
router.put('/filiais/:id/approve', authenticate, authorize('superadmin'), adminController.aprovarFilial);
router.delete('/filiais/:id', authenticate, authorize('superadmin', 'admin'), adminController.deletarFilial);
router.put('/empresas/:id/parent', authenticate, authorize('superadmin', 'admin'), adminController.atualizarParent);

router.get('/pedidos/preview-limpeza', authenticate, authorize('superadmin', 'admin'), orderController.previewLimpeza);
router.post('/pedidos/limpar-expirados', authenticate, authorize('superadmin', 'admin'), orderController.executarLimpeza);

router.use(authenticate, authorize('superadmin'));

router.get('/', adminController.listar);
router.post('/', adminController.criar);
router.put('/:id', adminController.atualizar);
router.delete('/:id', adminController.deletar);

router.get('/clientes', clientAdminController.listar);
router.put('/clientes/:id', clientAdminController.atualizar);
router.put('/clientes/:id/password', clientAdminController.resetarSenha);
router.delete('/clientes/:id', clientAdminController.deletar);

router.delete('/empresa/:id/payment', adminController.deactivatePayment);

router.put('/empresas/:id/theme/pending', adminController.enviarTemaPendente);
router.put('/empresas/:id/theme/approve', adminController.aprovarTema);

module.exports = router;
```

- [ ] **Step 2: Verify syntax**

```bash
cd backend && node -e "require('./src/routes/adminRoutes')"
```

Expected: No output (no syntax error).

---

## Task 5: Auth Login Response

**Files:**
- Modify: `backend/src/services/authService.js:95-116`

**Interfaces:**
- Consumes: Empresa model (Task 1)
- Produces: login response with `empresaId`, `empresaTipo`

- [ ] **Step 1: Update login function to fetch empresa data**

Find line 94-116 (the payload and return). Replace:

```js
  // Superadmin sempre empresaId null (acesso global)
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    empresaId: user.role === 'superadmin' ? null : user.empresaId,
    lojaNome: user.lojaNome || null,
  };
  const token = tokenService.gerarToken(payload);
  const refreshToken = tokenService.gerarRefreshToken(payload);

  // Fetch empresa for empresaTipo
  let empresaTipo = null;
  if (user.empresaId) {
    const empresa = await sql.buscarEmpresa(user.empresaId);
    if (empresa) empresaTipo = empresa.empresaTipo;
  }

  auditService.audit({
    ...base,
    action: 'auth.login',
    module: 'auth',
    actorType: 'admin',
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
  });

  return {
    token, refreshToken,
    user: {
      id: user.id, username: user.username, role: user.role,
      lojaNome: user.lojaNome || null,
      empresaId: user.role === 'superadmin' ? null : user.empresaId,
      empresaTipo,
    },
  };
```

- [ ] **Step 2: Verify syntax**

```bash
cd backend && node -e "require('./src/services/authService')"
```

Expected: No output (no syntax error).

---

## Task 6: Admin Filiais Page (HTML + JS)

**Files:**
- Create: `filiais.html`
- Create: `js/filiais.js`

**Interfaces:**
- Consumes: backend routes (Task 4)
- Produces: admin filiais management UI

- [ ] **Step 1: Create `filiais.html`**

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gerenciar Filiais</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="css/tokens.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .header h2 { font-size: 20px; font-weight: 600; }
    .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; }
    .btn-primary { background: #22c55e; color: #000; }
    .btn-danger { background: transparent; border: 1px solid #EF4444; color: #EF4444; }
    .btn-secondary { background: transparent; border: 1px solid #333; color: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #1a1a1a; }
    th { color: #7C7C6F; font-size: 11px; text-transform: uppercase; font-weight: 600; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-pending { background: #F59E0B20; color: #F59E0B; }
    .badge-active { background: #22c55e20; color: #22c55e; }
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
    .modal-overlay.active { display: flex; }
    .modal-box { background: #111; border: 1px solid #333; border-radius: 8px; padding: 24px; width: 90%; max-width: 400px; }
    .modal-box h3 { margin-bottom: 16px; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; margin-bottom: 4px; font-size: 12px; color: #7C7C6F; }
    .form-group input, .form-group textarea { width: 100%; padding: 8px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #fff; font-size: 13px; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    .empty { color: #7C7C6F; text-align: center; padding: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <h2><i class="fas fa-sitemap"></i> Gerenciar Filiais</h2>
    <button class="btn btn-primary" onclick="abrirModalCriar()"><i class="fas fa-plus"></i> Criar Filial</button>
  </div>

  <table>
    <thead>
      <tr>
        <th>Nome</th>
        <th>Slug</th>
        <th>Status</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody id="filiaisBody">
      <tr><td colspan="4" class="empty">Carregando...</td></tr>
    </tbody>
  </table>

  <!-- Modal Criar Filial -->
  <div class="modal-overlay" id="modalCriar">
    <div class="modal-box">
      <h3>Criar Filial</h3>
      <div class="form-group">
        <label>Nome da filial</label>
        <input type="text" id="filialNome" placeholder="Ex: Loja Centro">
      </div>
      <div class="form-group">
        <label>Justificativa (opcional)</label>
        <textarea id="filialJustificativa" rows="2" placeholder="Ex: expansão bairro X"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="criarFilial()">Criar</button>
      </div>
    </div>
  </div>

  <script src="js/filiais.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/filiais.js`**

```js
(function() {
  const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';

  function getToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('authUser'));
      return auth?.token;
    } catch { return null; }
  }

  function getAuthUser() {
    try {
      return JSON.parse(localStorage.getItem('authUser'));
    } catch { return null; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'API ' + res.status);
    }
    return res.json();
  }

  async function carregarFiliais() {
    const tbody = document.getElementById('filiaisBody');
    const authUser = getAuthUser();
    const empresaId = authUser?.empresaId;

    if (!empresaId) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Empresa não identificada</td></tr>';
      return;
    }

    try {
      const filiais = await apiFetch('/api/admin/empresas/' + empresaId + '/filiais');
      if (filiais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhuma filial criada</td></tr>';
        return;
      }
      tbody.innerHTML = filiais.map(function(f) {
        var statusClass = f.status === 'active' ? 'badge-active' : 'badge-pending';
        var statusLabel = f.status === 'active' ? 'Ativa' : 'Pendente';
        return '<tr>' +
          '<td>' + escapeHtml(f.nome) + '</td>' +
          '<td>' + escapeHtml(f.slug) + '</td>' +
          '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
          '<td>' +
            '<button class="btn btn-secondary" onclick="desvincular(' + f.id + ')" style="margin-right:8px;"><i class="fas fa-unlink"></i> Desvincular</button>' +
            '<button class="btn btn-danger" onclick="excluir(' + f.id + ')"><i class="fas fa-trash"></i> Excluir</button>' +
          '</td>' +
          '</tr>';
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Erro ao carregar filiais: ' + escapeHtml(err.message) + '</td></tr>';
    }
  }

  window.abrirModalCriar = function() {
    document.getElementById('modalCriar').classList.add('active');
  };

  window.fecharModal = function() {
    document.getElementById('modalCriar').classList.remove('active');
    document.getElementById('filialNome').value = '';
    document.getElementById('filialJustificativa').value = '';
  };

  window.criarFilial = async function() {
    var nome = document.getElementById('filialNome').value.trim();
    var justificativa = document.getElementById('filialJustificativa').value.trim();

    if (!nome) {
      alert('Nome é obrigatório');
      return;
    }

    try {
      await apiFetch('/api/admin/filiais', {
        method: 'POST',
        body: JSON.stringify({ nome, justificativa: justificativa || undefined }),
      });
      window.fecharModal();
      carregarFiliais();
      alert('Filial criada! Aguardando aprovação do superadmin.');
    } catch (err) {
      alert('Erro ao criar filial: ' + err.message);
    }
  };

  window.desvincular = async function(id) {
    if (!confirm('Tem certeza que deseja desvincular esta filial?')) return;
    try {
      await apiFetch('/api/admin/empresas/' + id + '/parent', {
        method: 'PUT',
        body: JSON.stringify({ parentEmpresaId: null }),
      });
      carregarFiliais();
      alert('Filial desvinculada!');
    } catch (err) {
      alert('Erro ao desvincular: ' + err.message);
    }
  };

  window.excluir = async function(id) {
    if (!confirm('Tem certeza que deseja excluir esta filial? Os dados serão preservados.')) return;
    try {
      await apiFetch('/api/admin/filiais/' + id, { method: 'DELETE' });
      carregarFiliais();
      alert('Filial excluída (soft delete)!');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  document.addEventListener('DOMContentLoaded', carregarFiliais);
})();
```

---

## Task 7: Dashboard Menu Fix

**Files:**
- Modify: `dashboard.html:140`

**Interfaces:**
- Consumes: `authUser.empresaTipo` from login (Task 5)
- Produces: menu visibility for filiais

- [ ] **Step 1: Fix menu check**

Find line 140:

```js
    if (authUser.empresaTipo === 'matriz') {
```

Replace with:

```js
    if (authUser.empresaTipo !== 'filial') {
```

---

## Task 8: Superadmin Dashboard Fixes

**Files:**
- Modify: `js/superadminDashboard.js:116-252`
- Modify: `superadmin.html`

**Interfaces:**
- Consumes: backend routes (Task 4)
- Produces: superadmin filiais management UI

- [ ] **Step 1: Update `carregarFiliais` to use flat list**

Find `carregarFiliais` (line 118). Replace entire function:

```js
  async function carregarFiliais() {
    var tbody = document.getElementById('filiaisTableBody');
    if (!tbody) return;
    
    try {
      // Load all empresas for matriz names
      var empresas = await apiFetch('/api/admin/empresas');
      var matrizMap = {};
      empresas.forEach(function(e) { matrizMap[e.id] = e.nome; });
      
      // Load filiais from all matrizes (flat list)
      var allFiliais = [];
      for (var i = 0; i < empresas.length; i++) {
        var e = empresas[i];
        if (e.empresaTipo !== 'filial') {
          try {
            var filiais = await apiFetch('/api/admin/empresas/' + e.id + '/filiais');
            filiais.forEach(function(f) { f._matrizNome = e.nome; });
            allFiliais = allFiliais.concat(filiais);
          } catch (err) { /* skip */ }
        }
      }
      
      tbody.innerHTML = '';
      if (allFiliais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#7C7C6F;">Nenhuma filial encontrada</td></tr>';
        return;
      }
      
      allFiliais.forEach(function(filial) {
        var statusClass = filial.status === 'active' ? 'status-active' : 'status-trial';
        var statusLabel = filial.status === 'active' ? 'Ativa' : 'Pendente';
        var tr = document.createElement('tr');
        tr.innerHTML = 
          '<td>' + escapeHtml(filial.nome) + '</td>' +
          '<td>' + escapeHtml(filial.slug) + '</td>' +
          '<td>' + escapeHtml(filial._matrizNome) + '</td>' +
          '<td>' + (filial.justificativa ? escapeHtml(filial.justificativa) : '-') + '</td>' +
          '<td>' + (filial.createdAt ? new Date(filial.createdAt).toLocaleDateString('pt-BR') : '-') + '</td>' +
          '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
          '<td>' +
            (filial.status === 'pending' ? '<button onclick="aprovarFilial(' + filial.id + ')" style="padding:4px 8px;border:1px solid #22c55e;border-radius:4px;background:transparent;color:#22c55e;font-size:12px;margin-right:4px;"><i class="fas fa-check"></i> Aprovar</button>' : '') +
            '<button onclick="excluirFilial(' + filial.id + ')" style="padding:4px 8px;border:1px solid #EF4444;border-radius:4px;background:transparent;color:#EF4444;font-size:12px;"><i class="fas fa-trash"></i> Excluir</button>' +
          '</td>';
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Erro ao carregar filiais:', err);
    }
  }
```

- [ ] **Step 2: Add `aprovarFilial` function**

After `desvincularFilial`, add:

```js
  async function aprovarFilial(id) {
    if (!confirm('Tem certeza que deseja aprovar esta filial?')) return;
    
    try {
      var token = getToken();
      var res = await fetch(API_BASE + '/api/admin/filiais/' + id + '/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      });
      
      if (!res.ok) throw new Error('Erro ao aprovar');
      
      carregarFiliais();
      alert('Filial aprovada com sucesso!');
    } catch (err) {
      alert('Erro ao aprovar: ' + err.message);
    }
  }

  async function excluirFilial(id) {
    if (!confirm('Tem certeza que deseja excluir esta filial?')) return;
    
    try {
      var token = getToken();
      var res = await fetch(API_BASE + '/api/admin/filiais/' + id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      });
      
      if (!res.ok) throw new Error('Erro ao excluir');
      
      carregarFiliais();
      alert('Filial excluída com sucesso!');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  }
```

- [ ] **Step 3: Update `criarFilial` to remove slug field**

Find `criarFilial` (line 185). Replace:

```js
  async function criarFilial() {
    var nome = document.getElementById('filialNome').value.trim();
    var justificativa = document.getElementById('filialJustificativa')?.value.trim() || '';
    var parentEmpresaId = document.getElementById('filialMatriz').value;
    
    if (!nome || !parentEmpresaId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      var token = getToken();
      var res = await fetch(API_BASE + '/api/admin/filiais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ nome: nome, justificativa: justificativa || undefined, parentEmpresaId: Number(parentEmpresaId) }),
      });
      
      if (!res.ok) {
        var err = await res.json();
        throw new Error(err.error || 'Erro ao criar filial');
      }
      
      document.getElementById('modalCriarFilial').style.display = 'none';
      document.getElementById('filialNome').value = '';
      if (document.getElementById('filialJustificativa')) document.getElementById('filialJustificativa').value = '';
      document.getElementById('filialMatriz').value = '';
      carregarFiliais();
      alert('Filial criada com sucesso!');
    } catch (err) {
      alert('Erro ao criar filial: ' + err.message);
    }
  }
```

- [ ] **Step 4: Expose new functions globally**

Find line 239-242. Add:

```js
  window.aprovarFilial = aprovarFilial;
  window.excluirFilial = excluirFilial;
```

- [ ] **Step 5: Update superadmin.html filiais table headers**

Find the filiais table in `superadmin.html`. Update `<thead>` to include new columns:

```html
<thead>
  <tr>
    <th>Nome</th>
    <th>Slug</th>
    <th>Matriz Pai</th>
    <th>Justificativa</th>
    <th>Data Criação</th>
    <th>Status</th>
    <th>Ações</th>
  </tr>
</thead>
```

---

## Task 9: Login HTML Update

**Files:**
- Modify: `login.html`

**Interfaces:**
- Consumes: login response (Task 5)
- Produces: authUser in localStorage

- [ ] **Step 1: Update authUser spread in login.html**

Find where `authUser` is saved to localStorage (the spread `...data.user`). Verify it includes the new fields. The existing spread should automatically include `empresaId` and `empresaTipo` from the updated login response.

Test by checking the login.html file for the localStorage set item. The spread `...data.user` should already work.

- [ ] **Step 2: Verify login flow**

Start backend, navigate to login page, login as admin. Check `localStorage.authUser` in browser console — should contain `empresaId` and `empresaTipo`.

---

## Task 10: Integration Test (Playwright)

**Files:**
- Test: inline Playwright script

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified end-to-end flow

- [ ] **Step 1: Start backend**

```bash
cd backend && node src/server.js
```

Expected: Server running on port 3000.

- [ ] **Step 2: Test login response includes empresaTipo**

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Login as superadmin
  await page.goto('http://localhost:3000/login.html');
  await page.fill('input[name="username"]', 'djesus');
  await page.fill('input[name="password"]', 'tsa110594');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard.html');
  
  // Check authUser
  const authUser = await page.evaluate(() => JSON.parse(localStorage.getItem('authUser')));
  console.log('authUser:', authUser);
  console.log('empresaTipo:', authUser.empresaTipo);
  console.log('empresaId:', authUser.empresaId);
  
  await browser.close();
})();
```

Expected: `empresaTipo` is not null (should be `'independente'` or `'matriz'`).

- [ ] **Step 3: Test admin creates filial**

Login as admin (matriz), navigate to filiais.html, create filial. Verify it appears with "Pendente" status.

- [ ] **Step 4: Test superadmin approves filial**

Login as superadmin, navigate to filiais section, click "Aprovar". Verify status changes to "Ativa".

---

## Self-Review

**1. Spec coverage:**
- ✅ Schema: status, createdBy, justificativa, createdByUser relation
- ✅ Routes: restructured with individual auth
- ✅ Controller: criarFilial (ownership checks, status, createdBy, justificativa)
- ✅ Controller: aprovarFilial, deletarFilial, listarFiliaisPendentes
- ✅ Repository: listarFiliais with deletedAt filter
- ✅ Auth: login response with empresaId, empresaTipo
- ✅ Dashboard: menu check fixed
- ✅ Superadmin: flat table, approve/delete, expanded form
- ✅ Admin: filiais.html page

**2. Placeholder scan:** No TBD, TODO, or "similar to" found. All code blocks complete.

**3. Type consistency:**
- `criarFilial(data)` — consistent across repository and controller
- `listarFiliaisPendentes()` — consistent
- `aprovarFilial(id)` — consistent
- `authUser.empresaTipo` — consistent across authService and dashboard.html
