// js/pages/login.js — extracted from login.html inline script
(function () {
  // Handle ?entregador=1 parameter
  var params = new URLSearchParams(window.location.search);
  if (params.get('entregador') === '1') {
    document.getElementById('chkEntregador').checked = true;
  }

  // ========== LOGIN ==========
  document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var user = document.getElementById('loginUser').value.trim();
    var pass = document.getElementById('loginPass').value.trim();
    var isEntregador = document.getElementById('chkEntregador').checked;
    var error = document.getElementById('loginError');
    var btn = document.getElementById('btnLogin');

    error.classList.remove('show');

    if (!user || !pass) { error.textContent = 'Preencha todos os campos.'; error.classList.add('show'); return; }

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      var endpoint = (getApiBase() || '') + (isEntregador ? '/api/entregador/auth/login' : '/api/auth/login');
      var body = { username: user, password: pass };

      var res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        var data = await res.json();
        if (isEntregador) {
          localStorage.setItem('entregador_token', data.token);
          localStorage.setItem('entregador_refresh', data.refreshToken);
          localStorage.setItem('entregador_user', JSON.stringify(data.user));
          localStorage.setItem('entregador_expiry', String(Date.now() + 30 * 60 * 1000));
          if (data.mustChangePassword) {
            window.location.href = 'entregador/entregador-app.html#/senha';
          } else {
            window.location.href = 'entregador/entregador-app.html';
          }
        } else {
          localStorage.setItem('authUser', JSON.stringify(Object.assign({}, data.user, {
            token: data.token,
            refreshToken: data.refreshToken,
            _expiry: Date.now() + 30 * 60 * 1000,
          })));
          window.location.href = 'dashboard.html';
        }
        return;
      }

      var errData = await res.json().catch(function () { return {}; });
      error.textContent = errData.error || 'Erro no login. Verifique usuário e senha.';
      error.classList.add('show');
    } catch (err) {
      console.error(err);
      error.textContent = 'Erro de conexão. Tente novamente.';
      error.classList.add('show');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  // ========== AUTO CHECK FOR SESSION ==========
  var authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (authUser) {
    var target = 'dashboard.html';
    if (window.location.pathname.includes('login.html') || window.location.pathname === '/login') {
      window.location.href = target;
    }
  }

  var entregadorToken = localStorage.getItem('entregador_token');
  var entregadorExpiry = localStorage.getItem('entregador_expiry');
  if (entregadorToken && entregadorExpiry && Date.now() < Number(entregadorExpiry)) {
    if (window.location.pathname.includes('login.html') || window.location.pathname === '/login') {
      window.location.href = 'entregador/entregador-app.html';
    }
  }
})();
