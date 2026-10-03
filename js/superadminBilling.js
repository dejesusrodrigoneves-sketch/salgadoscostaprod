// js/superadminBilling.js
(function() {
  const API_BASE = (window.getApiBase ? window.getApiBase() : '');
  var currentSubs = [];
  var currentEmpresaId = null;
  var currentEmpresas = [];

  function getToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('authUser'));
      return auth?.token;
    } catch { return null; }
  }

  async function apiFetch(path, options = {}) {
    const skip = options.skipLoading === true;
    const opts = { ...options };
    delete opts.skipLoading;
    if (!skip && typeof showLoading === 'function') showLoading();
    try {
      const token = getToken();
      const res = await fetch(API_BASE + path, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          ...opts.headers
        }
      });
      if (!res.ok) throw new Error('API ' + res.status);
      return res.json();
    } finally {
      if (!skip && typeof hideLoading === 'function') hideLoading();
    }
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR');
  }

  function fmtDateTime(d) {
    if (!d) return '—';
    var dt = new Date(d);
    return dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtCurrency(v) {
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  async function loadBillingDashboard() {
    try {
      var [subs, empresas] = await Promise.all([
        apiFetch('/api/admin/subscription/list', { skipLoading: true }),
        apiFetch('/api/admin', { skipLoading: true })
      ]);
      currentSubs = subs;
      currentEmpresas = empresas || [];

      var stats = {
        total: currentSubs.length,
        active: currentSubs.filter(function(s) { return s.status === 'ACTIVE'; }).length,
        trial: currentSubs.filter(function(s) { return s.status === 'TRIAL'; }).length,
        delinquent: currentSubs.filter(function(s) { return s.status === 'PAST_DUE' || s.status === 'SUSPENDED'; }).length,
        revenue: currentSubs.filter(function(s) { return s.status === 'ACTIVE'; }).reduce(function(sum, s) { return sum + Number(s.value); }, 0)
      };

      document.getElementById('billingCards').innerHTML =
        '<div class="dash-card"><div class="dash-card-icon"><i class="fas fa-building"></i></div><div class="dash-card-value">' + stats.total + '</div><div class="dash-card-label">TOTAL EMPRESAS</div></div>' +
        '<div class="dash-card"><div class="dash-card-icon"><i class="fas fa-check-circle"></i></div><div class="dash-card-value">' + stats.active + '</div><div class="dash-card-label">ATIVAS</div></div>' +
        '<div class="dash-card"><div class="dash-card-icon"><i class="fas fa-clock"></i></div><div class="dash-card-value">' + stats.trial + '</div><div class="dash-card-label">EM TRIAL</div></div>' +
        '<div class="dash-card"><div class="dash-card-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="dash-card-value">' + stats.delinquent + '</div><div class="dash-card-label">INADIMPLENTES</div></div>' +
        '<div class="dash-card"><div class="dash-card-icon"><i class="fas fa-dollar-sign"></i></div><div class="dash-card-value">R$ ' + stats.revenue.toLocaleString('pt-BR') + '</div><div class="dash-card-label">RECEITA MENSAL</div></div>';

      // Populate filter select
      var select = document.getElementById('filtroEmpresaBilling');
      if (select && currentEmpresas.length > 0) {
        var prev = select.value;
        select.innerHTML = '<option value="">Todas as empresas</option>';
        currentEmpresas.forEach(function(e) {
          select.innerHTML += '<option value="' + e.id + '">' + esc(e.nome || '-') + '</option>';
        });
        if (prev) select.value = prev;
      }

      renderAssinaturas(currentSubs);

    } catch (e) {
      console.error('Billing load error:', e);
    }
  }

  function renderAssinaturas(lista) {
    var tbody = document.getElementById('billingTableBody');
    if (!lista || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#7C7C6F;text-align:center;">Nenhuma assinatura encontrada</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function(sub) {
      return '<tr>' +
        '<td>' + esc(sub.empresa?.nome || 'ID ' + sub.empresaId) + '</td>' +
        '<td><span class="status-badge status-' + sub.status.toLowerCase() + '">' + sub.status + '</span></td>' +
        '<td>' + fmtDate(sub.nextDueDate) + '</td>' +
        '<td>' + fmtDate(sub.lastPaymentAt) + '</td>' +
        '<td><button onclick="viewSubscription(' + sub.empresaId + ')" style="padding:6px 12px;background:#F26D3D;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">Ver</button></td>' +
      '</tr>';
    }).join('');
  }

  window.filtrarAssinaturas = function() {
    var emp = document.getElementById('filtroEmpresaBilling').value;
    if (!emp) { renderAssinaturas(currentSubs); return; }
    var empNum = Number(emp);
    renderAssinaturas(currentSubs.filter(function(s) { return s.empresaId === empNum; }));
  };

  window.viewSubscription = function(empresaId) {
    currentEmpresaId = empresaId;
    var sub = currentSubs.find(function(s) { return s.empresaId === empresaId; });
    if (!sub) {
      alert('Assinatura não encontrada');
      return;
    }

    document.getElementById('subEmpresaNome').textContent = sub.empresa?.nome || 'Empresa #' + empresaId;
    document.getElementById('subEmpresaSlug').textContent = sub.empresa?.slug || '—';
    document.getElementById('subStatusText').textContent = sub.status;

    var badge = document.getElementById('subStatusBadge');
    badge.className = 'status-badge status-' + sub.status.toLowerCase();
    badge.style.fontSize = '12px';
    badge.style.padding = '5px 14px';

    document.getElementById('subValor').textContent = fmtCurrency(sub.value);
    document.getElementById('subBillingType').textContent = sub.billingType || 'PIX';
    document.getElementById('subNextDue').textContent = fmtDate(sub.nextDueDate);
    document.getElementById('subLastPayment').textContent = fmtDate(sub.lastPaymentAt) === '—' ? 'Nenhum' : fmtDate(sub.lastPaymentAt);

    var trialEl = document.getElementById('subTrialEnds');
    trialEl.textContent = fmtDate(sub.trialEndsAt);
    trialEl.className = sub.trialEndsAt ? 'detail-value-sub' : 'detail-value-sub muted';

    var canceledEl = document.getElementById('subCanceledAt');
    canceledEl.textContent = fmtDate(sub.canceledAt);
    canceledEl.className = sub.canceledAt ? 'detail-value-sub' : 'detail-value-sub muted';

    document.getElementById('subAsaasId').textContent = sub.asaasSubscriptionId || 'Não configurado';
    document.getElementById('subCreatedAt').textContent = fmtDateTime(sub.createdAt);

    document.getElementById('subStatusSelect').value = sub.status;

    document.getElementById('modalDetalhesAssinatura').classList.add('show');
  };

  window.fecharModalDetalhesAction = function() {
    document.getElementById('modalDetalhesAssinatura').classList.remove('show');
    currentEmpresaId = null;
  };

  window.atualizarStatusAssinaturaAction = async function() {
    if (!currentEmpresaId) return;
    var newStatus = document.getElementById('subStatusSelect').value;
    try {
      await apiFetch('/api/admin/subscription/' + currentEmpresaId + '/status', {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      window.fecharModalDetalhesAction();
      loadBillingDashboard();
    } catch (e) {
      alert('Erro ao atualizar status: ' + e.message);
    }
  };

  // Close modal on overlay click
  document.addEventListener('click', function(e) {
    if (e.target.id === 'modalDetalhesAssinatura') {
      window.fecharModalDetalhesAction();
    }
  });

  // Close modal on ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('modalDetalhesAssinatura');
      if (modal && modal.classList.contains('show')) {
      window.fecharModalDetalhesAction();
      }
    }
  });

  window.savePricing = async function() {
    var value = parseFloat(document.getElementById('pricingValue').value);
    var date = document.getElementById('pricingDate').value;

    if (!value || !date) {
      alert('Preencha valor e data');
      return;
    }

    try {
      await apiFetch('/api/admin/filial-pricing', {
        method: 'POST',
        body: JSON.stringify({ valorX: value, effectiveDate: date })
      });
      alert('Configuração salva e notificações enviadas!');
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    }
  };

  // Filter select listener
  var filtroSelect = document.getElementById('filtroEmpresaBilling');
  if (filtroSelect) filtroSelect.addEventListener('change', function() { window.filtrarAssinaturas(); });

  // Expose for tab switch
  window.loadBillingDashboard = loadBillingDashboard;
})();
