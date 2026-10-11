// js/pages/dashboard.mjs — dashboard shell (ES module)
function initShell() {
  var authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (!authUser) { window.location.href = 'login.html'; return; }

  var sidebarNav = document.getElementById('sidebarNav');
  var pageLoader = document.getElementById('pageLoader');
  var pageTitle = document.getElementById('pageTitle');
  var notifCount = 0;

  var role = authUser.role || 'user';
  var currentPage = role === 'superadmin' ? 'superadmin' : 'admin';

  if (role === 'superadmin') {
    document.body.classList.add('role-superadmin');
  }

  var menuSections = [];

  if (role === 'superadmin') {
    menuSections.push({
      title: 'Administração',
      items: [
        { icon: 'fa-users-cog', label: 'Gerenciamento', page: 'superadmin' },
      ]
    });
  } else {
    menuSections.push({
      title: 'Principal',
      items: [
        { icon: 'fa-box', label: 'Pedidos', page: 'admin' },
        { icon: 'fa-cash-register', label: 'Lançar Pedido', page: 'balcao' },
      ]
    });

    if (role === 'admin') {
      menuSections.push(
        {
          title: 'Financeiro',
          items: [
            { icon: 'fa-chart-bar', label: 'Relatórios', page: 'relatorios' },
            { icon: 'fa-wallet', label: 'Controle de Caixa', page: 'caixa' },
            { icon: 'fa-landmark', label: 'Central Financeira', page: 'financeiro' },
            { icon: 'fa-receipt', label: 'Pagamentos', page: 'pagamentos' },
          ]
        },
        {
          title: 'Entregas',
          items: [
            { icon: 'fa-truck', label: 'Cadastro de Entregadores', page: 'entregador' },
            { icon: 'fa-chart-line', label: 'Relatório de Entregadores', page: 'relatorios-entregadores' },
          ]
        },
        {
          title: 'Painel',
          items: [
            { icon: 'fa-store', label: 'Painel Loja', page: 'painelLoja' },
          ]
        }
      );

      if (authUser.empresaTipo !== 'filial') {
        menuSections.push({
          title: 'Filiais',
          items: [
            { icon: 'fa-sitemap', label: 'Gerenciar Filiais', page: 'filiais' },
          ]
        });
      }
    }

    menuSections.push({
      title: 'Integrações',
      items: [
        { icon: 'fab fa-whatsapp', label: 'WhatsApp', page: 'whatsapp' },
        { icon: 'fa-plug', label: 'Integrações Financeiras', page: 'integracoes' },
      ]
    });

    menuSections.push({
      title: 'Conta',
      items: [
        { icon: 'fa-key', label: 'Alterar Senha', page: 'alterar-senha' },
      ]
    });
  }

  function renderMenu() {
    sidebarNav.innerHTML = '';
    var collapsedSections = JSON.parse(localStorage.getItem('sidebarCollapsedSections') || '[]');

    menuSections.forEach(function (section, idx) {
      var sectionDiv = document.createElement('div');
      sectionDiv.className = 'nav-section';
      sectionDiv.dataset.section = idx;

      var hasActive = section.items.some(function (item) { return item.page === currentPage; });
      var isCollapsed = !hasActive && collapsedSections.includes(idx);

      if (isCollapsed) sectionDiv.classList.add('collapsed');

      sectionDiv.innerHTML = '<div class="nav-section-title">' + section.title + '<i class="fas fa-chevron-down chevron"></i></div>';
      section.items.forEach(function (item) {
        var isActive = item.page === currentPage;
        var div = document.createElement('div');
        div.className = 'nav-item' + (isActive ? ' active' : '');
        div.dataset.page = item.page;
        div.innerHTML = '<i class="fas ' + item.icon + '"></i><span>' + item.label + '</span>';
        if (item.page === 'admin') {
          div.innerHTML += '<span class="badge" id="pedidoBadge" style="display:none">0</span>';
        }
        div.addEventListener('click', function () { navigate(item.page, div); });
        sectionDiv.appendChild(div);
      });

      sectionDiv.querySelector('.nav-section-title').addEventListener('click', function () {
        sectionDiv.classList.toggle('collapsed');
        saveSectionState();
      });

      sidebarNav.appendChild(sectionDiv);
    });

  }

  function saveSectionState() {
    var collapsed = [];
    document.querySelectorAll('.nav-section.collapsed').forEach(function (el) {
      collapsed.push(parseInt(el.dataset.section));
    });
    localStorage.setItem('sidebarCollapsedSections', JSON.stringify(collapsed));
  }

  window.toggleSidebarCollapse = function () {
    var sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  };

  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    document.getElementById('sidebar').classList.add('collapsed');
  }

  function navigate(page, element) {
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.remove('active'); });
    if (element) element.classList.add('active');
    var label = element && element.querySelector('span') ? element.querySelector('span').textContent : 'Dashboard';
    pageTitle.textContent = label;
    closeSidebar();
    if (window.router) router.navigate(page);
    else window.location.hash = '#/' + page;
  }

  window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
  };

  window.closeSidebar = function () {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  };

  // Show user info
  var userName = authUser.username || 'Admin';
  var roleLabels = { superadmin: 'Super Admin', admin: 'Admin', user: 'Usuário' };
  var roleBadge = roleLabels[role] || 'Usuário';
  document.getElementById('userInfo').innerHTML = '<i class="fas fa-user-circle"></i> ' + userName + ' <span style="font-size:10px;color:#94a3b8;font-weight:400;">(' + roleBadge + ')</span>';

  window.logout = function () {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal-box">' +
      '<h3>Sair</h3>' +
      '<p>Deseja realmente sair do painel?</p>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-modal-cancel" data-action="cancelLogout">Cancelar</button>' +
      '<button class="btn btn-modal-confirm" data-action="confirmLogout">Sair</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('[data-action="confirmLogout"]').addEventListener('click', async function () {
      var au = JSON.parse(localStorage.getItem('authUser') || '{}');
      try {
        await fetch((getApiBase() || '') + '/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (au.token || ''),
          },
          body: JSON.stringify({ refreshToken: au.refreshToken || '' }),
        });
      } catch (e) { /* Logout even if API call fails */ }
      if (typeof window.wipeBrowserStorage === 'function') window.wipeBrowserStorage();
      else localStorage.clear();
      window.location.href = 'login.html';
    });

    overlay.querySelector('[data-action="cancelLogout"]').addEventListener('click', function () {
      overlay.remove();
    });

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  };

  // Badge/notificações vindas dos módulos (mesmo documento — sem postMessage)
  document.addEventListener('pedidos:badge', function (event) {
    var total = event.detail ? event.detail.total : 0;
    var badge = document.getElementById('pedidoBadge');
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? 'inline-block' : 'none';
    }
    if (event.detail && event.detail.novoPedido) {
      showNotification('pedido', 'Novo pedido recebido!', function () { goTo('admin'); });
    }
  });
  document.addEventListener('estoque:baixo', function (event) {
    showNotification('estoque', 'Estoque baixo: ' + event.detail.produto, function () { goTo('painelLoja'); });
  });

  function showNotification(type, message, action) {
    var container = document.getElementById('notifContainer');
    var div = document.createElement('div');
    div.className = 'notif-item notif-' + type;
    div.textContent = message;
    if (action) {
      div.addEventListener('click', action);
    }
    container.appendChild(div);
    setTimeout(function () {
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.3s';
      setTimeout(function () { div.remove(); }, 300);
    }, 5000);
  }

  async function carregarNomeLoja() {
    var role2 = authUser.role || 'user';
    if (role2 === 'superadmin') {
      var titleEl = document.getElementById('dashboardTitle');
      if (titleEl) titleEl.textContent = 'Dashboard - Super administrador';
      var sideEl = document.getElementById('sidebarStoreName');
      if (sideEl) sideEl.innerHTML = 'Super administrador <small>Painel Administrativo</small>';
      return;
    }
    try {
      var token = authUser.token;
      if (!token) return;
      var res = await authFetch((getApiBase() || '') + '/api/loja/settings-admin');
      if (!res.ok) return;
      var config = await res.json();
      var nome = config.nome || 'Salgados Costa';
      var titleEl2 = document.getElementById('dashboardTitle');
      if (titleEl2) titleEl2.textContent = 'Dashboard - ' + nome;
      var sideEl2 = document.getElementById('sidebarStoreName');
      if (sideEl2) sideEl2.innerHTML = nome + ' <small>Painel Administrativo</small>';
    } catch (e) { /* Keep default name */ }
  }

  carregarNomeLoja();
  renderMenu();

  // Sincroniza nav ativa + título em navegações sem click (back/forward, landing)
  document.addEventListener('page:change', function (e) {
    var route = e.detail && e.detail.route;
    if (!route) return;
    var target = document.querySelector('.nav-item[data-page="' + route + '"]');
    if (!target) return;
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.remove('active'); });
    target.classList.add('active');
    var section = target.closest('.nav-section');
    if (section) section.classList.remove('collapsed');
    var span = target.querySelector('span');
    if (span) pageTitle.textContent = span.textContent;
  });

  if (window.sessionManager) sessionManager.scheduleProactive();

  if (typeof startIdleTimer === 'function') startIdleTimer();

  // Inicializa notifier global de pedidos (uma vez por sessão)
  import('../services/order-notifier.js').then(({ orderNotifier }) => {
    orderNotifier.init();

    // Atualiza badge do menu "Pedidos" com contador de pendentes
    orderNotifier.onCountChange(function(count) {
      var badge = document.getElementById('pedidoBadge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
      }
    });

    // Inicia polling contínuo (vive fora do ciclo de rotas)
    orderNotifier.startPolling();
  });

  import('../utils/audio.js').then(({ attachGestureUnlock }) => {
    attachGestureUnlock();
  });

  // ===== Aviso T-3min de fechamento de caixa (cobre admin+balcao+caixa+relatorios) =====
  (function iniciarAvisoFechamentoCaixa() {
    function hojeKey() { return new Date().toISOString().split('T')[0]; }
    function jaAvisadoHoje() { return localStorage.getItem('caixaFechamentoAviso_' + hojeKey()) === '1'; }

    function janelaFechamento(closingTime) {
      if (!closingTime) return null;
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(closingTime).trim());
      if (!m) return null;
      var agora = new Date();
      var fim = new Date(agora);
      fim.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
      var inicio = new Date(fim.getTime() - 3 * 60 * 1000);
      return { inicio: inicio, fim: fim };
    }

    function mostrarAviso() {
      if (document.getElementById('caixaFechamentoAviso')) return;
      localStorage.setItem('caixaFechamentoAviso_' + hojeKey(), '1');
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'caixaFechamentoAviso';
      var box = document.createElement('div');
      box.className = 'modal-box';
      var p = document.createElement('p');
      p.textContent = 'Sua loja esta prestes a fechar, gostaria de ja fechar o seu caixa ?';
      box.appendChild(p);
      var actions = document.createElement('div');
      actions.className = 'modal-actions';
      var btnSim = document.createElement('button');
      btnSim.className = 'btn btn-primary';
      btnSim.textContent = 'Sim';
      btnSim.onclick = function () { overlay.remove(); location.hash = '#/caixa'; };
      var btnNao = document.createElement('button');
      btnNao.className = 'btn btn-modal-cancel';
      btnNao.textContent = 'Não';
      btnNao.onclick = function () { overlay.remove(); };
      actions.appendChild(btnSim);
      actions.appendChild(btnNao);
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    async function checarFechamento() {
      if (jaAvisadoHoje()) return;
      try {
        var au = JSON.parse(localStorage.getItem('authUser') || 'null');
        if (!au || !au.token) return;
        var base = (typeof getApiBase === 'function' ? (getApiBase() || '') : '');
        var rCaixa = await authFetch(base + '/api/caixa/hoje');
        if (!rCaixa.ok) return;
        var caixa = await rCaixa.json();
        if (!caixa || caixa.status !== 'aberto') return;
        var rCfg = await authFetch(base + '/api/loja/settings-admin');
        if (!rCfg.ok) return;
        var cfg = await rCfg.json();
        var j = janelaFechamento(cfg.closingTime);
        if (!j) return;
        var agora = new Date();
        if (agora >= j.inicio && agora < j.fim) mostrarAviso();
      } catch (e) { /* silencioso */ }
    }

    checarFechamento();
    setInterval(checarFechamento, 60 * 1000);
  })();

  // ===== Validação periódica de sessão =====
  var _sessionCheckBusy = false;
  function validarSessao() {
    if (_sessionCheckBusy) return;
    var au = JSON.parse(localStorage.getItem('authUser') || 'null');
    if (!au || !au.token) return;
    _sessionCheckBusy = true;
    authFetch((getApiBase() || '') + '/api/admin')
      .then(function () { /* 200/403 — sessão ok */ })
      .catch(function () { /* rede fora ou logout já tratado */ })
      .then(function () { _sessionCheckBusy = false; });
  }

  // Revalida quando aba ganha foco
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) validarSessao();
  });

  // Revalida a cada 5 min
  setInterval(validarSessao, 5 * 60 * 1000);
}

initShell();

window.toggleSidebarCollapseAction = function (ds) {
  if (typeof window.toggleSidebarCollapse === 'function') return window.toggleSidebarCollapse(ds);
  console.warn('[delegator] handler not ready:', 'toggleSidebarCollapseAction');
};
window.toggleSidebarAction = function (ds) {
  if (typeof window.toggleSidebar === 'function') return window.toggleSidebar(ds);
  console.warn('[delegator] handler not ready:', 'toggleSidebarAction');
};
window.closeSidebarAction = function (ds) {
  if (typeof window.closeSidebar === 'function') return window.closeSidebar(ds);
  console.warn('[delegator] handler not ready:', 'closeSidebarAction');
};
window.logoutAction = function (ds) {
  if (typeof window.logout === 'function') return window.logout(ds);
  console.warn('[delegator] handler not ready:', 'logoutAction');
};
