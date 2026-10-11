// js/pages/entregador.js — módulo SPA (receita Task3/Task5)
const HTML_ENTREGADOR = `<body>

<div class="toast-container" id="toastContainer"></div>

<!-- Modal Redefinir Senha -->
<div id="modalResetSenha" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
  <div style="background:#fff; border-radius:12px; padding:24px; width:90%; max-width:400px; box-shadow:0 8px 32px rgba(0,0,0,0.2);">
    <h3 style="margin:0 0 16px; font-size:18px;"><i class="fas fa-key"></i> Redefinir Senha</h3>
    <p style="margin:0 0 12px; font-size:14px; color:#64748b;">Entregador: <strong id="modalResetNome"></strong></p>
    <div style="margin-bottom:12px;">
      <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Nova senha</label>
      <input type="password" id="modalResetPassword" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; box-sizing:border-box;" placeholder="Mín. 6 caracteres, maiúscula, minúscula e número">
    </div>
    <div style="margin-bottom:12px;">
      <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Confirmar senha</label>
      <input type="password" id="modalResetPasswordConfirm" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; box-sizing:border-box;" placeholder="Repita a senha">
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
        <input type="checkbox" id="modalResetSendWhatsApp" checked>
        Enviar via WhatsApp
      </label>
    </div>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
      <button class="btn btn-ghost" data-action="fecharModalResetAction">Cancelar</button>
      <button class="btn btn-primary" data-action="confirmarResetSenhaAction"><i class="fas fa-check"></i> Redefinir</button>
    </div>
  </div>
</div>

<div class="app">
  <!-- Sidebar - Gerenciamento de Entregadores -->
  <aside class="sidebar">
    <h2><i class="fas fa-motorcycle"></i> Entregadores</h2>

    <div>
      <h3>Cadastrar Entregador</h3>
      <div class="form-group">
        <label>Nome Completo</label>
        <input type="text" id="inpNome" placeholder="Nome do entregador">
      </div>
      <div class="form-group">
        <label>Endereço</label>
        <input type="text" id="inpEndereco" placeholder="Endereço">
      </div>
      <div class="form-group">
        <label>WhatsApp</label>
        <input type="text" id="inpWhatsapp" placeholder="21999999999">
      </div>
      <div class="form-group">
        <label>Username (login)</label>
        <input type="text" id="inpUsername" placeholder="Ex: joao.silva">
      </div>
      <div class="form-group">
        <label>Chave Pix</label>
        <input type="text" id="inpPix" placeholder="CPF, telefone ou e-mail">
      </div>
      <br />
      <button class="btn btn-primary" style="width:100%;margin-top:4px;" data-action="salvarEntregadorAction">
        <i class="fas fa-plus"></i> Cadastrar
      </button>
    </div>

    <div>
      <h3>Entregadores Ativos</h3>
      <div class="driver-list" id="driverList"></div>
    </div>
  </aside>

</div>

</body>
`;
let _abort = null;
const _cleanups = [];
let entregadorPollId = null;

export  function mount(container, params) {
  unmount();
  _abort = new AbortController();
  _cleanups.push(pageCss('css/entregador-page.css', 'entregador'));
  container.innerHTML = HTML_ENTREGADOR;
  (function () {
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!_au.role || !['admin', 'superadmin', 'entregador'].includes(_au.role)) { goTo('admin'); return; }

  var authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  var API_BASE = (window.getApiBase ? window.getApiBase() : window.location.origin) + '/api';
  var TOKEN = (authUser && authUser.token) || (typeof safeGetToken === 'function' ? safeGetToken() : '');

  async function apiRequest(path, options) {
    options = options || {};
    const skip = options.skipLoading === true;
    const opts = { ...options };
    delete opts.skipLoading;
    if (!skip && typeof showLoading === 'function') showLoading();
    try {
      var url = API_BASE + path;
      var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      var res = await authFetch(url, Object.assign({}, opts, { headers: headers }));
      if (!res.ok) {
        var err = await res.json().catch(function () { return { error: 'Erro na requisição' }; });
        throw new Error(err.error || 'Erro HTTP ' + res.status);
      }
      return res.json();
    } finally {
      if (!skip && typeof hideLoading === 'function') hideLoading();
    }
  }

  // CRUD Entregadores
  var editandoEntregadorId = null;

  window.salvarEntregador = async function () {
    var nome = document.getElementById('inpNome').value.trim();
    var endereco = document.getElementById('inpEndereco').value.trim();
    var whatsapp = document.getElementById('inpWhatsapp').value.trim();
    var username = document.getElementById('inpUsername').value.trim();
    var chavePix = document.getElementById('inpPix').value.trim();

    if (!nome) { toast('Nome é obrigatório', 'danger'); return; }
    if (!username) { toast('Username é obrigatório', 'danger'); return; }

    try {
      if (editandoEntregadorId) {
        await apiRequest('/entregadores/' + editandoEntregadorId, {
          method: 'PUT', body: JSON.stringify({ nome: nome, endereco: endereco, whatsapp: whatsapp, username: username, chavePix: chavePix, ativo: true })
        });
        toast('Entregador atualizado!');
      } else {
        try {
          await apiRequest('/entregadores', {
            method: 'POST',
            body: JSON.stringify({ nome: nome, endereco: endereco, whatsapp: whatsapp, username: username, chavePix: chavePix, ativo: true })
          });
        } catch (e) { toast('Erro ao cadastrar entregador', 'danger'); return; }
        toast('Entregador cadastrado!');
      }
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'danger');
      return;
    }

    document.getElementById('inpNome').value = '';
    document.getElementById('inpEndereco').value = '';
    document.getElementById('inpWhatsapp').value = '';
    document.getElementById('inpUsername').value = '';
    document.getElementById('inpPix').value = '';
    editandoEntregadorId = null;
    document.querySelector('.sidebar h3').textContent = 'Cadastrar Entregador';
  };

  window.editarEntregador = function (id, nome, endereco, whatsapp, username, chavePix) {
    document.getElementById('inpNome').value = nome;
    document.getElementById('inpEndereco').value = endereco || '';
    document.getElementById('inpWhatsapp').value = whatsapp || '';
    document.getElementById('inpUsername').value = username || '';
    document.getElementById('inpPix').value = chavePix || '';
    editandoEntregadorId = id;
    document.querySelector('.sidebar h3').textContent = 'Editar Entregador';
    toast('Editando entregador', 'info');
  };

  window.toggleAtivo = async function (id, ativo) {
    try {
      await apiRequest('/entregadores/' + id + '/toggle', {
        method: 'PATCH', body: JSON.stringify({ ativo: ativo })
      });
    } catch (e) { toast('Erro ao alterar status', 'danger'); return; }
    toast(ativo ? 'Entregador ativado' : 'Entregador desativado');
  };

  window.excluirEntregador = async function (id) {
    if (!(await confirmModal('Excluir este entregador?'))) return;
    try {
      await apiRequest('/entregadores/' + id, { method: 'DELETE' });
    } catch (e) { toast('Erro ao excluir entregador', 'danger'); return; }
    toast('Entregador removido', 'danger');
  };

  var resetEntregadorId = null;

  window.abrirModalReset = function (id, nome) {
    resetEntregadorId = id;
    document.getElementById('modalResetNome').textContent = nome;
    document.getElementById('modalResetPassword').value = '';
    document.getElementById('modalResetPasswordConfirm').value = '';
    document.getElementById('modalResetSendWhatsApp').checked = true;
    document.getElementById('modalResetSenha').style.display = 'flex';
  };

  window.fecharModalReset = function () {
    document.getElementById('modalResetSenha').style.display = 'none';
    resetEntregadorId = null;
  };

  window.confirmarResetSenha = async function () {
    var password = document.getElementById('modalResetPassword').value;
    var passwordConfirm = document.getElementById('modalResetPasswordConfirm').value;
    var sendWhatsApp = document.getElementById('modalResetSendWhatsApp').checked;

    if (!password) { toast('Digite a nova senha', 'danger'); return; }
    if (password !== passwordConfirm) { toast('As senhas não conferem', 'danger'); return; }
    if (password.length < 6) { toast('Senha deve ter no mínimo 6 caracteres', 'danger'); return; }
    if (!/[A-Z]/.test(password)) { toast('Senha deve conter pelo menos uma maiúscula', 'danger'); return; }
    if (!/[a-z]/.test(password)) { toast('Senha deve conter pelo menos uma minúscula', 'danger'); return; }
    if (!/[0-9]/.test(password)) { toast('Senha deve conter pelo menos um número', 'danger'); return; }

    try {
      var result = await apiRequest('/entregadores/' + resetEntregadorId + '/password', {
        method: 'PUT',
        body: JSON.stringify({ password: password, sendWhatsApp: sendWhatsApp }),
      });
      fecharModalReset();
      if (result.whatsappSent) {
        toast('Senha redefinida! WhatsApp enviado ✅');
      } else {
        toast('Senha redefinida! WhatsApp não enviado ❌');
      }
    } catch (e) {
      toast(e.message || 'Erro ao redefinir senha', 'danger');
    }
  };

  async function carregarEntregadores() {
    var list = document.getElementById('driverList');
    var entregadores = [];

    try {
      entregadores = await apiRequest('/entregadores?sort=criadoEm', { skipLoading: true });
    } catch (e) { /* ignore */ }

    if (!entregadores.length) {
      list.innerHTML = '<p style="font-size:12px;color:#64748b;">Nenhum entregador cadastrado</p>';
      return;
    }

    list.innerHTML = entregadores.map(function (d) {
      var id = d.id;
      var nome = d.nome;
      var ativo = d.ativo !== false;
      return '<div class="driver-card ' + (ativo ? '' : 'inactive') + '">' +
        '<h4>' + nome + ' <span class="badge ' + (ativo ? 'badge-active' : 'badge-inactive') + '">' + (ativo ? 'Ativo' : 'Inativo') + '</span></h4>' +
        '<div class="info">' +
        (d.username ? '<span>👤 ' + d.username + '</span>' : '') +
        (d.endereco ? '<span>📍 ' + d.endereco + '</span>' : '') +
        (d.whatsapp ? '<span>📱 ' + d.whatsapp + '</span>' : '') +
        (d.chavePix ? '<span>💳 Pix: ' + d.chavePix + '</span>' : '') +
        '</div>' +
        '<div class="actions">' +
        '<button class="btn btn-sm btn-ghost" aria-label="Editar entregador" data-action="editarEntregadorAction" data-id="' + id + '" data-nome="' + (nome || '').replace(/"/g, '&quot;') + '" data-endereco="' + (d.endereco || '').replace(/"/g, '&quot;') + '" data-whatsapp="' + (d.whatsapp || '').replace(/"/g, '&quot;') + '" data-username="' + (d.username || '').replace(/"/g, '&quot;') + '" data-chavepix="' + (d.chavePix || '').replace(/"/g, '&quot;') + '"><i class="fas fa-pen"></i></button>' +
        '<button class="btn btn-sm ' + (ativo ? 'btn-ghost' : 'btn-success') + '" data-action="toggleAtivoAction" data-id="' + id + '" data-ativo="' + (!ativo) + '">' +
        (ativo ? 'Desativar' : 'Ativar') +
        '</button>' +
        '<button class="btn btn-sm btn-ghost" aria-label="Redefinir senha" data-action="abrirModalResetAction" data-id="' + id + '" data-nome="' + (nome || '').replace(/"/g, '&quot;') + '" title="Redefinir senha"><i class="fas fa-key"></i></button>' +
        '<button class="btn btn-sm btn-danger" aria-label="Excluir entregador" data-action="excluirEntregadorAction" data-id="' + id + '"><i class="fas fa-trash"></i></button>' +
        '</div>' +
        '</div>';
    }).join('');
  }
  window.carregarEntregadores = carregarEntregadores;

  // Delegator bridges for dynamically generated cards
  window.editarEntregadorAction = function (ds) {
    window.editarEntregador(ds.id, ds.nome, ds.endereco, ds.whatsapp, ds.username, ds.chavepix);
  };
  window.toggleAtivoAction = function (ds) {
    window.toggleAtivo(ds.id, ds.ativo === 'true');
  };
  window.excluirEntregadorAction = function (ds) {
    window.excluirEntregador(ds.id);
  };
  window.abrirModalResetAction = function (ds) {
    window.abrirModalReset(ds.id, ds.nome);
  };
  window.salvarEntregadorAction = function (ds) {
    if (typeof window.salvarEntregador === 'function') return window.salvarEntregador(ds);
    console.warn('[delegator] handler not ready:', 'salvarEntregadorAction');
  };
  window.fecharModalResetAction = function (ds) {
    if (typeof window.fecharModalReset === 'function') return window.fecharModalReset(ds);
    console.warn('[delegator] handler not ready:', 'fecharModalResetAction');
  };
  window.confirmarResetSenhaAction = function (ds) {
    if (typeof window.confirmarResetSenha === 'function') return window.confirmarResetSenha(ds);
    console.warn('[delegator] handler not ready:', 'confirmarResetSenhaAction');
  };

  // Poll drivers
  entregadorPollId = setInterval(carregarEntregadores, 15000);
  carregarEntregadores();
  })();
  return cleanup;
}
function cleanup() {
  try { clearInterval(entregadorPollId); } catch (e) {}
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
