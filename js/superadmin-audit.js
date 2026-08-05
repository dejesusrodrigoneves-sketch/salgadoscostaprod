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
}

function toggleDetalhes(id, item) {
  const card = document.querySelector('.audit-card[data-id="' + id + '"]');
  if (!card) return;
  const existing = card.querySelector('.audit-details');
  if (existing) {
    existing.remove();
    const chevron = card.querySelector('.audit-chevron');
    if (chevron) chevron.classList.remove('open');
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
