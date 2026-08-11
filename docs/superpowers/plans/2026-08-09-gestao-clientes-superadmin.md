# Gestão de Contas de Clientes (Superadmin) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o superadmin liste, edite, troque senha (sem saber a antiga) e exclua contas de clientes do site, via nova aba "Clientes" no `superadmin.html` acessível pelo submenu "Administração" do dashboard.

**Architecture:** Backend — serviço `clientService.js` com dependências injetadas (padrão `montarResumoPeriodo` puro+injetado do `entregaService.js`, testável via vitest sem DB) + controller fino `clientAdminController.js` + rotas protegidas em `adminRoutes.js` (guard superadmin já existente). Frontend — nova aba no `superadmin.html` (tabela + modal edição + modal senha com olho automático via `password-toggle.js`) e item no submenu Administração do `dashboard.html`.

**Tech Stack:** Express (CommonJS), Prisma/PostgreSQL, bcryptjs, vitest (backend unit), Vanilla JS (frontend), Playwright (E2E). Sem novas dependências.

## Global Constraints

- **Sem commits** até aprovação explícita (decisão do projeto)
- Backend: CommonJS (`require`/`module.exports`), não ESM
- `SALT_ROUNDS = 10` (bcryptjs) — igual ao registro de cliente
- Lista de clientes nunca retorna `passwordHash`
- Guard superadmin: `authenticate, authorize('superadmin')` já em `adminRoutes.js`
- Não alterar APIs/fluxos existentes de cliente público (`/api/public`)
- Frontend segue padrões existentes (Vanilla JS, `api()` helper, `toast`, `confirmModal`)
- Auditoria: todas as mutações registram no `auditService` com actor superadmin

---

### Task 1: clientService.js — regras de negócio

**Files:**
- Create: `backend/src/services/clientService.js`
- Test: `backend/tests/clientService.test.js`

**Interfaces:**
- Consumes: `sql` (listarClientes, buscarCliente, buscarClientePorId, atualizarCliente, deletarCliente), `bcryptjs`, `auditService`
- Produces (assinaturas exatas, usadas pela Task 2):
  - `listarClientes() → Promise<Array<{id,nome,telefone,endereco,numero,bairro,cep,pontoReferencia,createdAt,consentimentoAt}>>` (sem passwordHash)
  - `atualizarCliente(id, data, ctx, deps) → Promise<cliente>` — valida telefone duplicado (409), atualiza + audit `cliente.admin_update`
  - `resetarSenha(id, password, ctx, deps) → Promise<{success:true}>` — senha min 6 (400), bcrypt hash, atualiza + audit `cliente.admin_reset_password` (severity critical)
  - `deletarCliente(id, ctx, deps) → Promise<{success:true}>` — deleta + audit `cliente.admin_delete` (severity critical)
  - `deps = { sql, bcrypt, auditService, SALT_ROUNDS }` — injetável para testes; default real

- [ ] **Step 1: Escrever teste que falha**

```javascript
// backend/tests/clientService.test.js
import { describe, it, expect, vi } from 'vitest';
import { listarClientes, atualizarCliente, resetarSenha, deletarCliente } from '../src/services/clientService.js';

function deps() {
  return {
    sql: {
      listarClientes: vi.fn(async () => [
        { id: 1, nome: 'Maria', telefone: '21999999999', endereco: 'Rua A', numero: '10', bairro: 'Centro', cep: '20000-000', pontoReferencia: null, passwordHash: 'HASH', createdAt: new Date('2026-08-01') },
      ]),
      buscarCliente: vi.fn(async (t) => (t === '21999999999' ? { id: 2 } : null)),
      buscarClientePorId: vi.fn(async (id) => (id === 99 ? null : { id, nome: 'Maria', telefone: '21999999999' })),
      atualizarCliente: vi.fn(async (id, data) => ({ id, ...data })),
      deletarCliente: vi.fn(async (id) => ({ id })),
    },
    bcrypt: { hash: vi.fn(async (p) => 'HASHED:' + p) },
    auditService: { audit: vi.fn(async () => {}) },
    SALT_ROUNDS: 10,
  };
}

describe('listarClientes', () => {
  it('remove passwordHash da resposta', async () => {
    const d = deps();
    const result = await listarClientes(d);
    expect(result).toHaveLength(1);
    expect(result[0].passwordHash).toBeUndefined();
  });
});

describe('atualizarCliente', () => {
  it('rejeita telefone duplicado com 409', async () => {
    const d = deps();
    await expect(atualizarCliente(1, { telefone: '21999999999' }, {}, d))
      .rejects.toMatchObject({ message: 'Telefone já cadastrado por outro cliente', status: 409 });
  });
  it('atualiza e audita', async () => {
    const d = deps();
    const r = await atualizarCliente(1, { nome: 'Maria Silva', bairro: 'Copacabana' }, {}, d);
    expect(r.nome).toBe('Maria Silva');
    expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cliente.admin_update' }));
  });
  it('404 se cliente não existe', async () => {
    const d = deps();
    await expect(atualizarCliente(99, { nome: 'X' }, {}, d))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('resetarSenha', () => {
  it('rejeita senha curta com 400', async () => {
    const d = deps();
    await expect(resetarSenha(1, '123', {}, d)).rejects.toMatchObject({ status: 400 });
  });
  it('hasha e atualiza passwordHash, audita critical', async () => {
    const d = deps();
    const r = await resetarSenha(1, 'novaSenha123', {}, d);
    expect(r.success).toBe(true);
    expect(d.sql.atualizarCliente).toHaveBeenCalledWith(1, { passwordHash: 'HASHED:novaSenha123' });
    expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cliente.admin_reset_password', severity: 'critical' }));
  });
  it('404 se cliente não existe', async () => {
    const d = deps();
    await expect(resetarSenha(99, 'novaSenha123', {}, d)).rejects.toMatchObject({ status: 404 });
  });
});

describe('deletarCliente', () => {
  it('deleta e audita critical', async () => {
    const d = deps();
    const r = await deletarCliente(1, {}, d);
    expect(r.success).toBe(true);
    expect(d.sql.deletarCliente).toHaveBeenCalledWith(1);
    expect(d.auditService.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cliente.admin_delete', severity: 'critical' }));
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `cd backend && npx vitest run tests/clientService.test.js`
Expected: FAIL — "Cannot find module '../src/services/clientService.js'"

- [ ] **Step 3: Implementar clientService.js**

```javascript
// backend/src/services/clientService.js
const sqlRepo = require('../repositories/sqlRepository');
const bcrypt = require('bcryptjs');
const auditService = require('../services/auditService');

const DEFAULT_SALT_ROUNDS = 10;

// Dependências injetáveis para testes (padrão puro+injetado do entregaService).
function deps(overrides = {}) {
  return { sql: sqlRepo, bcrypt, auditService, SALT_ROUNDS: DEFAULT_SALT_ROUNDS, ...overrides };
}

function base(ctx) {
  return {
    requestId: ctx.requestId || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    ...(ctx.actor || {}),
    metadata: { url: ctx.path || null },
  };
}

async function listarClientes(d = deps()) {
  const clientes = await d.sql.listarClientes();
  return clientes.map(function (c) {
    return {
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      endereco: c.endereco,
      numero: c.numero,
      bairro: c.bairro,
      cep: c.cep,
      pontoReferencia: c.pontoReferencia,
      createdAt: c.createdAt,
      consentimentoAt: c.consentimentoAt,
      consentimentoRevogadoAt: c.consentimentoRevogadoAt,
    };
  });
}

async function atualizarCliente(id, data, ctx = {}, d = deps()) {
  const clienteId = Number(id);
  const existente = await d.sql.buscarClientePorId(clienteId);
  if (!existente) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });

  const body = { ...data };
  delete body.passwordHash;
  delete body.id;

  if (body.telefone !== undefined && body.telefone !== existente.telefone) {
    const outro = await d.sql.buscarCliente(body.telefone);
    if (outro && outro.id !== clienteId) {
      throw Object.assign(new Error('Telefone já cadastrado por outro cliente'), { status: 409 });
    }
  }

  const cliente = await d.sql.atualizarCliente(clienteId, body);

  const changedFields = Object.keys(body).filter(function (k) { return body[k] !== undefined; });
  const before = {};
  const after = {};
  for (const key of changedFields) { before[key] = existente[key]; after[key] = body[key]; }

  await d.auditService.audit({
    ...base(ctx),
    action: 'cliente.admin_update',
    module: 'clientes',
    targetType: 'cliente',
    targetId: clienteId,
    before,
    after,
    changedFields,
  });

  return cliente;
}

async function resetarSenha(id, password, ctx = {}, d = deps()) {
  const clienteId = Number(id);
  const existente = await d.sql.buscarClientePorId(clienteId);
  if (!existente) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });
  if (!password || String(password).length < 6) {
    throw Object.assign(new Error('Senha deve ter 6+ caracteres'), { status: 400 });
  }

  const hash = await d.bcrypt.hash(password, d.SALT_ROUNDS);
  await d.sql.atualizarCliente(clienteId, { passwordHash: hash });

  await d.auditService.audit({
    ...base(ctx),
    action: 'cliente.admin_reset_password',
    module: 'clientes',
    targetType: 'cliente',
    targetId: clienteId,
    changedFields: ['passwordHash'],
    severity: 'critical',
  });

  return { success: true };
}

async function deletarCliente(id, ctx = {}, d = deps()) {
  const clienteId = Number(id);
  const existente = await d.sql.buscarClientePorId(clienteId);
  if (!existente) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });

  await d.sql.deletarCliente(clienteId);

  await d.auditService.audit({
    ...base(ctx),
    action: 'cliente.admin_delete',
    module: 'clientes',
    targetType: 'cliente',
    targetId: clienteId,
    after: { nome: existente.nome, telefone: existente.telefone },
    changedFields: ['*'],
    severity: 'critical',
  });

  return { success: true };
}

module.exports = { listarClientes, atualizarCliente, resetarSenha, deletarCliente };
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `cd backend && npx vitest run tests/clientService.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Verificar que entregaService.test.js continua passando**

Run: `cd backend && npx vitest run tests/entregaService.test.js`
Expected: PASS

- [ ] **Step 6: Sem commit (constraint do projeto)** — parar aqui; próximo task no próximo passo

---

### Task 2: clientAdminController.js + rotas adminRoutes

**Files:**
- Create: `backend/src/controllers/clientAdminController.js`
- Modify: `backend/src/routes/adminRoutes.js`

**Interfaces:**
- Consumes: `clientService` da Task 1 (`listarClientes`, `atualizarCliente`, `resetarSenha`, `deletarCliente`), `getCtx` do `../middleware/context`, `asyncHandler` do `../middleware/errorHandler`
- Produces: controller com exports `listar`, `atualizar`, `resetarSenha`, `deletar`; rotas `GET/PUT /api/admin/clientes/:id`, `PUT /api/admin/clientes/:id/password`, `DELETE /api/admin/clientes/:id`

- [ ] **Step 1: Criar clientAdminController.js**

```javascript
// backend/src/controllers/clientAdminController.js
const clientService = require('../services/clientService');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');

function ctxFrom(req) {
  return {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
    actor: {
      actorType: 'admin',
      actorId: Number(req.user.id),
      actorUsername: req.user.username,
      actorRole: req.user.role,
    },
  };
}

exports.listar = asyncHandler(async (req, res) => {
  res.json(await clientService.listarClientes());
});

exports.atualizar = asyncHandler(async (req, res) => {
  const { nome, telefone, endereco, numero, bairro, cep, pontoReferencia } = req.body;
  const cliente = await clientService.atualizarCliente(req.params.id, { nome, telefone, endereco, numero, bairro, cep, pontoReferencia }, ctxFrom(req));
  res.json(cliente);
});

exports.resetarSenha = asyncHandler(async (req, res) => {
  const { password } = req.body;
  res.json(await clientService.resetarSenha(req.params.id, password, ctxFrom(req)));
});

exports.deletar = asyncHandler(async (req, res) => {
  res.json(await clientService.deletarCliente(req.params.id, ctxFrom(req)));
});
```

- [ ] **Step 2: Adicionar rotas em adminRoutes.js**

```javascript
// backend/src/routes/adminRoutes.js — adicionar no topo, após os requires:
const clientAdminController = require('../controllers/clientAdminController');

// Adicionar após o router.use(...):
router.get('/clientes', clientAdminController.listar);
router.put('/clientes/:id', clientAdminController.atualizar);
router.put('/clientes/:id/password', clientAdminController.resetarSenha);
router.delete('/clientes/:id', clientAdminController.deletar);
```

- [ ] **Step 3: Smoke test manual da rota**

Run (servidor rodando de `backend/`):
```bash
curl -s http://localhost:3000/api/admin/clientes
```
Expected: `{"error":"Token inválido"}` ou `401` (sem token) — confirma que a rota existe e exige auth.

- [ ] **Step 4: Sem commit (constraint do projeto)**

---

### Task 3: superadmin.html — aba Clientes + modais + query param

**Files:**
- Modify: `superadmin.html` (tabs header ~linha 18-22, novo tab-content após `#tabSenhas` ~linha 63, JS `switchTab` ~linha 134-141, script principal ~linha 213)

**Interfaces:**
- Consumes: endpoints da Task 2 (`GET/PUT /api/admin/clientes`, `PUT /api/admin/clientes/:id/password`, `DELETE /api/admin/clientes/:id`), helper `api()`, `toast`, `confirmModal`, `password-toggle.js` (já carregado)
- Produces: funções `carregarClientes()`, `abrirModalEditar(id)`, `abrirModalSenha(id)`, `excluirCliente(id)`; tab `clientes` ativável via `?tab=clientes`

- [ ] **Step 1: Adicionar aba no header (após linha 21, botão Registros)**

```html
  <button class="tab" onclick="switchTab('clientes',this)"><i class="fas fa-user-tie"></i> Clientes</button>
```

- [ ] **Step 2: Adicionar tab-content (após o bloco `#tabSenhas`, antes do comentário "Empresas tab removida")**

```html
<!-- Clientes tab -->
<div class="tab-content" id="tabClientes">
  <div class="card">
    <h2><i class="fas fa-user-tie"></i> Clientes Cadastrados</h2>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead><tr><th>Nome</th><th>Telefone</th><th>Bairro</th><th>Criado em</th><th>Ações</th></tr></thead>
      <tbody id="clientesTableBody"></tbody>
    </table>
    </div>
  </div>

  <!-- Modal Editar Cliente -->
  <div class="modal-overlay" id="modalEditarCliente" style="display:none;">
    <div class="modal-card">
      <h3><i class="fas fa-user-edit"></i> Editar Cliente</h3>
      <label>Nome <input type="text" id="editNome"></label>
      <label>Telefone <input type="text" id="editTelefone"></label>
      <label>Endereço <input type="text" id="editEndereco"></label>
      <label>Número <input type="text" id="editNumero"></label>
      <label>Bairro <input type="text" id="editBairro"></label>
      <label>CEP <input type="text" id="editCep"></label>
      <label>Ponto de Referência <input type="text" id="editPontoReferencia"></label>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="fecharModal('modalEditarCliente')">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarEdicaoCliente()"><i class="fas fa-save"></i> Salvar</button>
      </div>
    </div>
  </div>

  <!-- Modal Trocar Senha -->
  <div class="modal-overlay" id="modalSenhaCliente" style="display:none;">
    <div class="modal-card">
      <h3><i class="fas fa-key"></i> Trocar Senha</h3>
      <label>Nova senha <input type="password" id="novaSenhaCliente" aria-label="Nova senha" placeholder="Nova senha"></label>
      <label>Confirmar senha <input type="password" id="confirmarSenhaCliente" aria-label="Confirmar senha" placeholder="Confirmar senha"></label>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="fecharModal('modalSenhaCliente')">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarSenhaCliente()"><i class="fas fa-save"></i> Salvar</button>
      </div>
    </div>
  </div>
</div>
```

Nota: campos `type="password"` ganham o olho automaticamente via `js/password-toggle.js` (já carregado na página, linha 218).

- [ ] **Step 3: Atualizar switchTab map (linha 138)**

```javascript
  const map = { usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', registros: 'tabRegistros', clientes: 'tabClientes' };
```

- [ ] **Step 3b: Adicionar CSS dos modais em css/superadmin-page.css (anexar ao final)**

Nota: `confirmModal()` de `js/utils.js` já usa `.modal-overlay`/`.modal-box`/`.modal-actions`/`.btn-modal-cancel`/`.btn-modal-confirm`, mas `superadmin-page.css` não tem esses estilos (o confirm já roda meio sem estilo na página hoje). Adicionar de uma vez cobre confirm + os modais novos. `.btn-secondary` vem do Bootstrap (já carregado).

```css
/* ===== Modais (clientes + confirmModal) ===== */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}
.modal-box, .modal-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 420px;
  width: 90%;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.modal-card h3 { font-size: 15px; margin-bottom: 14px; color: #1e293b; display: flex; align-items: center; gap: 8px; }
.modal-card h3 i { color: #f97316; }
.modal-card label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #64748b; gap: 4px; margin-bottom: 10px; }
.modal-card input {
  padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 13px; font-family: inherit; outline: none;
}
.modal-card input:focus { border-color: #f97316; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.btn-modal-cancel, .btn-modal-confirm {
  padding: 8px 16px; border: none; border-radius: 8px;
  font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit;
}
.btn-modal-cancel { background: #e2e8f0; color: #475569; }
.btn-modal-confirm { background: #f97316; color: white; }
.btn-secondary { background: #e2e8f0; color: #475569; }
.btn-secondary:hover { background: #cbd5e1; }
```

- [ ] **Step 4: Adicionar JS de clientes (após `carregarUsuarios();` no final do script, ~linha 213)**

```javascript
let clienteEditandoId = null;
let clienteSenhaId = null;

async function carregarClientes() {
  const tbody = document.getElementById('clientesTableBody');
  try {
    const clientes = await api('/admin/clientes');
    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#94a3b8;text-align:center;">Nenhum cliente cadastrado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    clientes.forEach(function(c) {
      tbody.innerHTML += '<tr>'
        + '<td><strong>' + (c.nome || '-') + '</strong></td>'
        + '<td>' + (c.telefone || '-') + '</td>'
        + '<td>' + (c.bairro || '-') + '</td>'
        + '<td>' + (c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '-') + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button class="btn btn-primary btn-sm" aria-label="Editar cliente" onclick="abrirModalEditar(' + c.id + ')"><i class="fas fa-pen"></i></button> '
        + '<button class="btn btn-secondary btn-sm" aria-label="Trocar senha" onclick="abrirModalSenha(' + c.id + ')"><i class="fas fa-key"></i></button> '
        + '<button class="btn btn-danger btn-sm" aria-label="Excluir cliente" onclick="excluirCliente(' + c.id + ')"><i class="fas fa-trash"></i></button>'
        + '</td></tr>';
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#dc2626;text-align:center;">Erro ao carregar clientes: ' + e.message + '</td></tr>';
  }
}

function abrirModalEditar(id) {
  clienteEditandoId = id;
  api('/admin/clientes').then(function(list) {
    const c = list.find(function(x) { return x.id === id; });
    if (!c) return;
    document.getElementById('editNome').value = c.nome || '';
    document.getElementById('editTelefone').value = c.telefone || '';
    document.getElementById('editEndereco').value = c.endereco || '';
    document.getElementById('editNumero').value = c.numero || '';
    document.getElementById('editBairro').value = c.bairro || '';
    document.getElementById('editCep').value = c.cep || '';
    document.getElementById('editPontoReferencia').value = c.pontoReferencia || '';
    document.getElementById('modalEditarCliente').style.display = 'flex';
  }).catch(function(e) { toast(e.message || 'Erro ao carregar cliente', 'danger'); });
}

async function salvarEdicaoCliente() {
  const body = {
    nome: document.getElementById('editNome').value.trim(),
    telefone: document.getElementById('editTelefone').value.trim(),
    endereco: document.getElementById('editEndereco').value.trim(),
    numero: document.getElementById('editNumero').value.trim(),
    bairro: document.getElementById('editBairro').value.trim(),
    cep: document.getElementById('editCep').value.trim(),
    pontoReferencia: document.getElementById('editPontoReferencia').value.trim(),
  };
  if (!body.nome) { toast('Nome é obrigatório', 'danger'); return; }
  try {
    await api('/admin/clientes/' + clienteEditandoId, { method: 'PUT', body: JSON.stringify(body) });
    fecharModal('modalEditarCliente');
    toast('Cliente atualizado!');
    carregarClientes();
  } catch(e) {
    toast(e.message || 'Erro ao salvar', 'danger');
  }
}

function abrirModalSenha(id) {
  clienteSenhaId = id;
  document.getElementById('novaSenhaCliente').value = '';
  document.getElementById('confirmarSenhaCliente').value = '';
  document.getElementById('modalSenhaCliente').style.display = 'flex';
}

async function salvarSenhaCliente() {
  const senha = document.getElementById('novaSenhaCliente').value.trim();
  const senha2 = document.getElementById('confirmarSenhaCliente').value.trim();
  if (!senha || senha.length < 6) { toast('Senha deve ter 6+ caracteres', 'danger'); return; }
  if (senha !== senha2) { toast('Senhas não conferem', 'danger'); return; }
  try {
    await api('/admin/clientes/' + clienteSenhaId + '/password', { method: 'PUT', body: JSON.stringify({ password: senha }) });
    fecharModal('modalSenhaCliente');
    toast('Senha alterada com sucesso!');
  } catch(e) {
    toast(e.message || 'Erro ao alterar senha', 'danger');
  }
}

async function excluirCliente(id) {
  const ok = await confirmModal('Excluir a conta deste cliente? Dados pessoais serão removidos (pedidos retidos por obrigação fiscal).');
  if (!ok) return;
  try {
    await api('/admin/clientes/' + id, { method: 'DELETE' });
    toast('Conta de cliente excluída', 'danger');
    carregarClientes();
  } catch(e) {
    toast(e.message || 'Erro ao excluir', 'danger');
  }
}

function fecharModal(id) {
  document.getElementById(id).style.display = 'none';
}
```

- [ ] **Step 5: Ativar tab via query param + carregar clientes no init (substituir `carregarUsuarios();` no final do script)**

```javascript
function activarTabPorQuery() {
  const p = new URLSearchParams(window.location.search);
  const tab = p.get('tab');
  if (tab && ['usuarios', 'senhas', 'clientes', 'registros'].includes(tab)) {
    const btn = Array.from(document.querySelectorAll('.tab')).find(function(b) {
      return b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'" + tab + "'") !== -1;
    });
    if (btn) switchTab(tab, btn);
  }
}

carregarUsuarios();
activarTabPorQuery();
```

- [ ] **Step 6: Verificação manual no navegador**

- Abrir `http://localhost:3000/superadmin.html` logado como superadmin → aba "Clientes" clicável, lista carrega
- Abrir `http://localhost:3000/superadmin.html?tab=clientes` → tab Clientes ativa automaticamente
- Abrir modal editar → campos preenchem; modal senha → campos de senha exibem olho 👁 (`password-toggle.js`) e modal aparece estilizado
- `confirmModal` (exclusão) aparece estilizado (CSS novo cobre `.modal-overlay`/`.modal-box`)
- [ ] **Step 7: Sem commit (constraint do projeto)**

---

### Task 4: dashboard.html — item no submenu Administração

**Files:**
- Modify: `dashboard.html:117-133` (bloco `if (role === 'superadmin')`)

**Interfaces:**
- Consumes: nada novo; produz link de navegação `superadmin.html?tab=clientes`
- Produces: item `Clientes` no submenu Administração (superadmin-only)

- [ ] **Step 1: Adicionar item ao submenu Administração**

```javascript
// dashboard.html — dentro do bloco if (role === 'superadmin') {
  menuSections.push({
    title: 'Administração',
    items: [
      { icon: 'fa-users-cog', label: 'Gerenciar Usuários', page: 'superadmin.html' },
      { icon: 'fa-key', label: 'Trocar Senhas', page: 'superadmin.html?tab=senhas' },
      { icon: 'fa-user-tie', label: 'Clientes', page: 'superadmin.html?tab=clientes' },
    ]
  });
```

- [ ] **Step 2: Verificação manual no navegador**

- Abrir `http://localhost:3000/dashboard.html` como superadmin (`djesus`) → submenu **Administração** mostra "Clientes"
- Logar como admin (não superadmin) → submenu Administração **não aparece** (regra existente)
- Clicar "Clientes" → navega para `superadmin.html?tab=clientes` com aba ativa
- [ ] **Step 3: Sem commit (constraint do projeto)**

---

### Task 5: Verificação E2E (Playwright) + regressão

**Files:**
- Read/verify: todos os arquivos modificados nas Tasks 1-4

**Interfaces:**
- Consumes: app rodando em `http://localhost:3000`, creds `djesus` / `tsa110594` (superadmin)

- [ ] **Step 1: Rodar testes unitários backend (regressão completa)**

Run: `cd backend && npx vitest run`
Expected: ALL PASS (inclui `clientService.test.js` novo + `entregaService.test.js` + `sqlRepository.test.js` + `orderService.test.js` + `consentimento.test.js`)

- [ ] **Step 2: E2E — superadmin vê aba e lista**

Via Playwright: login `djesus`/`tsa110594` → `superadmin.html?tab=clientes` → verificar tabela de clientes renderizada com colunas Nome/Telefone/Bairro

- [ ] **Step 3: E2E — troca de senha funciona**

Via Playwright: abrir modal senha de um cliente de teste → salvar nova senha `teste123456` → logar no site público (`index.html` flow de login de cliente com telefone + nova senha) → sucesso

- [ ] **Step 4: E2E — exclusão + token rejeitado**

Via Playwright: excluir cliente de teste → some da lista → tentar usar token antigo do cliente em `/api/public/perfil` → 401

- [ ] **Step 5: E2E — admin (não superadmin) bloqueado**

Via Playwright ou curl: login admin → `GET /api/admin/clientes` → 403

- [ ] **Step 6: Sem commit (constraint do projeto)**
