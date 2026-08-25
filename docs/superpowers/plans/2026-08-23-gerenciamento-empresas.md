# Gerenciamento de Empresas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Gerenciamento" tab to superadmin panel where superadmin can CRUD empresas (tenants), each empresa gets its own admin area, products, and public index page.

**Architecture:** Backend: enable full CRUD on `POST/PUT/DELETE /api/admin` (empresas). Frontend: add "Empresas" tab to superadmin.html with table + create/edit modal. Public: index.html serves empresa's products filtered by slug from URL.

**Tech Stack:** Express, Prisma, CommonJS backend, vanilla JS frontend, vitest for tests.

## Global Constraints

- Branch: `main`. **No commits** (user constraint).
- Backend port 3000. Vite 5173.
- Login creds: `djesus`/`tsa110594` (superadmin).
- Empresa model: `id` (Int, auto), `nome` (String), `slug` (String, unique), `logo?`, `telefone?`, `endereco?`, `numero?`, `bairro?`, `cidade?`, `estado?`, `cep?`, `descricao?`, `openingTime?`, `closingTime?`, `workingDays` (Json, default []), `isOpen` (Boolean, default true), `manualOverride` (Boolean, default false), `themeSettings?` (Json), `capa?`, `bairrosAtendidos` (Json, default []).
- SQL repository methods exist: `listarEmpresas()`, `buscarEmpresa(id)`, `buscarEmpresaPorSlug(slug)`, `atualizarEmpresa(id, data)`, `criarEmpresa(data)`.
- Tests: `cd backend && npx vitest run` → 70/70 currently.
- No `EMPRESA_ID=1` hardcoded anywhere.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/routes/adminRoutes.js` | Modify | Enable POST/PUT/DELETE for empresas |
| `backend/src/controllers/adminController.js` | Create | Empresa CRUD handlers |
| `backend/tests/adminController.test.js` | Create | Unit tests for empresa CRUD |
| `superadmin.html` | Modify | Add "Empresas" tab + CRUD UI |
| `index.html` | Modify | Public page loads products by slug |
| `js/apiHelper.js` | Modify | Add `buscarEmpresa(slug)` helper |

---

## Task 1: Empresa CRUD API (backend)

**Files:**
- Create: `backend/src/controllers/adminController.js`
- Modify: `backend/src/routes/adminRoutes.js`
- Create: `backend/tests/adminController.test.js`

**Interfaces:**
- Consumes: `sql.listarEmpresas()`, `sql.buscarEmpresa(id)`, `sql.buscarEmpresaPorSlug(slug)`, `sql.criarEmpresa(data)`, `sql.atualizarEmpresa(id, data)` from `sqlRepository.js`.
- Produces: `exports.listar`, `exports.criar`, `exports.atualizar`, `exports.deletar` — Express async handlers taking `(req, res)`.

- [ ] **Step 1: Write failing tests**

```javascript
// backend/tests/adminController.test.js
const { describe, it, expect, vi } = require('vitest');

vi.mock('../config/prisma', () => ({ default: { empresa: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } } }));

const prisma = require('../config/prisma');
const controller = require('../controllers/adminController');

function mockRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return res;
}

describe('adminController.listar', () => {
  it('returns empresas list', async () => {
    prisma.default.empresa.findMany.mockResolvedValue([{ id: 1, nome: 'Test', slug: 'test' }]);
    const req = {};
    const res = mockRes();
    await controller.listar(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
  });
});

describe('adminController.criar', () => {
  it('creates empresa with required fields', async () => {
    prisma.default.empresa.findUnique.mockResolvedValue(null);
    prisma.default.empresa.create.mockResolvedValue({ id: 2, nome: 'Nova', slug: 'nova' });
    const req = { body: { nome: 'Nova', slug: 'nova' } };
    const res = mockRes();
    await controller.criar(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it('rejects duplicate slug', async () => {
    prisma.default.empresa.findUnique.mockResolvedValue({ id: 1, slug: 'existente' });
    const req = { body: { nome: 'X', slug: 'existente' } };
    const res = mockRes();
    await controller.criar(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rejects missing nome/slug', async () => {
    const req = { body: { nome: '' } };
    const res = mockRes();
    await controller.criar(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('adminController.atualizar', () => {
  it('updates empresa', async () => {
    prisma.default.empresa.findUnique.mockResolvedValue({ id: 1 });
    prisma.default.empresa.update.mockResolvedValue({ id: 1, nome: 'Updated' });
    const req = { params: { id: '1' }, body: { nome: 'Updated' } };
    const res = mockRes();
    await controller.atualizar(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Updated' }));
  });

  it('returns 404 for missing empresa', async () => {
    prisma.default.empresa.findUnique.mockResolvedValue(null);
    const req = { params: { id: '999' }, body: { nome: 'X' } };
    const res = mockRes();
    await controller.atualizar(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('adminController.deletar', () => {
  it('deletes empresa', async () => {
    prisma.default.empresa.findUnique.mockResolvedValue({ id: 1 });
    prisma.default.empresa.delete.mockResolvedValue({});
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.deletar(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 404 for missing empresa', async () => {
    prisma.default.empresa.findUnique.mockResolvedValue(null);
    const req = { params: { id: '999' } };
    const res = mockRes();
    await controller.deletar(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/adminController.test.js 2>&1 | tail -8`
Expected: FAIL — module not found.

- [ ] **Step 3: Create adminController.js**

```javascript
// backend/src/controllers/adminController.js
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  res.json(empresas);
});

exports.criar = asyncHandler(async (req, res) => {
  const { nome, slug, telefone, endereco, numero, bairro, cidade, estado, cep, descricao } = req.body;
  if (!nome || !slug) {
    return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
  }
  const slugNorm = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const existente = await sql.buscarEmpresaPorSlug(slugNorm);
  if (existente) {
    return res.status(409).json({ error: 'Slug já existe' });
  }
  const empresa = await sql.criarEmpresa({
    nome: nome.trim(),
    slug: slugNorm,
    telefone: telefone || null,
    endereco: endereco || null,
    numero: numero || null,
    bairro: bairro || null,
    cidade: cidade || null,
    estado: estado || null,
    cep: cep || null,
    descricao: descricao || null,
  });
  res.status(201).json(empresa);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existente = await sql.buscarEmpresa(id);
  if (!existente) return res.status(404).json({ error: 'Empresa não encontrada' });
  const allowed = ['nome', 'slug', 'telefone', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'descricao', 'logo', 'capa', 'openingTime', 'closingTime', 'workingDays', 'isOpen', 'manualOverride', 'themeSettings', 'bairrosAtendidos'];
  const payload = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) payload[key] = req.body[key];
  }
  if (payload.slug) {
    payload.slug = payload.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  }
  const empresa = await sql.atualizarEmpresa(id, payload);
  res.json(empresa);
});

exports.deletar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existente = await sql.buscarEmpresa(id);
  if (!existente) return res.status(404).json({ error: 'Empresa não encontrada' });
  await sql.deletarEmpresa(id);
  res.json({ ok: true });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/adminController.test.js 2>&1 | tail -8`
Expected: PASS.

- [ ] **Step 5: Add `deletarEmpresa` to sqlRepository if missing**

Check if `sql.deletarEmpresa(id)` exists in `sqlRepository.js`. If not, add:

```javascript
async deletarEmpresa(id) {
  return prisma.empresa.delete({ where: { id } });
},
```

- [ ] **Step 6: Run full test suite**

Run: `cd backend && npx vitest run 2>&1 | tail -6`
Expected: All tests pass (70+ new tests).

- [ ] **Step 7: Update adminRoutes.js**

Replace the `POST /` handler and add PUT/DELETE:

```javascript
// backend/src/routes/adminRoutes.js — replace POST / and add PUT/DELETE
const adminController = require('../controllers/adminController');

// ... (keep existing GET /, GET /clientes, etc.)

router.get('/', authenticate, authorize('superadmin'), adminController.listar);
router.post('/', authenticate, authorize('superadmin'), adminController.criar);
router.put('/:id', authenticate, authorize('superadmin'), adminController.atualizar);
router.delete('/:id', authenticate, authorize('superadmin'), adminController.deletar);
```

- [ ] **Step 8: Verify API works with curl**

```bash
TOKEN=$(curl -s http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
# List empresas
curl -s http://localhost:3000/api/admin -H "Authorization: Bearer $TOKEN"
# Create empresa
curl -s -X POST http://localhost:3000/api/admin -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nome":"Teste E2E","slug":"teste-e2e"}'
```

---

## Task 2: Superadmin "Empresas" Tab (frontend)

**Files:**
- Modify: `superadmin.html`

**Interfaces:**
- Consumes: `GET /api/admin` (list empresas), `POST /api/admin` (create), `PUT /api/admin/:id` (update), `DELETE /api/admin/:id` (delete).
- Produces: UI tab "Empresas" with table + create/edit modal.

- [ ] **Step 1: Add tab button to superadmin.html**

Insert after the "Clientes" button (line 22):

```html
<button class="tab" onclick="switchTab('empresas',this)"><i class="fas fa-store"></i> Empresas</button>
```

- [ ] **Step 2: Add tab content div**

Insert after `</div>` of `tabClientes` div (before the `</div>` closing the tab-content container):

```html
<!-- Empresas tab -->
<div class="tab-content" id="tabEmpresas">
  <div class="card">
    <h2><i class="fas fa-store"></i> Empresas Cadastradas</h2>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead>
        <tr><th>Nome</th><th>Slug</th><th>Telefone</th><th>Cidade</th><th>Produtos</th><th>Pedidos</th><th>Criado em</th><th>Ações</th></tr>
      </thead>
      <tbody id="empresasTableBody">
        <tr><td colspan="8" style="color:#94a3b8;text-align:center;">Carregando...</td></tr>
      </tbody>
    </table>
    </div>
  </div>
  <div class="card" style="margin-top:1rem;">
    <h2><i class="fas fa-plus-circle"></i> Cadastrar Nova Empresa</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;max-width:600px;">
      <div>
        <label style="font-size:0.75rem;color:#94a3b8;">Nome da Loja *</label>
        <input id="empNome" type="text" placeholder="Ex: Fábrica de Salgados" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#e2e8f0;">
      </div>
      <div>
        <label style="font-size:0.75rem;color:#94a3b8;">Slug (URL) *</label>
        <input id="empSlug" type="text" placeholder="Ex: fabrica-salgados" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#e2e8f0;">
      </div>
      <div>
        <label style="font-size:0.75rem;color:#94a3b8;">Telefone</label>
        <input id="empTelefone" type="text" placeholder="5521999999999" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#e2e8f0;">
      </div>
      <div>
        <label style="font-size:0.75rem;color:#94a3b8;">Cidade</label>
        <input id="empCidade" type="text" placeholder="Rio de Janeiro" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#e2e8f0;">
      </div>
    </div>
    <button class="btn btn-primary" style="margin-top:1rem;" onclick="cadastrarEmpresa()"><i class="fas fa-plus"></i> Cadastrar</button>
  </div>

  <!-- Edit modal -->
  <div id="modalEditarEmpresa" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:999;justify-content:center;align-items:center;">
    <div style="background:#1e293b;border-radius:12px;padding:1.5rem;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
      <h3 style="color:#e2e8f0;margin-bottom:1rem;"><i class="fas fa-pen"></i> Editar Empresa</h3>
      <input type="hidden" id="editEmpId">
      <div style="display:grid;gap:0.75rem;">
        <div><label style="font-size:0.75rem;color:#94a3b8;">Nome</label><input id="editEmpNome" type="text" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;"></div>
        <div><label style="font-size:0.75rem;color:#94a3b8;">Slug</label><input id="editEmpSlug" type="text" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;"></div>
        <div><label style="font-size:0.75rem;color:#94a3b8;">Telefone</label><input id="editEmpTelefone" type="text" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;"></div>
        <div><label style="font-size:0.75rem;color:#94a3b8;">Endereço</label><input id="editEmpEndereco" type="text" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;"></div>
        <div><label style="font-size:0.75rem;color:#94a3b8;">Cidade</label><input id="editEmpCidade" type="text" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;"></div>
        <div><label style="font-size:0.75rem;color:#94a3b8;">Estado</label><input id="editEmpEstado" type="text" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;"></div>
        <div><label style="font-size:0.75rem;color:#94a3b8;">Descrição</label><textarea id="editEmpDescricao" rows="2" style="width:100%;padding:0.5rem;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;"></textarea></div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:1rem;">
        <button class="btn btn-primary" onclick="salvarEdicaoEmpresa()"><i class="fas fa-save"></i> Salvar</button>
        <button class="btn btn-secondary" onclick="fecharModal('modalEditarEmpresa')">Cancelar</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add JS functions to superadmin.html**

Insert before the closing `</script>` tag (before line 382):

```javascript
// ---- Empresas ----
async function carregarEmpresas() {
  const tbody = document.getElementById('empresasTableBody');
  try {
    const empresas = await api('/admin');
    if (!empresas || empresas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:#94a3b8;text-align:center;">Nenhuma empresa cadastrada</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    empresas.forEach(function(e) {
      var created = e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '-';
      var count = e._count || {};
      tbody.innerHTML += '<tr>'
        + '<td><strong>' + (e.nome || '-') + '</strong></td>'
        + '<td><code style="background:#334155;padding:2px 6px;border-radius:4px;font-size:0.8rem;">' + (e.slug || '-') + '</code></td>'
        + '<td>' + (e.telefone || '-') + '</td>'
        + '<td>' + (e.cidade || '-') + '</td>'
        + '<td>' + (count.produtos || 0) + '</td>'
        + '<td>' + (count.pedidos || 0) + '</td>'
        + '<td>' + created + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button class="btn btn-primary btn-sm" aria-label="Editar empresa ' + e.nome + '" onclick="abrirModalEditarEmpresa(' + e.id + ')"><i class="fas fa-pen"></i></button> '
        + '<button class="btn btn-danger btn-sm" aria-label="Excluir empresa ' + e.nome + '" onclick="excluirEmpresa(' + e.id + ',\'' + e.nome + '\')"><i class="fas fa-trash"></i></button>'
        + '</td></tr>';
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#dc2626;text-align:center;">Erro ao carregar empresas: ' + e.message + '</td></tr>';
  }
}

async function cadastrarEmpresa() {
  const nome = document.getElementById('empNome').value.trim();
  const slug = document.getElementById('empSlug').value.trim();
  const telefone = document.getElementById('empTelefone').value.trim();
  const cidade = document.getElementById('empCidade').value.trim();
  if (!nome || !slug) { toast('Nome e slug são obrigatórios', 'danger'); return; }
  try {
    await api('/admin', { method: 'POST', body: JSON.stringify({ nome, slug, telefone, cidade }) });
    document.getElementById('empNome').value = '';
    document.getElementById('empSlug').value = '';
    document.getElementById('empTelefone').value = '';
    document.getElementById('empCidade').value = '';
    toast('Empresa ' + nome + ' cadastrada!');
    carregarEmpresas();
  } catch(e) {
    toast(e.message || 'Erro ao cadastrar', 'danger');
  }
}

async function abrirModalEditarEmpresa(id) {
  try {
    const empresas = await api('/admin');
    const emp = empresas.find(function(e) { return e.id === id; });
    if (!emp) return;
    document.getElementById('editEmpId').value = emp.id;
    document.getElementById('editEmpNome').value = emp.nome || '';
    document.getElementById('editEmpSlug').value = emp.slug || '';
    document.getElementById('editEmpTelefone').value = emp.telefone || '';
    document.getElementById('editEmpEndereco').value = emp.endereco || '';
    document.getElementById('editEmpCidade').value = emp.cidade || '';
    document.getElementById('editEmpEstado').value = emp.estado || '';
    document.getElementById('editEmpDescricao').value = emp.descricao || '';
    document.getElementById('modalEditarEmpresa').style.display = 'flex';
  } catch(e) { toast(e.message || 'Erro ao carregar', 'danger'); }
}

async function salvarEdicaoEmpresa() {
  const id = document.getElementById('editEmpId').value;
  const body = {
    nome: document.getElementById('editEmpNome').value.trim(),
    slug: document.getElementById('editEmpSlug').value.trim(),
    telefone: document.getElementById('editEmpTelefone').value.trim(),
    endereco: document.getElementById('editEmpEndereco').value.trim(),
    cidade: document.getElementById('editEmpCidade').value.trim(),
    estado: document.getElementById('editEmpEstado').value.trim(),
    descricao: document.getElementById('editEmpDescricao').value.trim(),
  };
  if (!body.nome) { toast('Nome é obrigatório', 'danger'); return; }
  try {
    await api('/admin/' + id, { method: 'PUT', body: JSON.stringify(body) });
    fecharModal('modalEditarEmpresa');
    toast('Empresa atualizada!');
    carregarEmpresas();
  } catch(e) {
    toast(e.message || 'Erro ao salvar', 'danger');
  }
}

async function excluirEmpresa(id, nome) {
  if (!(await confirmModal('Excluir empresa ' + nome + '? Todos os dados (produtos, pedidos, usuários) serão removidos.'))) return;
  try {
    await api('/admin/' + id, { method: 'DELETE' });
    toast('Empresa ' + nome + ' removida', 'danger');
    carregarEmpresas();
  } catch(e) {
    toast(e.message || 'Erro ao remover', 'danger');
  }
}
```

- [ ] **Step 4: Add `carregarEmpresas()` to init**

Add `carregarEmpresas();` after `carregarClientes();` (line 380).

- [ ] **Step 5: Update `activarTabPorQuery` to include 'empresas'**

Change line 371:
```javascript
if (tab && ['usuarios', 'senhas', 'clientes', 'registros', 'empresas'].includes(tab)) {
```

- [ ] **Step 6: Verify in browser**

Navigate to `http://localhost:3000/superadmin.html` → click "Empresas" tab → verify table loads with existing empresas.

---

## Task 3: Public index.html — products by slug

**Files:**
- Modify: `index.html` (root)
- Modify: `js/apiHelper.js`

**Interfaces:**
- Consumes: `GET /api/public/produtos` with `Host: <slug>.domain` header, or query param `?slug=<slug>`.
- Produces: Public product listing filtered by empresa.

- [ ] **Step 1: Check current index.html structure**

Read `index.html` to understand how it loads products.

- [ ] **Step 2: Update apiHelper.js**

Add a function to get empresa slug from URL or subdomain:

```javascript
// js/apiHelper.js — add after existing functions
function getEmpresaSlug() {
  // Subdomain: slug.domain.com
  var host = window.location.hostname;
  var parts = host.split('.');
  if (parts.length >= 3) return parts[0];
  // Query param: ?slug=xxx
  var p = new URLSearchParams(window.location.search);
  return p.get('slug') || null;
}
```

- [ ] **Step 3: Update index.html product loading**

If index.html loads products from `/api/public/produtos`, ensure it passes the slug as a header or param. The `resolveEmpresa` middleware reads `Host` header. For local testing with query param, add:

```javascript
// In index.html product loading function
var slug = getEmpresaSlug();
var headers = { 'Content-Type': 'application/json' };
if (slug) headers['Host'] = slug + '.localhost';
fetch('/api/public/produtos', { headers: headers })
  .then(function(r) { return r.json(); })
  .then(function(produtos) { /* render */ });
```

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:3000/?slug=salgadoscosta` → products should load from the empresa.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-23-gerenciamento-empresas.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
