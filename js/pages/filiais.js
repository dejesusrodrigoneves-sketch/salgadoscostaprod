// js/pages/filiais.js — módulo SPA (receita Task6)
const HTML_FILIAIS = `<body>
  <div class="header">
    <h2><i class="fas fa-sitemap"></i> Gerenciar Filiais</h2>
    <button class="btn btn-primary" data-action="abrirModalCriarAction"><i class="fas fa-plus"></i> Criar Filial</button>
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
        <button class="btn btn-secondary" data-action="fecharModalAction">Cancelar</button>
        <button class="btn btn-primary" data-action="criarFilialAction">Criar</button>
      </div>
    </div>
  </div>

  <!-- Modal Desvincular Filial -->
  <div class="modal-overlay" id="modalDesvincular">
    <div class="modal-box" style="text-align:center;">
      <div style="width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:24px;background:rgba(245,158,11,0.12);color:#F59E0B;">
        <i class="fas fa-link"></i>
      </div>
      <h3 style="font-size:17px;font-weight:700;color:#FFFCE1;margin-bottom:10px;">Desvincular Filial</h3>
      <p style="font-size:13px;line-height:1.65;color:#94A3B8;margin-bottom:16px;">
        Ao desvincular sua empresa filial, acarretará que ela entrará em <strong style="color:#F59E0B;">modo de teste</strong> e isso <strong style="color:#FFFCE1;">não poderá ser revertido</strong>.
      </p>
      <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:#F59E0B;margin-bottom:20px;">
        <i class="fas fa-exclamation-triangle"></i> Modo teste a partir de <strong id="dataCicloDesvincular">...</strong> — mensalidade integral. Tem certeza disso?
      </div>
      <div class="modal-actions" style="justify-content:center;">
        <button class="btn btn-secondary" data-action="cancelarDesvincularAction">Não</button>
        <button class="btn btn-primary" data-action="confirmarDesvincularAction" style="background:#F59E0B;color:#000;border:none;">Sim, desvincular</button>
      </div>
    </div>
  </div>

  <!-- Modal Excluir Filial -->
  <div class="modal-overlay" id="modalExcluir">
    <div class="modal-box" style="text-align:center;">
      <div style="width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:24px;background:rgba(239,68,68,0.12);color:#EF4444;">
        <i class="fas fa-trash-alt"></i>
      </div>
      <h3 style="font-size:17px;font-weight:700;color:#FFFCE1;margin-bottom:10px;">Excluir Filial</h3>
      <p style="font-size:13px;line-height:1.65;color:#94A3B8;margin-bottom:16px;">
        Você está prestes a apagar essa filial do seu sistema. Todos os valores irão para a <strong style="color:#FFFCE1;">chave PIX cadastrada</strong> na mesma e todos os dados permanecerão guardados conforme <strong style="color:#FFFCE1;">LGPD</strong>.
      </p>
      <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#EF4444;margin-bottom:20px;">
        <i class="fas fa-exclamation-circle"></i> Ação irreversível — filial apagada a partir da data de <strong id="dataCicloExcluir">...</strong>. Tem certeza disso?
      </div>
      <div class="modal-actions" style="justify-content:center;">
        <button class="btn btn-secondary" data-action="cancelarExcluirAction">Não</button>
        <button class="btn btn-primary" data-action="confirmarExcluirAction" style="background:#EF4444;color:#fff;border:none;">Sim, excluir</button>
      </div>
    </div>
  </div>

</body>
`;
let _abort = null;
const _cleanups = [];

const STYLE_FILIAIS = `
    #pageContainer { font-family: 'Plus Jakarta Sans', sans-serif; color: #fff; padding: 20px; }
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

    /* ===== HT — Filiais (únicos) ===== */
    .header { border-bottom: 1px dotted var(--ht-gold); }
    .badge-active { background: var(--ht-gold) !important; color: var(--ht-clove) !important; }
    .badge-pending { background: transparent !important; border: 1px solid var(--ht-saffron) !important; color: var(--ht-fg-muted) !important; }
    .empty { color: var(--ht-fg-muted); }
`;

export  function mount(container, params) {
  unmount();
  _abort = new AbortController();
  container.innerHTML = HTML_FILIAIS;
  if (STYLE_FILIAIS) {
    const s = document.createElement('style');
    s.dataset.page = 'filiais';
    s.textContent = STYLE_FILIAIS;
    document.head.appendChild(s);
    _cleanups.push(function () { s.remove(); });
  }
  (function () {
  const API_BASE = (window.getApiBase ? window.getApiBase() : '');

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
    const skip = options.skipLoading === true;
    const opts = { ...options };
    delete opts.skipLoading;
    if (!skip && typeof showLoading === 'function') showLoading();
    try {
      const res = await authFetch(API_BASE + path, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'API ' + res.status);
      }
      return res.json();
    } finally {
      if (!skip && typeof hideLoading === 'function') hideLoading();
    }
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
            '<button class="btn btn-secondary" data-action="desvincularAction" data-id="' + f.id + '" style="margin-right:8px;"><i class="fas fa-unlink"></i> Desvincular</button>' +
            '<button class="btn btn-danger" data-action="excluirFilialAction" data-id="' + f.id + '"><i class="fas fa-trash"></i> Excluir</button>' +
          '</td>' +
          '</tr>';
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Erro ao carregar filiais: ' + escapeHtml(err.message) + '</td></tr>';
    }
  }

  window.abrirModalCriarAction = window.abrirModalCriar = function() {
    document.getElementById('modalCriar').classList.add('active');
  };

  window.fecharModalAction = window.fecharModal = function() {
    document.getElementById('modalCriar').classList.remove('active');
    document.getElementById('filialNome').value = '';
    document.getElementById('filialJustificativa').value = '';
  };

  window.criarFilialAction = window.criarFilial = async function() {
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

  window.desvincularAction = function(ds) { window._desvincularId = Number(ds.id); document.getElementById('modalDesvincular').classList.add('active'); };
  window.excluirFilialAction = function(ds) { window._excluirId = Number(ds.id); document.getElementById('modalExcluir').classList.add('active'); };

  window.cancelarDesvincularAction = function() { document.getElementById('modalDesvincular').classList.remove('active'); window._desvincularId = null; };
  window.cancelarExcluirAction = function() { document.getElementById('modalExcluir').classList.remove('active'); window._excluirId = null; };

  window.confirmarDesvincularAction = async function() {
    var id = window._desvincularId;
    document.getElementById('modalDesvincular').classList.remove('active');
    window._desvincularId = null;
    if (!id) return;
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

  window.confirmarExcluirAction = async function() {
    var id = window._excluirId;
    document.getElementById('modalExcluir').classList.remove('active');
    window._excluirId = null;
    if (!id) return;
    try {
      await apiFetch('/api/admin/filiais/' + id, { method: 'DELETE' });
      carregarFiliais();
      alert('Filial excluída!');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  async function buscarProximoCiclo(empresaId) {
    try {
      var r = await apiFetch('/api/admin/empresas/' + empresaId + '/next-due-date');
      if (r.nextDueDate) {
        var d = new Date(r.nextDueDate + 'T12:00:00');
        return d.toLocaleDateString('pt-BR');
      }
    } catch (e) {}
    // Fallback client-side: próximo dia útil
    var d = new Date();
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return d.toLocaleDateString('pt-BR');
  }

  async function initFiliais() {
    await carregarFiliais();
    var authUser = getAuthUser();
    var empresaId = authUser?.empresaId;
    if (empresaId) {
      var data = await buscarProximoCiclo(empresaId);
      var elD = document.getElementById('dataCicloDesvincular');
      var elE = document.getElementById('dataCicloExcluir');
      if (elD) elD.textContent = data;
      if (elE) elE.textContent = data;
    }
  }

  initFiliais();
  })();
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
