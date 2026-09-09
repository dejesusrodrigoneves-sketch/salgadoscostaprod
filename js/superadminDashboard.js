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

  // ---- Filiais ----

  async function carregarFiliais() {
    var tbody = document.getElementById('filiaisTableBody');
    if (!tbody) return;
    
    try {
      // Load all empresas for matriz names
      var empresas = await apiFetch('/api/admin');
      var matrizMap = {};
      empresas.forEach(function(e) { matrizMap[e.id] = e.nome; });
      
      // Load filiais from all matrizes (flat list)
      var allFiliais = [];
      for (var i = 0; i < empresas.length; i++) {
        var e = empresas[i];
        if (e.empresaTipo !== 'filial') {
          try {
            var filiais = await apiFetch('/api/admin/empresas/' + e.id + '/filiais');
            filiais.forEach(function(f) { f._matrizNome = e.nome; });
            allFiliais = allFiliais.concat(filiais);
          } catch (err) { /* skip */ }
        }
      }
      
      tbody.innerHTML = '';
      if (allFiliais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#7C7C6F;">Nenhuma filial encontrada</td></tr>';
        return;
      }
      
      allFiliais.forEach(function(filial) {
        var statusClass = filial.status === 'active' ? 'status-active' : 'status-trial';
        var statusLabel = filial.status === 'active' ? 'Ativa' : 'Pendente';
        var tr = document.createElement('tr');
        tr.innerHTML = 
          '<td>' + escapeHtml(filial.nome) + '</td>' +
          '<td>' + escapeHtml(filial.slug) + '</td>' +
          '<td>' + escapeHtml(filial._matrizNome) + '</td>' +
          '<td>' + (filial.justificativa ? escapeHtml(filial.justificativa) : '-') + '</td>' +
          '<td>' + (filial.createdAt ? new Date(filial.createdAt).toLocaleDateString('pt-BR') : '-') + '</td>' +
          '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
          '<td>' +
            (filial.status === 'pending' ? '<button onclick="aprovarFilial(' + filial.id + ')" style="padding:4px 8px;border:1px solid #22c55e;border-radius:4px;background:transparent;color:#22c55e;font-size:12px;margin-right:4px;"><i class="fas fa-check"></i> Aprovar</button>' : '') +
            '<button onclick="excluirFilial(' + filial.id + ')" style="padding:4px 8px;border:1px solid #EF4444;border-radius:4px;background:transparent;color:#EF4444;font-size:12px;"><i class="fas fa-trash"></i> Excluir</button>' +
          '</td>';
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Erro ao carregar filiais:', err);
    }
  }

  function abrirModalCriarFilial() {
    document.getElementById('modalCriarFilial').style.display = 'block';
    carregarMatrizesDropdown();
  }

  async function carregarMatrizesDropdown() {
    var select = document.getElementById('filialMatriz');
    select.innerHTML = '<option value="">Carregando...</option>';
    
    try {
      var empresas = await apiFetch('/api/admin');
      var matrizes = empresas.filter(function(e) { return e.empresaTipo !== 'filial'; });
      select.innerHTML = '<option value="">Selecionar matriz...</option>';
      matrizes.forEach(function(m) {
        select.innerHTML += '<option value="' + m.id + '">' + escapeHtml(m.nome) + '</option>';
      });
    } catch (err) {
      select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }

  async function criarFilial() {
    var nome = document.getElementById('filialNome').value.trim();
    var justificativa = document.getElementById('filialJustificativa')?.value.trim() || '';
    var parentEmpresaId = document.getElementById('filialMatriz').value;
    
    if (!nome || !parentEmpresaId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      var token = getToken();
      var res = await fetch(API_BASE + '/api/admin/filiais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ nome: nome, justificativa: justificativa || undefined, parentEmpresaId: Number(parentEmpresaId) }),
      });
      
      if (!res.ok) {
        var err = await res.json();
        throw new Error(err.error || 'Erro ao criar filial');
      }
      
      document.getElementById('modalCriarFilial').style.display = 'none';
      document.getElementById('filialNome').value = '';
      if (document.getElementById('filialJustificativa')) document.getElementById('filialJustificativa').value = '';
      document.getElementById('filialMatriz').value = '';
      carregarFiliais();
      alert('Filial criada com sucesso!');
    } catch (err) {
      alert('Erro ao criar filial: ' + err.message);
    }
  }

  async function desvincularFilial(empresaId) {
    if (!confirm('Tem certeza que deseja desvincular esta filial?')) return;
    
    try {
      var token = getToken();
      var res = await fetch(API_BASE + '/api/admin/empresas/' + empresaId + '/parent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ parentEmpresaId: null }),
      });
      
      if (!res.ok) throw new Error('Erro ao desvincular');
      
      carregarFiliais();
      alert('Filial desvinculada com sucesso!');
    } catch (err) {
      alert('Erro ao desvincular: ' + err.message);
    }
  }

  async function aprovarFilial(id) {
    if (!confirm('Tem certeza que deseja aprovar esta filial?')) return;
    
    try {
      var token = getToken();
      var res = await fetch(API_BASE + '/api/admin/filiais/' + id + '/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      });
      
      if (!res.ok) throw new Error('Erro ao aprovar');
      
      carregarFiliais();
      alert('Filial aprovada com sucesso!');
    } catch (err) {
      alert('Erro ao aprovar: ' + err.message);
    }
  }

  async function excluirFilial(id) {
    if (!confirm('Tem certeza que deseja excluir esta filial?')) return;
    
    try {
      var token = getToken();
      var res = await fetch(API_BASE + '/api/admin/filiais/' + id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      });
      
      if (!res.ok) throw new Error('Erro ao excluir');
      
      carregarFiliais();
      alert('Filial excluída com sucesso!');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  }

  window.carregarFiliais = carregarFiliais;
  window.abrirModalCriarFilial = abrirModalCriarFilial;
  window.criarFilial = criarFilial;
  window.desvincularFilial = desvincularFilial;
  window.aprovarFilial = aprovarFilial;
  window.excluirFilial = excluirFilial;

  // Expose globally for superadmin.html onclick
  window.carregarDashboard = carregarDashboard;
  window.onEmpresaChange = function() { carregarDashboard(); };

  // Auto-load on script parse
  document.addEventListener('DOMContentLoaded', function() {
    carregarEmpresasDashboard().then(carregarDashboard);
  });
})();