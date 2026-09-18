// js/pages/alterar-senha.js — extracted from alterar-senha.html inline script
(function () {
  var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');

  if (!authUser.username || authUser.role === 'superadmin') {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('currentUser').value = authUser.username;

  document.getElementById('changePassForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = document.getElementById('msgBox');
    msg.className = 'msg';
    msg.textContent = '';

    var currentPass = document.getElementById('currentPass').value.trim();
    var newPass = document.getElementById('newPass').value.trim();
    var newPass2 = document.getElementById('newPass2').value.trim();

    if (!currentPass || !newPass) { showMsg('Preencha todos os campos', 'error'); return; }
    if (newPass.length < 6) { showMsg('Nova senha deve ter 6+ caracteres', 'error'); return; }
    if (newPass !== newPass2) { showMsg('Nova senha e confirmação não conferem', 'error'); return; }

    try {
      var snap = await db.collection('usuarios').where('username', '==', authUser.username).get();
      if (snap.empty) { showMsg('Usuário não encontrado', 'error'); return; }

      var doc = snap.docs[0];
      var data = doc.data();
      var match = await bcrypt.compare(currentPass, data.passwordHash);
      if (!match) { showMsg('Senha atual incorreta', 'error'); return; }

      var hash = await bcrypt.hash(newPass, 10);
      await db.collection('usuarios').doc(doc.id).update({ passwordHash: hash });

      showMsg('Senha alterada com sucesso!', 'success');
      document.getElementById('currentPass').value = '';
      document.getElementById('newPass').value = '';
      document.getElementById('newPass2').value = '';
    } catch (err) {
      console.error(err);
      showMsg('Erro ao alterar senha', 'error');
    }
  });

  function showMsg(text, type) {
    var msgEl = document.getElementById('msgBox');
    msgEl.textContent = text;
    msgEl.className = 'msg show msg-' + type;
  }
})();
