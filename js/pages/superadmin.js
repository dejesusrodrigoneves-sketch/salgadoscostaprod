// js/pages/superadmin.js — extracted from superadmin.html inline scripts
(function () {
  var host = window.location.hostname;
  var isLocal = host === 'localhost' || /^\d+(\.\d+){3}$/.test(host);
  var isSuperadminDomain = isLocal || host.split('.')[0] === 'admin';
  var isVercel = host.endsWith('.vercel.app') || host.endsWith('.now.sh');
  if (!isSuperadminDomain && !isVercel) {
    var labels = host.split('.');
    if (labels.length >= 3) {
      window.location.href = 'https://admin.' + labels.slice(1).join('.');
    }
  }
  if (!authGuard('superadmin')) throw new Error('Redirect');

  function api(path, opts) {
    var headers = { 'Content-Type': 'application/json' };
    var token = (JSON.parse(localStorage.getItem('authUser') || '{}')).token;
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch((window.getApiBase ? window.getApiBase() : '') + '/api' + path, { headers: headers, method: opts ? opts.method : undefined, body: opts ? opts.body : undefined }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Erro ' + r.status); });
      return r.json();
    });
  }
  window.api = api;

  // Sidebar Navigation
  var navSections = [
    { title: 'Visão Geral', items: [{ id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' }] },
    { title: 'Administração', items: [
      { id: 'usuarios', icon: 'fa-users', label: 'Usuários' },
      { id: 'senhas', icon: 'fa-key', label: 'Gerenciar Senhas' },
      { id: 'registros', icon: 'fa-scroll', label: 'Registros' },
    ]},
    { title: 'Organização', items: [
      { id: 'clientes', icon: 'fa-user-tie', label: 'Clientes' },
      { id: 'empresas', icon: 'fa-store', label: 'Empresas' },
      { id: 'filiais', icon: 'fa-sitemap', label: 'Empresas Filiais' },
    ]},
    { title: 'Financeiro', items: [
      { id: 'settlements', icon: 'fa-dollar-sign', label: 'Settlements' },
      { id: 'billing', icon: 'fa-credit-card', label: 'Billing' },
      { id: 'integracoes', icon: 'fa-plug', label: 'Integrações' },
    ]},
  ];

  function renderSaNav() {
    var nav = document.getElementById('saNav');
    if (!nav) return;
    nav.innerHTML = '';
    navSections.forEach(function (sec) {
      var wrap = document.createElement('div');
      wrap.className = 'sa-section open';
      wrap.innerHTML =
        '<button class="sa-section-head"><span class="lbl">' + sec.title + '</span><i class="fas fa-chevron-right chev"></i></button>' +
        '<div class="sa-items">' +
        sec.items.map(function (it) {
          return '<div class="sa-item" data-tab="' + it.id + '" title="' + it.label + '"><i class="fas ' + it.icon + '"></i><span class="lbl">' + it.label + '</span></div>';
        }).join('') +
        '</div>';
      nav.appendChild(wrap);
    });
    nav.querySelectorAll('.sa-section-head').forEach(function (btn) {
      btn.addEventListener('click', function () { btn.closest('.sa-section').classList.toggle('open'); });
    });
    nav.querySelectorAll('.sa-item').forEach(function (item) {
      item.addEventListener('click', function () {
        nav.querySelectorAll('.sa-item').forEach(function (i) { i.classList.remove('active'); });
        item.classList.add('active');
        switchTab(item.dataset.tab);
        if (window.innerWidth <= 820) closeSaDrawer();
      });
    });
    var first = nav.querySelector('.sa-item');
    if (first) first.classList.add('active');
  }

  // Sidebar Collapse
  var saSidebar = document.getElementById('saSidebar');
  var saCollapseBtn = document.getElementById('saCollapseBtn');
  var saExpandBtn = document.getElementById('saExpandBtn');
  var saOverlay = document.getElementById('saOverlay');

  if (saCollapseBtn) {
    saCollapseBtn.addEventListener('click', function () {
      saSidebar.classList.toggle('collapsed');
      var icon = saCollapseBtn.querySelector('i');
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-angles-right');
    });
  }
  if (saExpandBtn) {
    saExpandBtn.addEventListener('click', function () {
      saSidebar.classList.remove('collapsed');
      var icon = saCollapseBtn.querySelector('i');
      icon.classList.add('fa-bars');
      icon.classList.remove('fa-angles-right');
    });
  }

  function openSaDrawer() { if (saSidebar) saSidebar.classList.add('open'); if (saOverlay) saOverlay.classList.add('show'); }
  function closeSaDrawer() { if (saSidebar) saSidebar.classList.remove('open'); if (saOverlay) saOverlay.classList.remove('show'); }
  window.closeSaDrawer = closeSaDrawer;

  var saMobileToggle = document.querySelector('.sa-mobile-toggle');
  if (saMobileToggle) saMobileToggle.addEventListener('click', openSaDrawer);
  if (saOverlay) saOverlay.addEventListener('click', closeSaDrawer);

  renderSaNav();

  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var map = { dashboard: 'tabDashboard', usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', filiais: 'tabFiliais', registros: 'tabRegistros', clientes: 'tabClientes', settlements: 'tabSettlements', integracoes: 'tabIntegracoes', billing: 'tabBilling' };
    var el = document.getElementById(map[tab]);
    if (el) el.classList.add('active');
    if (tab === 'registros' && window.superadminAudit) superadminAudit.carregarAudit(1);
    if (tab === 'clientes') carregarClientes();
    if (tab === 'empresas') carregarEmpresas();
    if (tab === 'filiais') carregarFiliais();
    if (tab === 'billing' && window.loadBillingDashboard) loadBillingDashboard();
    if (tab === 'settlements') carregarSettlements();
    if (tab === 'integracoes' && window.SuperIntegracoes) SuperIntegracoes.carregar();
  }
  window.switchTab = switchTab;

  async function carregarUsuarios() {
    var tbody = document.getElementById('userTableBody');
    var select = document.getElementById('userSelect');
    select.innerHTML = '<option value="">Selecione um usuário</option>';
    try {
      var usuarios = await api('/usuarios');
      if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:#94a3b8;text-align:center;">Nenhum usuário cadastrado</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      var roleLabels = { superadmin: 'Super Admin', admin: 'Admin', user: 'Usuário' };
      usuarios.forEach(function (u) {
        var roleClass = u.role === 'superadmin' ? ' style="color:#f97316;font-weight:700;"' : '';
        var usernameEsc = escapeHtml(u.username);
        tbody.innerHTML += '<tr><td><strong>' + usernameEsc + '</strong></td><td' + roleClass + '>' + (roleLabels[u.role] || escapeHtml(u.role)) + '</td><td>' + escapeHtml(u.lojaNome || '-') + '</td><td>' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-') + '</td><td><button class="btn btn-danger btn-sm" aria-label="Excluir usuário" data-action="excluirUsuarioAction" data-id="' + u.id + '"><i class="fas fa-trash"></i></button></td></tr>';
        select.innerHTML += '<option value="' + u.id + '">' + usernameEsc + '</option>';
      });
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#94a3b8;text-align:center;">Erro ao carregar usuários</td></tr>';
    }
  }

  window.cadastrarUsuario = async function () {
    var username = document.getElementById('newUsername').value.trim();
    var password = document.getElementById('newPassword').value.trim();
    var role = document.getElementById('newRole').value;
    var empresaId = document.getElementById('newEmpresa').value;
    if (!username || !password) { toast('Preencha todos os campos', 'danger'); return; }
    if (password.length < 6) { toast('Senha deve ter 6+ caracteres', 'danger'); return; }
    if (role !== 'superadmin' && !empresaId) { toast('Selecione a empresa da conta', 'danger'); return; }
    if (role === 'superadmin' && !(await confirmModal('ATENÇÃO: você está criando um Super Admin com acesso total ao sistema. Confirma?'))) return;
    try {
      await api('/usuarios', { method: 'POST', body: JSON.stringify({ username: username, password: password, lojaNome: username, role: role, empresaId: empresaId ? Number(empresaId) : null }) });
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newRole').value = 'user';
      toast('Usuário ' + username + ' cadastrado!');
      carregarUsuarios();
    } catch (e) {
      toast(e.message || 'Erro ao cadastrar', 'danger');
    }
  };

  window.excluirUsuario = async function (id) {
    var username = 'este usuário';
    try {
      var usuarios = await api('/usuarios');
      var u = usuarios.find(function (x) { return x.id === id; });
      if (u && u.username) username = u.username;
    } catch (e) { /* segue com genérico */ }
    if (!(await confirmModal('Excluir usuário ' + username + '?'))) return;
    try {
      await api('/usuarios/' + id, { method: 'DELETE' });
      toast('Usuário ' + username + ' removido', 'danger');
      carregarUsuarios();
    } catch (e) {
      toast('Erro ao remover', 'danger');
    }
  };

  window.alterarSenha = async function () {
    var select = document.getElementById('userSelect');
    var pass = document.getElementById('newPassInput').value.trim();
    var pass2 = document.getElementById('newPassConfirm').value.trim();
    if (!select.value) { toast('Selecione um usuário', 'danger'); return; }
    if (!pass || pass.length < 6) { toast('Senha deve ter 6+ caracteres', 'danger'); return; }
    if (pass !== pass2) { toast('Senhas não conferem', 'danger'); return; }
    try {
      await api('/usuarios/' + select.value + '/password', { method: 'PUT', body: JSON.stringify({ password: pass }) });
      document.getElementById('newPassInput').value = '';
      document.getElementById('newPassConfirm').value = '';
      toast('Senha alterada com sucesso!');
    } catch (e) {
      toast(e.message || 'Erro ao alterar senha', 'danger');
    }
  };

  var clienteEditandoId = null;
  var clienteSenhaId = null;

  async function carregarClientes() {
    var tbody = document.getElementById('clientesTableBody');
    try {
      var clientes = await api('/admin/clientes');
      if (!clientes || clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:#94a3b8;text-align:center;">Nenhum cliente cadastrado</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      clientes.forEach(function (c) {
        tbody.innerHTML += '<tr>'
          + '<td><strong>' + escapeHtml(c.nome || '-') + '</strong></td>'
          + '<td>' + escapeHtml(c.telefone || '-') + '</td>'
          + '<td>' + escapeHtml(c.bairro || '-') + '</td>'
          + '<td>' + (c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '-') + '</td>'
          + '<td style="white-space:nowrap;">'
          + '<button class="btn btn-primary btn-sm" aria-label="Editar cliente" data-action="abrirModalEditarAction" data-id="' + c.id + '"><i class="fas fa-pen"></i></button> '
          + '<button class="btn btn-secondary btn-sm" aria-label="Trocar senha" data-action="abrirModalSenhaAction" data-id="' + c.id + '"><i class="fas fa-key"></i></button> '
          + '<button class="btn btn-danger btn-sm" aria-label="Excluir cliente" data-action="excluirClienteAction" data-id="' + c.id + '"><i class="fas fa-trash"></i></button>'
          + '</td></tr>';
      });
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#dc2626;text-align:center;">Erro ao carregar clientes: ' + e.message + '</td></tr>';
    }
  }

  window.abrirModalEditarAction = function (ds) { window.abrirModalEditar(Number(ds.id)); };
  window.abrirModalModalEditar = function (id) { window.abrirModalEditar(id); };

  window.abrirModalEditar = function (id) {
    clienteEditandoId = id;
    api('/admin/clientes').then(function (list) {
      var c = list.find(function (x) { return x.id === id; });
      if (!c) return;
      document.getElementById('editNome').value = c.nome || '';
      document.getElementById('editTelefone').value = c.telefone || '';
      document.getElementById('editEndereco').value = c.endereco || '';
      document.getElementById('editNumero').value = c.numero || '';
      document.getElementById('editBairro').value = c.bairro || '';
      document.getElementById('editCep').value = c.cep || '';
      document.getElementById('editPontoReferencia').value = c.pontoReferencia || '';
      document.getElementById('modalEditarCliente').style.display = 'flex';
    }).catch(function (e) { toast(e.message || 'Erro ao carregar cliente', 'danger'); });
  };

  window.salvarEdicaoCliente = async function () {
    var body = {
      nome: document.getElementById('editNome').value.trim(),
      telefone: document.getElementById('editTelefone').value.trim(),
      endereco: document.getElementById('editEndereco').value.trim(),
      numero: document.getElementById('editNumero').value.trim(),
      bairro: document.getElementById('editBairro').value.trim(),
      cep: document.getElementById('editCep').value.trim(),
      pontoReferencia: document.getElementById('editPontoReferencia').value.trim(),
    };
    if (!body.nome) { toast('Nome é obrigatório', 'danger'); return; }
    try {
      await api('/admin/clientes/' + clienteEditandoId, { method: 'PUT', body: JSON.stringify(body) });
      fecharModal('modalEditarCliente');
      toast('Cliente atualizado!');
      carregarClientes();
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'danger');
    }
  };

  window.abrirModalSenhaAction = function (ds) { window.abrirModalSenha(Number(ds.id)); };

  window.abrirModalSenha = function (id) {
    clienteSenhaId = id;
    document.getElementById('novaSenhaCliente').value = '';
    document.getElementById('confirmarSenhaCliente').value = '';
    document.getElementById('modalSenhaCliente').style.display = 'flex';
  };

  window.salvarSenhaCliente = async function () {
    var senha = document.getElementById('novaSenhaCliente').value.trim();
    var senha2 = document.getElementById('confirmarSenhaCliente').value.trim();
    if (!senha || senha.length < 6) { toast('Senha deve ter 6+ caracteres', 'danger'); return; }
    if (senha !== senha2) { toast('Senhas não conferem', 'danger'); return; }
    try {
      await api('/admin/clientes/' + clienteSenhaId + '/password', { method: 'PUT', body: JSON.stringify({ password: senha }) });
      fecharModal('modalSenhaCliente');
      toast('Senha alterada com sucesso!');
    } catch (e) {
      toast(e.message || 'Erro ao alterar senha', 'danger');
    }
  };

  window.excluirClienteAction = function (ds) { window.excluirCliente(Number(ds.id)); };

  window.excluirCliente = async function (id) {
    var ok = await confirmModal('Excluir a conta deste cliente? Dados pessoais serão removidos (pedidos retidos por obrigação fiscal).');
    if (!ok) return;
    try {
      await api('/admin/clientes/' + id, { method: 'DELETE' });
      toast('Conta de cliente excluída', 'danger');
      carregarClientes();
    } catch (e) {
      toast(e.message || 'Erro ao excluir', 'danger');
    }
  };

  function fecharModal(id) { document.getElementById(id).style.display = 'none'; }
  window.fecharModal = fecharModal;

  async function carregarEmpresas() {
    var tbody = document.getElementById('empresasTableBody');
    try {
      var empresas = await api('/admin');
      if (!empresas || empresas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="color:#94a3b8;text-align:center;">Nenhuma empresa cadastrada</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      var newEmpresa = document.getElementById('newEmpresa');
      newEmpresa.innerHTML = '<option value="">— selecionar empresa —</option>';
      empresas.forEach(function (e) {
        var created = e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '-';
        var count = e._count || {};
        var nomeEsc = escapeHtml(e.nome || '-');
        newEmpresa.innerHTML += '<option value="' + e.id + '">' + escapeHtml(e.nome) + ' (' + escapeHtml(e.slug) + ')</option>';
        tbody.innerHTML += '<tr>'
          + '<td><strong>' + nomeEsc + '</strong></td>'
          + '<td><code style="background:#334155;padding:2px 6px;border-radius:4px;font-size:0.8rem;">' + escapeHtml(e.slug || '-') + '</code></td>'
          + '<td>' + escapeHtml(e.telefone || '-') + '</td>'
          + '<td>' + escapeHtml(e.cidade || '-') + '</td>'
          + '<td>' + (e.asaasOnboarded ? '<i class="fas fa-circle" style="color:#10b981;" title="Onboarded"></i>' : '<i class="fas fa-circle" style="color:#6b7280;" title="Não onboarded"></i>') + '</td>'
          + '<td>' + (count.produtos || 0) + '</td>'
          + '<td>' + (count.pedidos || 0) + '</td>'
          + '<td>' + created + '</td>'
          + '<td style="white-space:nowrap;">'
          + '<button class="btn btn-primary btn-sm" aria-label="Editar empresa" data-action="abrirModalEditarEmpresaAction" data-id="' + e.id + '"><i class="fas fa-pen"></i></button> '
          + '<button class="btn btn-danger btn-sm" aria-label="Excluir empresa" data-action="excluirEmpresaAction" data-id="' + e.id + '"><i class="fas fa-trash"></i></button>'
          + '</td></tr>';
      });
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="9" style="color:#dc2626;text-align:center;">Erro ao carregar empresas: ' + e.message + '</td></tr>';
    }
  }

  window.cadastrarEmpresa = async function () {
    var nome = document.getElementById('empNome').value.trim();
    var slug = document.getElementById('empSlug').value.trim();
    var telefone = document.getElementById('empTelefone').value.trim();
    var cidade = document.getElementById('empCidade').value.trim();
    if (!nome || !slug) { toast('Nome e slug são obrigatórios', 'danger'); return; }
    try {
      await api('/admin', { method: 'POST', body: JSON.stringify({ nome: nome, slug: slug, telefone: telefone, cidade: cidade }) });
      document.getElementById('empNome').value = '';
      document.getElementById('empSlug').value = '';
      document.getElementById('empTelefone').value = '';
      document.getElementById('empCidade').value = '';
      toast('Empresa ' + nome + ' cadastrada!');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao cadastrar', 'danger');
    }
  };

  window.abrirModalEditarEmpresaAction = function (ds) { window.abrirModalEditarEmpresa(Number(ds.id)); };

  window.abrirModalEditarEmpresa = async function (id) {
    try {
      var empresas = await api('/admin');
      var emp = empresas.find(function (e) { return e.id === id; });
      if (!emp) return;
      document.getElementById('editEmpId').value = emp.id;
      document.getElementById('editEmpNome').value = emp.nome || '';
      document.getElementById('editEmpSlug').value = emp.slug || '';
      document.getElementById('editEmpTelefone').value = emp.telefone || '';
      document.getElementById('editEmpEndereco').value = emp.endereco || '';
      document.getElementById('editEmpNumero').value = emp.numero || '';
      document.getElementById('editEmpBairro').value = emp.bairro || '';
      document.getElementById('editEmpCep').value = emp.cep || '';
      document.getElementById('editEmpCidade').value = emp.cidade || '';
      document.getElementById('editEmpEstado').value = emp.estado || '';
      document.getElementById('editEmpDescricao').value = emp.descricao || '';

      var ps = document.getElementById('paymentSection');
      if (emp.asaasOnboarded) {
        ps.style.display = 'block';
        document.getElementById('paymentStatusIcon').innerHTML = '<i class="fas fa-circle" style="color:#10b981;"></i> Ativo';
        document.getElementById('paymentWalletId').textContent = emp.asaasWalletId || '—';
        document.getElementById('paymentSubcontaId').textContent = emp.asaasSubcontaId || '—';
        document.getElementById('paymentOnboardedAt').textContent = emp.asaasCreatedAt ? new Date(emp.asaasCreatedAt).toLocaleDateString('pt-BR') : '—';
      } else {
        ps.style.display = 'block';
        document.getElementById('paymentStatusIcon').innerHTML = '<i class="fas fa-circle" style="color:#6b7280;"></i> Inativo';
        document.getElementById('paymentWalletId').textContent = '—';
        document.getElementById('paymentSubcontaId').textContent = '—';
        document.getElementById('paymentOnboardedAt').textContent = '—';
      }

      var settleDiv = document.getElementById('paymentSettlements');
      settleDiv.innerHTML = '<em style="color:#94a3b8;">Carregando settlements...</em>';
      try {
        var setData = await api('/empresa/settlement/global?empresaId=' + id);
        var emps = (setData.settlements || []).slice(0, 5);
        if (emps.length === 0) {
          settleDiv.innerHTML = '<em style="color:#94a3b8;">Nenhum settlement</em>';
        } else {
          var html = '<strong style="display:block;margin-bottom:4px;">Últimos settlements:</strong>';
          html += '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;">';
          html += '<tr style="color:#94a3b8;"><th style="text-align:left;padding:2px 4px;">Período</th><th style="text-align:left;padding:2px 4px;">Split</th><th style="text-align:left;padding:2px 4px;">Transfer</th></tr>';
          emps.forEach(function (s) {
            var period = new Date(s.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(s.weekEnd).toLocaleDateString('pt-BR');
            var splitColor = s.splitStatus === 'auto' ? '#10b981' : s.splitStatus === 'manual' ? '#f59e0b' : '#6b7280';
            var transferColor = s.transferStatus === 'scheduled' ? '#10b981' : s.transferStatus === 'completed' ? '#10b981' : '#6b7280';
            html += '<tr style="border-top:1px solid #334155;">';
            html += '<td style="padding:2px 4px;">' + period + '</td>';
            html += '<td style="padding:2px 4px;color:' + splitColor + ';">' + (s.splitStatus || '—') + '</td>';
            html += '<td style="padding:2px 4px;color:' + transferColor + ';">' + (s.transferStatus || '—') + '</td>';
            html += '</tr>';
          });
          html += '</table>';
          settleDiv.innerHTML = html;
        }
      } catch (err) {
        settleDiv.innerHTML = '<em style="color:#ef4444;">Erro ao carregar settlements</em>';
      }

      document.getElementById('modalEditarEmpresa').style.display = 'flex';
    } catch (e) { toast(e.message || 'Erro ao carregar', 'danger'); }
  };

  window.salvarEdicaoEmpresa = async function () {
    var id = document.getElementById('editEmpId').value;
    var body = {
      nome: document.getElementById('editEmpNome').value.trim(),
      slug: document.getElementById('editEmpSlug').value.trim(),
      telefone: document.getElementById('editEmpTelefone').value.trim(),
      endereco: document.getElementById('editEmpEndereco').value.trim(),
      numero: document.getElementById('editEmpNumero').value.trim(),
      bairro: document.getElementById('editEmpBairro').value.trim(),
      cep: document.getElementById('editEmpCep').value.trim(),
      cidade: document.getElementById('editEmpCidade').value.trim(),
      estado: document.getElementById('editEmpEstado').value.trim(),
      descricao: document.getElementById('editEmpDescricao').value.trim(),
    };
    if (!body.nome) { toast('Nome é obrigatório', 'danger'); return; }
    try {
      await api('/admin/' + id, { method: 'PUT', body: JSON.stringify(body) });
      fecharModal('modalEditarEmpresa');
      toast('Empresa atualizada!');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'danger');
    }
  };

  window.desativarSplit = async function () {
    var id = document.getElementById('editEmpId').value;
    if (!(await confirmModal('Desativar Split desta empresa? O onboarding Asaas será removido.'))) return;
    try {
      await api('/admin/empresa/' + id + '/payment', { method: 'DELETE' });
      toast('Split desativado', 'warning');
      fecharModal('modalEditarEmpresa');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao desativar', 'danger');
    }
  };

  window.excluirEmpresaAction = function (ds) { window.excluirEmpresa(Number(ds.id)); };

  window.excluirEmpresa = async function (id) {
    var nome = 'esta empresa';
    try {
      var empresas = await api('/admin');
      var emp = empresas.find(function (e) { return e.id === id; });
      if (emp && emp.nome) nome = emp.nome;
    } catch (e) { /* segue com nome genérico */ }
    if (!(await confirmModal('Excluir empresa ' + nome + '? Todos os dados vinculados serão protegidos de exclusão (409 se houver dados).'))) return;
    try {
      await api('/admin/' + id, { method: 'DELETE' });
      toast('Empresa removida', 'danger');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao remover', 'danger');
    }
  };

  window.excluirUsuarioAction = function (ds) { window.excluirUsuario(Number(ds.id)); };

  function activarTabPorQuery() {
    var p = new URLSearchParams(window.location.search);
    var tab = p.get('tab');
    if (tab && ['dashboard', 'usuarios', 'senhas', 'clientes', 'registros', 'empresas', 'filiais', 'settlements', 'integracoes', 'billing'].includes(tab)) {
      switchTab(tab);
    }
  }

  carregarUsuarios();
  carregarClientes();
  carregarEmpresas();
  activarTabPorQuery();

  async function carregarSettlements() {
    try {
      var data = await api('/empresa/settlement/global');
      var tbody = document.getElementById('settlementsTableBody');
      if (!data.settlements || !data.settlements.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Nenhum settlement encontrado</td></tr>';
        return;
      }
      var statusColors = { processando: '#F59E0B', pendente: '#3B82F6', pago: '#10B981', erro: '#EF4444' };
      tbody.innerHTML = data.settlements.map(function (s) {
        var empresa = s.empresa ? escapeHtml(s.empresa.nome) : 'ID ' + s.empresaId;
        var periodo = new Date(s.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(s.weekEnd).toLocaleDateString('pt-BR');
        var cor = statusColors[s.status] || '#666';
        return '<tr><td><strong>' + empresa + '</strong></td><td>' + periodo + '</td><td>' + s.totalPedidos + '</td><td>R$ ' + Number(s.totalBruto).toFixed(2) + '</td><td>R$ ' + Number(s.totalLiquido).toFixed(2) + '</td><td style="color:' + cor + ';font-weight:600">' + s.status + '</td></tr>';
      }).join('');
    } catch (e) {
      console.error('Erro ao carregar settlements', e);
    }
  }

  // Bridge functions for data-action handlers
  window.carregarDashboardAction = function () {
    if (typeof carregarDashboard === 'function') carregarDashboard();
  };

  window.fecharModalAction = function (ds) {
    var modalId = ds && ds.modal ? ds.modal : null;
    if (modalId) fecharModal(modalId);
  };

  // External scripts (superadminDashboard.js, superadminBilling.js) define:
  // onEmpresaChange, carregarDashboard, savePricing, abrirModalCriarFilial, criarFilial
})();
