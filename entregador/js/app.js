/**
 * Main app controller — router, init, nav
 */
(function() {
  'use strict';

  // Check auth
  if (!EntregadorAuth.isAuthenticated()) {
    window.location.href = 'entregador-login.html';
    return;
  }

  // Init theme
  const savedTheme = localStorage.getItem('entregador_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Session check
  EntregadorAuth.checkSession();

  // Offline detection
  window.addEventListener('online', () => document.body.classList.remove('offline'));
  window.addEventListener('offline', () => document.body.classList.add('offline'));
  if (!navigator.onLine) document.body.classList.add('offline');

  // Refresh session every 5 min
  setInterval(() => EntregadorAuth.checkSession(), 5 * 60 * 1000);

  // Update header
  const user = EntregadorAuth.getUser();
  if (user) {
    document.getElementById('headerTitle').textContent = `Olá, ${user.nome?.split(' ')[0] || 'Entregador'} 👋`;
  }

  // Nav
  const navTabs = document.querySelectorAll('.nav-tab');
  const views = {
    pedidos: document.getElementById('pedidosView'),
    historico: document.getElementById('historicoView'),
    perfil: document.getElementById('perfilView'),
    senha: document.getElementById('senhaView'),
  };

  function showScreen(name) {
    // Hide all views
    Object.values(views).forEach(v => v?.classList.add('hidden'));
    document.getElementById('loadingView').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('visible');

    // Update nav
    navTabs.forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`[data-screen="${name}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Update header
    const headers = {
      pedidos: { title: `Olá, ${user?.nome?.split(' ')[0] || 'Entregador'} 👋`, sub: '' },
      historico: { title: 'Histórico', sub: 'Suas entregas' },
      perfil: { title: 'Meu Perfil', sub: 'Gerencie seus dados' },
      senha: { title: 'Alterar Senha', sub: 'Primeiro acesso' },
    };
    const h = headers[name] || headers.pedidos;
    document.getElementById('headerTitle').textContent = h.title;
    document.getElementById('headerSub').textContent = h.sub;

    // Show/hide bottom nav
    document.getElementById('bottomNav').style.display = name === 'senha' ? 'none' : 'flex';

    // Load view
    switch (name) {
      case 'pedidos': EntregadorOrders.load(); break;
      case 'historico': EntregadorHistory.load(); break;
      case 'perfil': EntregadorProfile.load(); break;
      case 'senha': loadChangePassword(); break;
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => showScreen(tab.dataset.screen));
  });

  // Change password screen
  function loadChangePassword() {
    const view = views.senha;
    view.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="width:56px;height:56px;background:var(--bg-secondary);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;color:var(--accent);">
          <i class="bi bi-shield-lock"></i>
        </div>
      </div>
      <div class="input-group">
        <label for="currentPass">Senha atual</label>
        <input type="password" id="currentPass" placeholder="Sua senha provisória">
      </div>
      <div class="input-group">
        <label for="newPass">Nova senha</label>
        <input type="password" id="newPass" placeholder="Mínimo 6 caracteres">
      </div>
      <div class="input-group">
        <label for="confirmPass">Confirmar nova senha</label>
        <input type="password" id="confirmPass" placeholder="Repita a senha">
      </div>
      <button class="btn-primary" id="changePassBtn">
        <i class="bi bi-check-lg"></i> Salvar Senha
      </button>
    `;
    view.classList.remove('hidden');

    document.getElementById('changePassBtn').addEventListener('click', async () => {
      const current = document.getElementById('currentPass').value;
      const newPass = document.getElementById('newPass').value;
      const confirm = document.getElementById('confirmPass').value;

      if (!current || !newPass || !confirm) {
        alert('Preencha todos os campos');
        return;
      }
      if (newPass !== confirm) {
        alert('As senhas não coincidem');
        return;
      }
      if (newPass.length < 6) {
        alert('Mínimo 6 caracteres');
        return;
      }

      try {
        await EntregadorAPI.changePassword(current, newPass);
        alert('Senha alterada com sucesso!');
        showScreen('pedidos');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Hash-based routing
  const hash = window.location.hash.replace('#/', '');
  if (hash === 'senha') {
    showScreen('senha');
  } else if (hash === 'historico') {
    showScreen('historico');
  } else if (hash === 'perfil') {
    showScreen('perfil');
  } else {
    showScreen('pedidos');
  }

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#/', '') || 'pedidos';
    showScreen(h);
  });

})();
