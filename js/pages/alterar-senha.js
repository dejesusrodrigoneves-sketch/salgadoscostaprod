// js/pages/alterar-senha.js — Express PUT /api/auth/change-password
(function () {
  var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');

  if (!authUser.username || authUser.role === 'superadmin') {
    // DOCUMENTED BEHAVIOR: superadmin uses a separate credential path (kept from original extract).
    window.location.href = 'login.html';
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
      var res = await fetch((window.getApiBase ? window.getApiBase() : '') + '/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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
