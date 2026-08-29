// js/superadminDashboard.js
(function() {
  const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';

  function getToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('authUser'));
      return auth?.token;
    } catch { return null; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatCurrency(val) {
    return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  async function apiFetch(path) {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  async function carregarEmpresasDashboard() {
    try {
      const data = await apiFetch('/api/admin/dashboard/empresas');
      const select = document.getElementById('dashEmpresaSelect');
      if (!select || !data.empresas) return;
      select.innerHTML = '<option value="">Todas as Empresas (Visão Geral)</option>';
      data.empresas.forEach(function(e) {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nome + ' (' + e.slug + ')' + (e.status === 'inativa' ? ' - Inativa' : '');
        select.appendChild(opt);
      });
    } catch (err) {
      console.error('Erro ao carregar empresas do dashboard:', err);
    }
  }

  async function carregarDashboard() {
    try {
      const select = document.getElementById('dashEmpresaSelect');
      const empresaId = select?.value || '';
      const params = empresaId ? '?empresaId=' + empresaId : '';
      const summary = await apiFetch('/api/admin/dashboard/summary' + params);

      const badge = document.getElementById('dashEmpresaBadge');
      const title = document.getElementById('dashTitle');
      const cardsContainer = document.getElementById('dashCards');
      const tableCard = document.getElementById('dashTableCard');

      if (empresaId && summary.empresaNome) {
        // Single empresa view
        badge.innerHTML = '<i class="fas fa-building"></i> ' + escapeHtml(summary.empresaNome);
        title.textContent = summary.empresaNome + ' - ' + summary.empresaSlug;
        cardsContainer.innerHTML = [
          { icon: 'fa-shopping-cart', value: summary.pedidosMes, label: 'PEDIDOS NO MÊS' },
          { icon: 'fa-check-circle', value: formatCurrency(summary.recebidoMes), label: 'RECEBIDO NO MÊS' },
          { icon: 'fa-hourglass-half', value: formatCurrency(summary.aReceber), label: 'A RECEBER' },
          { icon: 'fa-receipt', value: formatCurrency(summary.ticketMedio), label: 'TICKET MÉDIO' },
        ].map(function(c) {
          return '<div class="dash-card"><div class="dash-card-icon"><i class="fas ' + c.icon + '"></i></div><div class="dash-card-value">' + c.value + '</div><div class="dash-card-label">' + c.label + '</div></div>';
        }).join('');
        tableCard.style.display = 'none';
      } else {
        // Global view
        badge.innerHTML = '<i class="fas fa-globe"></i> Global';
        title.textContent = 'Visão Geral do SaaS';
        cardsContainer.innerHTML = [
          { icon: 'fa-store', value: summary.totalEmpresas, label: 'TOTAL EMPRESAS' },
          { icon: 'fa-bolt', value: summary.empresasAtivas, label: 'EMPRESAS ATIVAS' },
          { icon: 'fa-shopping-cart', value: summary.pedidosMes, label: 'PEDIDOS NO MÊS' },
          { icon: 'fa-calendar-day', value: summary.pedidosHoje, label: 'PEDIDOS HOJE' },
          { icon: 'fa-check-circle', value: formatCurrency(summary.recebidoMes), label: 'RECEBIDO NO MÊS' },
          { icon: 'fa-hourglass-half', value: formatCurrency(summary.aReceber), label: 'A RECEBER' },
          { icon: 'fa-receipt', value: formatCurrency(summary.ticketMedio), label: 'TICKET MÉDIO' },
        ].map(function(c) {
          return '<div class="dash-card"><div class="dash-card-icon"><i class="fas ' + c.icon + '"></i></div><div class="dash-card-value">' + c.value + '</div><div class="dash-card-label">' + c.label + '</div></div>';
        }).join('');
        tableCard.style.display = '';
        await renderEmpresasTable();
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    }
  }

  async function renderEmpresasTable() {
    try {
      const data = await apiFetch('/api/admin/dashboard/empresas');
      const tbody = document.getElementById('dashEmpresasBody');
      if (!tbody || !data.empresas) return;
      tbody.innerHTML = data.empresas.map(function(e) {
        var statusClass = e.status === 'ativa' ? 'status-active' : 'status-inactive';
        return '<tr>' +
          '<td><div class="empresa-name">' + escapeHtml(e.nome) + '</div><div class="empresa-slug">' + escapeHtml(e.slug) + '</div></td>' +
          '<td>' + e.pedidosMes + '</td>' +
          '<td class="amount-positive">' + formatCurrency(e.recebidoMes) + '</td>' +
          '<td class="amount-pending">' + formatCurrency(e.aReceber) + '</td>' +
          '<td><span class="status-badge ' + statusClass + '">' + (e.status === 'ativa' ? 'Ativa' : 'Inativa') + '</span></td>' +
          '</tr>';
      }).join('');
    } catch (err) {
      console.error('Erro ao renderizar tabela:', err);
    }
  }

  // Expose globally for superadmin.html onclick
  window.carregarDashboard = carregarDashboard;
  window.onEmpresaChange = function() { carregarDashboard(); };

  // Auto-load on script parse
  document.addEventListener('DOMContentLoaded', function() {
    carregarEmpresasDashboard().then(carregarDashboard);
  });
})();