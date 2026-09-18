// js/pages/dashboard.js — extracted from dashboard.html inline script
(function () {
  var authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (!authUser) { window.location.href = 'login.html'; return; }

  var sidebarNav = document.getElementById('sidebarNav');
  var mainFrame = document.getElementById('mainFrame');
  var pageLoader = document.getElementById('pageLoader');
  var pageTitle = document.getElementById('pageTitle');
  var notifCount = 0;

  var role = authUser.role || 'user';
  var currentPage = role === 'superadmin' ? 'superadmin.html' : 'admin.html';

  if (role === 'superadmin') {
    document.body.classList.add('role-superadmin');
  }

  var menuSections = [];

  if (role === 'superadmin') {
    menuSections.push({
      title: 'Administração',
      items: [
        { icon: 'fa-users-cog', label: 'Gerenciamento', page: 'superadmin.html' },
      ]
    });
  } else {
    menuSections.push({
      title: 'Principal',
      items: [
        { icon: 'fa-box', label: 'Pedidos', page: 'admin.html' },
        { icon: 'fa-cash-register', label: 'Lançar Pedido', page: 'balcao.html' },
      ]
    });

    if (role === 'admin') {
      menuSections.push(
        {
          title: 'Financeiro',
          items: [
            { icon: 'fa-chart-bar', label: 'Relatórios', page: 'relatorios.html' },
            { icon: 'fa-wallet', label: 'Controle de Caixa', page: 'caixa.html' },
            { icon: 'fa-landmark', label: 'Central Financeira', page: 'financeiro.html' },
          ]
        },
        {
          title: 'Entregas',
          items: [
            { icon: 'fa-truck', label: 'Cadastro de Entregadores', page: 'entregador.html' },
            { icon: 'fa-chart-line', label: 'Relatório de Entregadores', page: 'relatorios-entregadores.html' },
          ]
        },
        {
          title: 'Painel',
          items: [
            { icon: 'fa-store', label: 'Painel Loja', page: 'painelLoja.html' },
          ]
        }
      );

      if (authUser.empresaTipo !== 'filial') {
        menuSections.push({
          title: 'Filiais',
          items: [
            { icon: 'fa-sitemap', label: 'Gerenciar Filiais', page: 'filiais.html' },
            { icon: 'fa-chart-pie', label: 'Balanço Consolidado', page: 'financeiro.html?consolidated=1' },
          ]
        });
      }
    }

    menuSections.push({
      title: 'Integrações',
      items: [
        { icon: 'fab fa-whatsapp', label: 'WhatsApp', page: 'whatsapp.html' },
        { icon: 'fa-plug', label: 'Integrações Financeiras', page: 'integracoes.html' },
      ]
    });

    menuSections.push({
      title: 'Conta',
      items: [
        { icon: 'fa-key', label: 'Alterar Senha', page: 'alterar-senha.html' },
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
        if (item.page === 'admin.html') {
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
    if (page === currentPage) return;
    currentPage = page;

    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.remove('active'); });
    if (element) element.classList.add('active');

    pageTitle.textContent = element ? (element.querySelector('span') ? element.querySelector('span').textContent : 'Dashboard') : 'Dashboard';

    pageLoader.classList.remove('hidden');
    mainFrame.style.opacity = '0';

    setTimeout(function () {
      mainFrame.src = page;
      mainFrame.onload = function () {
        mainFrame.style.opacity = '1';
        pageLoader.classList.add('hidden');
      };
    }, 200);

    closeSidebar();
  }

  mainFrame.onload = function () {
    mainFrame.style.opacity = '1';
    pageLoader.classList.add('hidden');
  };

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
      localStorage.clear();
      window.location.href = 'login.html';
    });

    overlay.querySelector('[data-action="cancelLogout"]').addEventListener('click', function () {
      overlay.remove();
    });

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  };

  // Listen for messages from iframes
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (event.data.tipo === 'atualizarBadge') {
      var badge = document.getElementById('pedidoBadge');
      badge.textContent = event.data.total;
      badge.style.display = event.data.total > 0 ? 'inline-block' : 'none';

      if (event.data.novoPedido) {
        showNotification('pedido', 'Novo pedido recebido!', function () {
          var navItem = document.querySelector('.nav-item[data-page="admin.html"]');
          navigate('admin.html', navItem);
        });
      }
    }
    if (event.data.tipo === 'estoqueBaixo') {
      showNotification('estoque', 'Estoque baixo: ' + event.data.produto, function () {
        var navItem = document.querySelector('.nav-item[data-page="painelLoja.html"]');
        navigate('painelLoja.html', navItem);
      });
    }
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
      var res = await fetch((getApiBase() || '') + '/api/loja/settings-admin', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
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
  mainFrame.src = currentPage;

  if (typeof startIdleTimer === 'function') startIdleTimer();
})();
