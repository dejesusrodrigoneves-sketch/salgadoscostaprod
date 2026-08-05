# Frontend de Auditoria — Super Admin (Etapa 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar aba "Registros" no superadmin.html com timeline de auditoria em cards, filtros completos (usuário, módulo, severidade, datas) e load more.

**Architecture:** Backend de consulta já existe (`GET /api/audit` com filtros + `GET /api/audit/usuarios`, protegidos por superadmin). Frontend vanilla: markup novo em `superadmin.html`, lógica em `js/superadmin-audit.js` (ES module com funções puras exportadas p/ teste + DOM wiring guardado por `typeof document`), estilos em `css/superadmin-page.css`. Único ajuste backend: 1 linha p/ filtrar atores anônimos.

**Tech Stack:** Express 5 (backend), Prisma/pg, HTML+CSS+JS vanilla (ES modules, `"type": "module"`), Vitest 2 (node env), Playwright MCP (E2E manual).

## Global Constraints

- Todas as rotas `/api/audit*` exigem `authenticate` + `authorize('superadmin')` — não alterar.
- Todo valor renderizado do backend passa por `escapeHtml()` (função já existente em `js/utils.js`).
- Sem dependências novas (nenhum `npm install`).
- Testes automatizados: apenas funções puras de `js/superadmin-audit.js`, em `tests/superadmin-audit.test.js`, rodar com `npm test` na raiz do repo.
- Select de módulo estático: `cliente`, `whatsapp`, `auth`, `pedido`, `geral`.
- Commits: incluir nos steps, mas SÓ executar se o usuário autorizar explicitamente nesta sessão (regra da sessão).
- Servidor de teste: `node server.js` no diretório `backend`, porta 3000. Login de teste: `djesus` / `tsa110594`.

---

### Task 1: Backend — filtrar atores anônimos (`actorId=anon`)

**Files:**
- Modify: `backend/src/routes/auditRoutes.js:9-16`

**Interfaces:**
- Produces: `GET /api/audit?actorId=anon` e `GET /api/audit?actorId=null` retornam apenas eventos com `actorId: null` (lista `listAudit` com `where.actorId = null`).

- [ ] **Step 1: Implementar o ajuste**

Em `backend/src/routes/auditRoutes.js`, na rota `GET /`, mudar a desestruturação e a passagem de filtro:

```js
router.get('/', asyncHandler(async (req, res) => {
  const { module, action, severity, dataInicio, dataFim, page, limit } = req.query;
  const rawActorId = req.query.actorId;
  const actorId = (rawActorId === 'anon' || rawActorId === 'null') ? null : rawActorId;
  const result = await auditRepository.listAudit({
    actorId, module, action, severity, dataInicio, dataFim, page, limit,
    empresaId: req.user.empresaId || 1,
  });
  res.json(result);
}));
```

- [ ] **Step 2: Verificar com curl**

Subir servidor (se não estiver rodando):

```bash
cd backend && (node server.js > /tmp/sic-server.log 2>&1 &) && sleep 2 && curl -s http://localhost:3000/health
```

Obter token e testar:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
curl -s "http://localhost:3000/api/audit?actorId=anon" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/audit?actorId=99" -H "Authorization: Bearer $TOKEN"
```

Expected: primeira resposta só com itens de `actorId` null (pode ser lista vazia se não houver anon); segunda resposta com itens de `actorId` 99 ou lista vazia — sem erro 500.

- [ ] **Step 3: Commit (se autorizado)**

```bash
git add backend/src/routes/auditRoutes.js
git commit -m "fix(audit): suporta filtro actorId=anon/null"
```

---

### Task 2: Funções puras de `js/superadmin-audit.js` (TDD)

**Files:**
- Create: `tests/superadmin-audit.test.js`
- Create: `js/superadmin-audit.js` (somente funções puras + exports nesta task; DOM wiring vem na Task 3)

**Interfaces:**
- Produces (assinaturas exatas usadas nas Tasks 3-4):
  - `MODULOS` — `export const MODULOS = ['cliente', 'whatsapp', 'auth', 'pedido', 'geral'];`
  - `formatarAcao(action)` → string legível pt-BR; fallback = `action` original
  - `formatarSeveridade(sev)` → `'Info' | 'Aviso' | 'Crítico'` (fallback: valor original)
  - `SEVERIDADE_CLASSES` — `export const SEVERIDADE_CLASSES = { info: 'severity-info', warning: 'severity-warning', critical: 'severity-critical' };`
  - `buildQueryParams({ actorId, module, severity, dataInicio, dataFim, page, limit })` → query string `a=1&b=2` (sem `?`), omitindo campos vazios/undefined/null; `dataInicio`/`dataFim` no formato `YYYY-MM-DD` são convertidos para `YYYY-MM-DDT00:00:00` e `YYYY-MM-DDT23:59:59`; `actorId` igual a `'anon'` vira `anon`
  - O arquivo NÃO pode tocar `document`/`window` no import (guard `typeof document !== 'undefined'` para o wiring — wiring vazio nesta task)

- [ ] **Step 1: Escrever o teste (falha primeiro)**

`tests/superadmin-audit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  formatarAcao,
  formatarSeveridade,
  SEVERIDADE_CLASSES,
  buildQueryParams,
  MODULOS,
} from '../js/superadmin-audit.js';

describe('formatarAcao', () => {
  it('traduz ações conhecidas', () => {
    expect(formatarAcao('cliente.register')).toBe('Cadastro de cliente');
    expect(formatarAcao('cliente.login_failed')).toBe('Login de cliente falhou');
    expect(formatarAcao('whatsapp.qr_gerado')).toBe('QR gerado');
    expect(formatarAcao('auth.login')).toBe('Login');
    expect(formatarAcao('pedido.create')).toBe('Pedido criado');
  });
  it('fallback para ação desconhecida', () => {
    expect(formatarAcao('modulo.desconhecido')).toBe('modulo.desconhecido');
  });
});

describe('formatarSeveridade', () => {
  it('mapeia severidades', () => {
    expect(formatarSeveridade('info')).toBe('Info');
    expect(formatarSeveridade('warning')).toBe('Aviso');
    expect(formatarSeveridade('critical')).toBe('Crítico');
  });
  it('fallback para valor desconhecido', () => {
    expect(formatarSeveridade('weird')).toBe('weird');
  });
  it('expõe classes de severidade', () => {
    expect(SEVERIDADE_CLASSES).toEqual({
      info: 'severity-info',
      warning: 'severity-warning',
      critical: 'severity-critical',
    });
  });
});

describe('MODULOS', () => {
  it('contém os módulos conhecidos', () => {
    expect(MODULOS).toEqual(['cliente', 'whatsapp', 'auth', 'pedido', 'geral']);
  });
});

describe('buildQueryParams', () => {
  it('converte datas para ISO local', () => {
    const qs = buildQueryParams({ dataInicio: '2026-08-01', dataFim: '2026-08-04' });
    expect(qs).toContain('dataInicio=2026-08-01T00%3A00%3A00');
    expect(qs).toContain('dataFim=2026-08-04T23%3A59%3A59');
  });
  it('omite campos vazios', () => {
    expect(buildQueryParams({ module: '', severity: undefined, page: 1 })).toBe('page=1');
  });
  it('mantém actorId anon', () => {
    expect(buildQueryParams({ actorId: 'anon' })).toBe('actorId=anon');
  });
  it('inclui todos os filtros preenchidos', () => {
    const qs = buildQueryParams({ actorId: '5', module: 'whatsapp', severity: 'critical', page: 2, limit: 50 });
    expect(qs).toBe('actorId=5&module=whatsapp&severity=critical&page=2&limit=50');
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
npm test -- --run tests/superadmin-audit.test.js
```

Expected: FAIL — `Cannot find module '../js/superadmin-audit.js'`.

- [ ] **Step 3: Implementar funções puras**

`js/superadmin-audit.js` (nesta task, sem código de DOM — apenas guard inerte):

```js
export const MODULOS = ['cliente', 'whatsapp', 'auth', 'pedido', 'geral'];

export const SEVERIDADE_CLASSES = {
  info: 'severity-info',
  warning: 'severity-warning',
  critical: 'severity-critical',
};

const ACAO_LABELS = {
  'cliente.register': 'Cadastro de cliente',
  'cliente.login': 'Login de cliente',
  'cliente.login_failed': 'Login de cliente falhou',
  'cliente.update': 'Dados de cliente atualizados',
  'pedido.create': 'Pedido criado',
  'whatsapp.instance_create': 'Instância criada',
  'whatsapp.instance_create_failed': 'Criação de instância falhou',
  'whatsapp.instance_delete': 'Instância removida',
  'whatsapp.qr_gerado': 'QR gerado',
  'whatsapp.reconnect': 'Reconexão solicitada',
  'whatsapp.test_send': 'Mensagem de teste enviada',
  'whatsapp.contact_send': 'Mensagem enviada',
  'whatsapp.legacy_producao': 'Pedido movido para produção',
  'whatsapp.legacy_pronto': 'Pedido marcado como pronto',
  'whatsapp.legacy_em_rota': 'Pedido em rota de entrega',
  'auth.login': 'Login',
  'auth.login_failed': 'Login falhou',
};

export function formatarAcao(action) {
  return ACAO_LABELS[action] || action;
}

export function formatarSeveridade(sev) {
  if (sev === 'info') return 'Info';
  if (sev === 'warning') return 'Aviso';
  if (sev === 'critical') return 'Crítico';
  return sev;
}

function toISO(v, fim) {
  const [y, m, d] = v.split('-');
  return fim ? `${y}-${m}-${d}T23:59:59` : `${y}-${m}-${d}T00:00:00`;
}

export function buildQueryParams({ actorId, module, severity, dataInicio, dataFim, page, limit } = {}) {
  const p = new URLSearchParams();
  if (actorId != null && actorId !== '') p.set('actorId', actorId);
  if (module) p.set('module', module);
  if (severity) p.set('severity', severity);
  if (dataInicio) p.set('dataInicio', toISO(dataInicio, false));
  if (dataFim) p.set('dataFim', toISO(dataFim, true));
  if (page) p.set('page', String(page));
  if (limit) p.set('limit', String(limit));
  return p.toString();
}

if (typeof document !== 'undefined') {
  // DOM wiring adicionado na Task 3
}
```

Nota: `URLSearchParams` existe no Node ≥ 18 — sem polyfill.

- [ ] **Step 4: Rodar teste — deve passar**

```bash
npm test -- --run tests/superadmin-audit.test.js
```

Expected: PASS — 5 describes, todos os asserts verdes.

- [ ] **Step 5: Commit (se autorizado)**

```bash
git add js/superadmin-audit.js tests/superadmin-audit.test.js
git commit -m "feat(audit): funções puras de formatação e query"
```

---

### Task 3: DOM wiring em `js/superadmin-audit.js`

**Files:**
- Modify: `js/superadmin-audit.js` (substituir o guard `if (typeof document !== 'undefined')` pelo wiring completo)

**Interfaces:**
- Consumes: `formatarAcao`, `formatarSeveridade`, `SEVERIDADE_CLASSES`, `buildQueryParams`, `MODULOS` (Task 2); `escapeHtml`, `toast` de `js/utils.js` (globais do browser).
- Produces: expõe no `window` (usado pelos `onclick` inline do HTML na Task 4):
  - `window.superadminAudit = { carregarAudit, carregarMaisAudit, expandirCard, aplicarFiltros, limparFiltros, popularSelectUsuarios }`

- [ ] **Step 1: Substituir o guard pelo wiring completo**

Trocar o final do arquivo por:

```js
function el(id) {
  return document.getElementById(id);
}

let page = 1;
let total = 0;
let hasMore = false;
let carregando = false;

function readFiltros() {
  return {
    actorId: el('filtroUsuario').value || '',
    module: el('filtroModulo').value || '',
    severity: el('filtroSeveridade').value || '',
    dataInicio: el('filtroInicio').value || '',
    dataFim: el('filtroFim').value || '',
  };
}

function atualizarContador() {
  el('auditContador').textContent = total > 0 ? `${Math.min(page * 50, total)} de ${total} eventos` : '';
  el('btnLoadMore').style.display = hasMore ? '' : 'none';
}

function renderTimeline(items) {
  const container = el('timeline');
  if (!items || items.length === 0) {
    if (page === 1) {
      container.innerHTML = '<div class="timeline-empty">Nenhum registro encontrado</div>';
    }
    hasMore = false;
    atualizarContador();
    return;
  }
  items.forEach(function (item) {
    const sev = item.severity || 'info';
    const sevClass = SEVERIDADE_CLASSES[sev] || 'severity-info';
    const sevLabel = formatarSeveridade(sev);
    const ator = item.actorUsername || (item.actorType === 'anon' ? 'Visitante (sem login)' : '—');
    const target = item.targetId != null ? ` · ${escapeHtml(item.targetType || 'alvo')} #${escapeHtml(String(item.targetId))}` : '';
    const reason = item.reason ? `<div class="audit-reason"><strong>Motivo:</strong> ${escapeHtml(item.reason)}</div>` : '';
    const data = item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '—';
    const hasDetalhes = item.before || item.after || item.changedFields;
    const chevron = hasDetalhes ? '<i class="fas fa-chevron-down audit-chevron"></i>' : '';
    const card = document.createElement('div');
    card.className = 'audit-card ' + sevClass;
    card.dataset.id = String(item.id);
    const cab = document.createElement('div');
    cab.className = 'audit-card-head';
    cab.innerHTML =
      '<div class="audit-card-title"><strong>' + escapeHtml(formatarAcao(item.action)) + '</strong>' +
      '<span class="audit-badge module">' + escapeHtml(item.module || 'geral') + '</span>' +
      '<span class="audit-badge severity">' + escapeHtml(sevLabel) + '</span></div>' +
      '<div class="audit-meta">' + escapeHtml(ator) + ' · ' + data + target + '</div>' +
      reason + ' ' + chevron;
    cab.onclick = function () { toggleDetalhes(String(item.id), item); };
    card.appendChild(cab);
    container.appendChild(card);
  });
  if (page === 1 && items.length === 0) {
    container.innerHTML = '<div class="timeline-empty">Nenhum registro encontrado</div>';
  }
}

function toggleDetalhes(id, item) {
  const card = document.querySelector('.audit-card[data-id="' + id + '"]');
  if (!card) return;
  const existing = card.querySelector('.audit-details');
  if (existing) {
    existing.remove();
    card.querySelector('.audit-chevron').classList.remove('open');
    return;
  }
  const div = document.createElement('div');
  div.className = 'audit-details';
  let html = '';
  if (item.changedFields && item.changedFields.length) {
    html += '<div class="audit-chips">' + item.changedFields.map(function (f) {
      return '<span class="chip">' + escapeHtml(f) + '</span>';
    }).join('') + '</div>';
  }
  if (item.before) html += '<div class="audit-detail-block"><h4>Antes</h4><pre>' + escapeHtml(JSON.stringify(item.before, null, 2)) + '</pre></div>';
  if (item.after) html += '<div class="audit-detail-block"><h4>Depois</h4><pre>' + escapeHtml(JSON.stringify(item.after, null, 2)) + '</pre></div>';
  if (!item.before && !item.after && !(item.changedFields && item.changedFields.length)) {
    html = '<div class="audit-detail-block"><em>Sem detalhes adicionais</em></div>';
  }
  div.innerHTML = html;
  card.appendChild(div);
  const chevron = card.querySelector('.audit-chevron');
  if (chevron) chevron.classList.add('open');
}

async function carregarAudit(novaPagina) {
  if (carregando) return;
  carregando = true;
  page = novaPagina || 1;
  const container = el('timeline');
  try {
    const filtros = readFiltros();
    filtros.page = page;
    filtros.limit = 50;
    const qs = buildQueryParams(filtros);
    const res = await fetch('/api/audit?' + qs, {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
    });
    if (!res.ok) {
      const err = await res.json().catch(function () { return { error: 'Erro ' + res.status }; });
      throw new Error(err.error || 'Erro ao carregar');
    }
    const data = await res.json();
    total = data.total || 0;
    hasMore = data.totalPages > page;
    if (page === 1) container.innerHTML = '';
    renderTimeline(data.items || []);
    atualizarContador();
    el('timelineErro').style.display = 'none';
  } catch (e) {
    if (typeof toast === 'function') toast(e.message || 'Erro ao carregar registros', 'danger');
    if (page === 1) {
      container.innerHTML = '<div class="timeline-empty">Erro ao carregar registros<button class="btn btn-primary" onclick="superadminAudit.carregarAudit(1)">Tentar novamente</button></div>';
    }
  } finally {
    carregando = false;
  }
}

function getToken() {
  try {
    return (JSON.parse(localStorage.getItem('authUser') || '{}')).token || '';
  } catch (e) {
    return '';
  }
}

function carregarMaisAudit() {
  carregarAudit(page + 1);
}

function aplicarFiltros() {
  carregarAudit(1);
}

function limparFiltros() {
  el('filtroUsuario').value = '';
  el('filtroModulo').value = '';
  el('filtroSeveridade').value = '';
  el('filtroInicio').value = '';
  el('filtroFim').value = '';
  carregarAudit(1);
}

async function popularSelectUsuarios() {
  const select = el('filtroUsuario');
  if (!select) return;
  select.innerHTML = '<option value="">Todos os usuários</option>';
  try {
    const atores = await fetch('/api/audit/usuarios', {
      headers: { Authorization: 'Bearer ' + getToken() },
    }).then(function (r) { return r.json(); });
    if (!Array.isArray(atores)) return;
    atores.forEach(function (a) {
      const opt = document.createElement('option');
      opt.value = a.actorId === null ? 'anon' : String(a.actorId);
      const nome = a.actorUsername || (a.actorType === 'anon' ? 'Visitante (sem login)' : 'Ator ' + a.actorId);
      const papel = a.actorRole ? ' (' + a.actorRole + ')' : '';
      opt.textContent = nome + papel;
      opt.title = 'Ações: ' + (a.totalActions || 0) + ' · Última: ' + (a.lastActivity ? new Date(a.lastActivity).toLocaleString('pt-BR') : '—');
      select.appendChild(opt);
    });
  } catch (e) {
    // não bloqueia a timeline; select fica só com "Todos os usuários"
  }
}

function init() {
  popularSelectUsuarios();
  ['filtroUsuario', 'filtroModulo', 'filtroSeveridade', 'filtroInicio', 'filtroFim'].forEach(function (id) {
    const node = el(id);
    if (node) node.addEventListener('change', aplicarFiltros);
  });
  const btn = el('btnLimparFiltros');
  if (btn) btn.addEventListener('click', limparFiltros);
  const loadMore = el('btnLoadMore');
  if (loadMore) loadMore.addEventListener('click', carregarMaisAudit);
}

export { carregarAudit, carregarMaisAudit, aplicarFiltros, limparFiltros, popularSelectUsuarios };

if (typeof document !== 'undefined') {
  window.superadminAudit = { carregarAudit, carregarMaisAudit, expandirCard: toggleDetalhes, aplicarFiltros, limparFiltros, popularSelectUsuarios };
  document.addEventListener('DOMContentLoaded', init);
}
```

- [ ] **Step 2: Rodar testes unitários — não deve quebrar**

```bash
npm test -- --run tests/superadmin-audit.test.js
```

Expected: PASS (mesmos 5 describes; o guard `typeof document` mantém o import seguro no node).

- [ ] **Step 3: Smoke manual no browser**

Servidor rodando (Task 1). Navegar `http://localhost:3000/superadmin.html` com Playwright. Se `authGuard` redirecionar, logar em `login.html` com `djesus`/`tsa110594` e voltar.

Verificar via console: `typeof window.superadminAudit.carregarAudit === 'function'` e `superadminAudit.carregarAudit(1)` sem exceções. Aba Registros ainda sem markup — chamadas apenas pelo console.

- [ ] **Step 4: Commit (se autorizado)**

```bash
git add js/superadmin-audit.js
git commit -m "feat(audit): timeline DOM wiring no superadmin"
```

---

### Task 4: `superadmin.html` — tab e markup da seção Registros

**Files:**
- Modify: `superadmin.html` (tabs linha 16-20; novo bloco de tab-content; `switchTab`; script tag)

**Interfaces:**
- Consumes: `window.superadminAudit.*` (Task 3)
- Produces: elementos com ids `filtroUsuario`, `filtroModulo`, `filtroSeveridade`, `filtroInicio`, `filtroFim`, `btnLimparFiltros`, `timeline`, `timelineErro`, `auditContador`, `btnLoadMore`; tab id `tabRegistros`; case `'registros'` no `switchTab`.

- [ ] **Step 1: Adicionar botão da tab**

Em `superadmin.html` (tabs, após a linha do "Histórico de Login"):

```html
  <button class="tab" onclick="switchTab('registros',this)"><i class="fas fa-scroll"></i> Registros</button>
```

- [ ] **Step 2: Adicionar o tab-content após o bloco `tabLogs` (antes do comentário `<!-- Empresas tab removida -->`)**

```html
<!-- Audit logs tab -->
<div class="tab-content" id="tabRegistros">
  <div class="card">
    <h2><i class="fas fa-scroll"></i> Registros de Auditoria</h2>
    <div class="audit-filters">
      <div>
        <label for="filtroUsuario">Usuário</label>
        <select id="filtroUsuario" aria-label="Filtrar por usuário"><option value="">Todos os usuários</option></select>
      </div>
      <div>
        <label for="filtroModulo">Módulo</label>
        <select id="filtroModulo" aria-label="Filtrar por módulo">
          <option value="">Todos os módulos</option>
          <option value="cliente">cliente</option>
          <option value="whatsapp">whatsapp</option>
          <option value="auth">auth</option>
          <option value="pedido">pedido</option>
          <option value="geral">geral</option>
        </select>
      </div>
      <div>
        <label for="filtroSeveridade">Severidade</label>
        <select id="filtroSeveridade" aria-label="Filtrar por severidade">
          <option value="">Todas</option>
          <option value="info">Info</option>
          <option value="warning">Aviso</option>
          <option value="critical">Crítico</option>
        </select>
      </div>
      <div>
        <label for="filtroInicio">De</label>
        <input type="date" id="filtroInicio" aria-label="Data inicial">
      </div>
      <div>
        <label for="filtroFim">Até</label>
        <input type="date" id="filtroFim" aria-label="Data final">
      </div>
      <div class="audit-filters-actions">
        <button class="btn btn-primary" id="btnLimparFiltros"><i class="fas fa-eraser"></i> Limpar filtros</button>
      </div>
    </div>
    <div class="audit-summary" id="timelineErro" style="display:none;"></div>
    <div class="timeline" id="timeline"><div class="timeline-empty">Carregando...</div></div>
    <div class="audit-footer">
      <span id="auditContador"></span>
      <button class="btn btn-primary" id="btnLoadMore" style="display:none;"><i class="fas fa-plus"></i> Carregar mais</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Registrar a tab no `switchTab`**

Em `switchTab`, no map: `{ usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', logs: 'tabLogs', registros: 'tabRegistros' }` e, no `if` final, adicionar:

```js
  if (tab === 'registros') superadminAudit.carregarAudit(1);
```

- [ ] **Step 4: Carregar o script**

Adicionar antes de `</body>` (junto ao `bcrypt`/`theme.js`):

```html
<script src="js/superadmin-audit.js" type="module"></script>
```

Nota: `type="module"` é obrigatório (o arquivo usa `export`). Script module é deferido — executa após o parse, então `switchTab` (chamado por clique, depois do load) já encontra `window.superadminAudit`. `escapeHtml`/`toast` de `js/utils.js` (classic script) ficam como globals e são acessíveis do module.

- [ ] **Step 5: Verificar no browser (Playwright)**

Recarregar `http://localhost:3000/superadmin.html`. Clicar tab "Registros". Expected:
- Timeline mostra "Carregando..." → depois cards (ou "Nenhum registro encontrado" se vazio)
- Select de usuário populado com atores de `/api/audit/usuarios`
- Tabs antigas continuam funcionando (Usuários/Senhas/Login)

- [ ] **Step 6: Commit (se autorizado)**

```bash
git add superadmin.html
git commit -m "feat(audit): aba Registros no superadmin"
```

---

### Task 5: Estilos da timeline — `css/superadmin-page.css`

**Files:**
- Modify: `css/superadmin-page.css` (append no fim do arquivo)

**Interfaces:**
- Consumes: classes usadas no Task 3/4: `.audit-filters`, `.audit-filters-actions`, `.audit-summary`, `.timeline`, `.timeline-empty`, `.audit-footer`, `.audit-card`, `.audit-card-head`, `.audit-card-title`, `.audit-meta`, `.audit-badge.module`, `.audit-badge.severity`, `.audit-reason`, `.audit-chevron` (+ `.open`), `.audit-details`, `.audit-detail-block`, `.audit-chips`, `.chip`, `.severity-info`, `.severity-warning`, `.severity-critical`.

- [ ] **Step 1: Adicionar estilos (append no fim de `css/superadmin-page.css`)**

```css
/* ═══════════════════════════════════════════════════════
   Audit timeline
   ═══════════════════════════════════════════════════════ */

.audit-filters {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px; margin-bottom: 18px; align-items: end;
}
.audit-filters label { display:block; font-size:11px; font-weight:600; color:#64748b; margin-bottom:4px; }
.audit-filters select, .audit-filters input { margin-bottom:0; }
.audit-filters-actions { display:flex; align-items:center; }

.timeline { position:relative; padding-left:24px; }
.timeline::before {
  content:''; position:absolute; left:8px; top:4px; bottom:4px;
  width:2px; background:#e2e8f0; border-radius:2px;
}
.timeline-empty {
  padding:28px; text-align:center; color:#94a3b8; font-size:13px;
  display:flex; flex-direction:column; gap:12px; align-items:center;
}

.audit-card {
  position:relative; background:#fff; border:1px solid #e2e8f0;
  border-radius:10px; padding:12px 14px; margin-bottom:12px;
  box-shadow:0 1px 3px rgba(0,0,0,0.04); cursor:pointer; transition:border-color 0.2s;
}
.audit-card::before {
  content:''; position:absolute; left:-21px; top:16px; width:10px; height:10px;
  border-radius:50%; background:#3b82f6; border:2px solid #fff; box-shadow:0 0 0 2px #e2e8f0;
}
.audit-card.severity-warning::before { background:#f59e0b; }
.audit-card.severity-critical::before { background:#dc2626; }
.audit-card.severity-critical { border-color:#fecaca; background:#fff7f7; }
.audit-card:hover { border-color:#f97316; }

.audit-card-head { display:flex; flex-wrap:wrap; gap:6px 10px; align-items:center; }
.audit-card-title { display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1; min-width:200px; }
.audit-meta { width:100%; color:#64748b; font-size:12px; }
.audit-reason { width:100%; color:#b45309; font-size:12px; background:#fffbeb; border-radius:6px; padding:6px 8px; }
.audit-chevron { color:#94a3b8; margin-left:auto; transition:transform 0.2s; }
.audit-chevron.open { transform:rotate(180deg); }

.audit-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase; letter-spacing:0.4px; }
.audit-badge.module { background:#e0f2fe; color:#0369a1; }
.audit-badge.severity { background:#e2e8f0; color:#475569; }
.audit-card.severity-warning .audit-badge.severity { background:#fef3c7; color:#b45309; }
.audit-card.severity-critical .audit-badge.severity { background:#fee2e2; color:#b91c1c; }

.audit-details { margin-top:10px; padding-top:10px; border-top:1px dashed #e2e8f0; width:100%; }
.audit-detail-block h4 { font-size:11px; color:#64748b; margin:8px 0 4px; text-transform:uppercase; letter-spacing:0.4px; }
.audit-detail-block pre {
  background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;
  padding:10px; font-size:11px; overflow-x:auto; max-height:240px; overflow-y:auto;
  color:#1e293b; margin:0;
}
.audit-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
.chip { background:#f1f5f9; color:#334155; font-size:11px; padding:3px 10px; border-radius:999px; border:1px solid #e2e8f0; }

.audit-footer { display:flex; justify-content:space-between; align-items:center; margin-top:8px; color:#94a3b8; font-size:12px; gap:12px; flex-wrap:wrap; }

@media(max-width:480px) {
  .audit-filters { grid-template-columns:1fr; }
  .audit-card { padding:10px 12px; }
  .timeline { padding-left:20px; }
  .audit-card::before { left:-17px; }
}
```

- [ ] **Step 2: Verificar visual (Playwright)**

Recarregar superadmin.html → aba Registros. Expected:
- Linha vertical com dots coloridos alinhados
- Cards com badge de módulo/severidade, ator, data
- Expandir card mostra "Antes/Depois" com `<pre>` formatado; chevron rotaciona
- Card critical com borda/label vermelho
- Responsivo: viewport 375px sem quebra de grid

- [ ] **Step 3: Commit (se autorizado)**

```bash
git add css/superadmin-page.css
git commit -m "style(audit): timeline de auditoria no superadmin"
```

---

### Task 6: E2E completo (Playwright + curl)

**Files:**
- Nenhum (verificação + limpeza de dados de teste)

- [ ] **Step 1: Gerar eventos de teste variados**

```bash
# login falho (auth)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"senha_errada_teste"}'
# login de cliente falho
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/public/cliente/login -H "Content-Type: application/json" -d '{"telefone":"11999990000","senha":"errada_teste"}'
```

Expected: 401 em ambos; gera eventos `auth.login_failed` e `cliente.login_failed`.

- [ ] **Step 2: Validar filtros via API (curl)**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
curl -s "http://localhost:3000/api/audit?severity=warning&limit=5" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/audit?module=auth&actorId=1&limit=5" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/audit/usuarios" -H "Authorization: Bearer $TOKEN"
```

Expected: filtros retornam subconjuntos corretos; `/usuarios` lista atores com `lastActivity` e `totalActions`.

- [ ] **Step 3: Fluxo completo no browser (Playwright MCP)**

1. Navegar `http://localhost:3000/superadmin.html`; logar se preciso (`djesus`/`tsa110594`).
2. Clicar tab "Registros" → timeline carrega com os eventos de teste no topo.
3. Select usuário mostra "djesus (superadmin)" e "Visitante (sem login)" (dos eventos anon) quando existirem.
4. Filtrar `severity=warning` → só avisos visíveis. Limpar filtros → tudo de volta.
5. Filtrar por usuário específico → só eventos dele.
6. Datas: definir "De" = hoje → eventos de hoje; "Até" = ontem → lista vazia "Nenhum registro encontrado".
7. Expandir card com `before`/`after` (ex. `cliente.update`) → "Antes"/"Depois" visíveis; nenhum campo `password`, `token`, `qr` (se houver `[REDACTED]` aparece).
8. Load more: com > 50 eventos o botão carrega página 2; senão botão oculto e contador "X de Y eventos".
9. Responsivo: viewport 375×667 — grid de filtros empilha, cards legíveis.
10. Tabs antigas (Usuários, Senhas, Histórico de Login) seguem funcionando.

- [ ] **Step 4: Limpeza dos dados de teste**

Remover os eventos de teste gerados no Step 1 (login_failed de teste) via SQL direto (padrão da sessão, via `psql`/conexão do `.env` do backend) ou via Prisma studio. NÃO truncar `audit_logs` inteiro — a timeline deve reter eventos reais pré-existentes. Registrar o comando usado no output.

- [ ] **Step 5: Rodar suite completa de testes automatizados**

```bash
npm test
```

Expected: PASS — `tests/superadmin-audit.test.js` verde, sem outros testes quebrados.

- [ ] **Step 6: Commit (se autorizado)**

```bash
git add -A
git commit -m "feat(audit): aba Registros de auditoria no superadmin"
```
