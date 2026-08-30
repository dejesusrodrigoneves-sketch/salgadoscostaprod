// js/superadminBilling.js
(function() {
  const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';
  
  function getToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('authUser'));
      return auth?.token;
    } catch { return null; }
  }
  
  async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...options.headers
      }
    });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }
  
  async function loadBillingDashboard() {
    try {
      // Load subscriptions
      const subs = await apiFetch('/api/admin/subscription/list');
      
      // Calculate stats
      const stats = {
        total: subs.length,
        active: subs.filter(s => s.status === 'ACTIVE').length,
        trial: subs.filter(s => s.status === 'TRIAL').length,
        delinquent: subs.filter(s => ['PAST_DUE', 'SUSPENDED'].includes(s.status)).length,
        revenue: subs.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + Number(s.value), 0)
      };
      
      // Render cards
      document.getElementById('billingCards').innerHTML = `
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-building"></i></div>
          <div class="dash-card-value">${stats.total}</div>
          <div class="dash-card-label">TOTAL EMPRESAS</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-check-circle"></i></div>
          <div class="dash-card-value">${stats.active}</div>
          <div class="dash-card-label">ATIVAS</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-clock"></i></div>
          <div class="dash-card-value">${stats.trial}</div>
          <div class="dash-card-label">EM TRIAL</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="dash-card-value">${stats.delinquent}</div>
          <div class="dash-card-label">INADIMPLENTES</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon"><i class="fas fa-dollar-sign"></i></div>
          <div class="dash-card-value">R$ ${stats.revenue.toLocaleString('pt-BR')}</div>
          <div class="dash-card-label">RECEITA MENSAL</div>
        </div>
      `;
      
      // Render table
      const tbody = document.getElementById('billingTableBody');
      tbody.innerHTML = subs.map(sub => `
        <tr>
          <td>${sub.empresa?.nome || 'ID ' + sub.empresaId}</td>
          <td><span class="status-badge status-${sub.status.toLowerCase()}">${sub.status}</span></td>
          <td>${sub.nextDueDate ? new Date(sub.nextDueDate).toLocaleDateString('pt-BR') : '-'}</td>
          <td>${sub.lastPaymentAt ? new Date(sub.lastPaymentAt).toLocaleDateString('pt-BR') : '-'}</td>
          <td>
            <button onclick="viewSubscription(${sub.empresaId})" style="
              padding: 6px 12px; background: #F26D3D; color: white;
              border: none; border-radius: 6px; cursor: pointer; font-size: 12px;
            ">Ver</button>
          </td>
        </tr>
      `).join('');
      
    } catch (e) {
      console.error('Billing load error:', e);
    }
  }
  
  window.savePricing = async function() {
    const value = parseFloat(document.getElementById('pricingValue').value);
    const date = document.getElementById('pricingDate').value;
    
    if (!value || !date) {
      alert('Preencha valor e data');
      return;
    }
    
    try {
      await apiFetch('/api/admin/pricing', {
        method: 'POST',
        body: JSON.stringify({ value, effectiveDate: date })
      });
      alert('Configuração salva e notificações enviadas!');
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    }
  };
  
  window.viewSubscription = function(empresaId) {
    // TODO: Implement view details modal
    console.log('View subscription:', empresaId);
  };
  
  // Expose for tab switch
  window.loadBillingDashboard = loadBillingDashboard;
})();
