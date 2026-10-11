// js/pages/alterar-senha.js — módulo SPA (receita Task3/Task5)
const HTML_ALTERAR_SENHA = `<body>

<div class="card">
  <h1><i class="fas fa-key"></i> Alterar Senha</h1>
  <p class="sub">Digite sua senha atual e a nova senha desejada</p>

  <form id="changePassForm">
    <div class="form-group">
      <label for="currentUser">Usuário</label>
      <input type="text" id="currentUser" readonly style="background:#f8fafc;color:#94a3b8;">
    </div>
    <div class="form-group">
      <label for="currentPass">Senha Atual</label>
      <input type="password" id="currentPass" placeholder="Sua senha atual" required>
    </div>
    <div class="form-group">
      <label for="newPass">Nova Senha</label>
      <input type="password" id="newPass" placeholder="Mínimo 6 caracteres" required>
    </div>
    <div class="form-group">
      <label for="newPass2">Confirmar Nova Senha</label>
      <input type="password" id="newPass2" placeholder="Repita a nova senha" required>
    </div>
    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button>
    <div class="msg" id="msgBox"></div>
  </form>
</div>

</body>
`;
let _abort = null;
const _cleanups = [];

export async function mount(container, params) {
  unmount();
  _abort = new AbortController();
  await loadScriptOnce('js/password-toggle.js');
  _cleanups.push(pageCss('css/alterar-senha-page.css', 'alterar-senha'));
  container.innerHTML = HTML_ALTERAR_SENHA;
  try { if (window.initPasswordToggles) window.initPasswordToggles(); } catch (e) {}
  (function () {
  var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');

  if (!authUser.username || authUser.role === 'superadmin') {
    // DOCUMENTED BEHAVIOR: superadmin uses a separate credential path (kept from original extract).
    goTo('login');
    return;
  }

  document.getElementById('currentUser').value = authUser.username;

  document.getElementById('changePassForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = document.getElementById('msgBox');
    msg.className = 'msg';
    msg.textContent = '';

    // NEVER trim passwords — spaces are significant
    var currentPass = document.getElementById('currentPass').value;
    var newPass = document.getElementById('newPass').value;
    var newPass2 = document.getElementById('newPass2').value;

    if (!currentPass || !newPass || !newPass2) { showMsg('Preencha todos os campos', 'error'); return; }
    if (newPass.length < 6) { showMsg('Nova senha deve ter 6+ caracteres', 'error'); return; }
    if (newPass !== newPass2) { showMsg('Nova senha e confirmação não conferem', 'error'); return; }

    try {
      authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
    } catch (err) {
      authUser = {};
    }
    var token = (authUser && authUser.token) || (typeof safeGetToken === 'function' ? safeGetToken() : '');
    if (!token) { showMsg('Sessão inválida. Faça login novamente.', 'error'); return; }

    try {
      if (typeof showLoading === 'function') showLoading();
      var res = await authFetch((window.getApiBase ? window.getApiBase() : '') + '/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual: currentPass, novaSenha: newPass })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) { showMsg(data.error || 'Erro ao alterar senha', 'error'); return; }
      showMsg('Senha alterada com sucesso!', 'success');
      document.getElementById('currentPass').value = '';
      document.getElementById('newPass').value = '';
      document.getElementById('newPass2').value = '';
    } catch (err) {
      console.error(err);
      showMsg('Erro ao alterar senha', 'error');
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  });

  function showMsg(text, type) {
    var msgEl = document.getElementById('msgBox');
    msgEl.textContent = text;
    msgEl.className = 'msg show msg-' + type;
  }
  })();
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
