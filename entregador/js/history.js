/**
 * Delivery history module
 * Shows delivery fees (NOT order totals) grouped by day
 */
const EntregadorHistory = {
  async load() {
    const view = document.getElementById('historicoView');
    const loading = document.getElementById('loadingView');

    loading.classList.remove('hidden');
    view.classList.add('hidden');

    // Default: last 30 days
    const fim = new Date().toISOString().split('T')[0];
    const inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const data = await EntregadorAPI.getHistorico(inicio, fim);
      loading.classList.add('hidden');

      view.innerHTML = this.render(data, inicio, fim);
      view.classList.remove('hidden');

      // Bind date picker
      const startInput = view.querySelector('#histStart');
      const endInput = view.querySelector('#histEnd');
      const reloadBtn = view.querySelector('#histReload');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => this.reload(startInput.value, endInput.value));
      }
    } catch (err) {
      loading.classList.add('hidden');
      view.innerHTML = `<div class="error-msg visible" style="display:block;">${err.message}</div>`;
      view.classList.remove('hidden');
    }
  },

  render(data, inicio, fim) {
    const days = data.entregas || [];
    const resumo = data.resumo || { total: 0, quantidade: 0 };

    const daysHtml = days.map(d => {
      const items = d.entregas.map(e => `
        <div class="historico-item">
          <div class="info">
            <div class="client">${e.clienteNome}</div>
            <div class="time">${this.formatTime(e.confirmadoEm)} • ${this.getPaymentLabel(e.formaPagamento)}</div>
          </div>
          <div class="valor font-mono">R$ ${Number(e.valor).toFixed(2)}</div>
        </div>
      `).join('');

      return `
        <div class="historico-day">
          <div class="historico-day-header">
            <i class="bi bi-calendar3"></i> ${this.formatDate(d.date)} — ${d.count} entrega${d.count !== 1 ? 's' : ''}
          </div>
          ${items}
        </div>
      `;
    }).join('');

    return `
      <div class="periodo-picker">
        <input type="date" id="histStart" value="${inicio}">
        <input type="date" id="histEnd" value="${fim}">
        <button class="btn btn-mapa" id="histReload" style="flex:0;padding:12px 16px;"><i class="bi bi-arrow-repeat"></i></button>
      </div>

      ${days.length === 0 ? `
        <div class="empty-state visible">
          <div class="icon">📋</div>
          <div class="title">Nenhuma entrega encontrada</div>
          <div class="desc">Tente outro período de tempo.</div>
        </div>
      ` : daysHtml}

      ${days.length > 0 ? `
        <div class="historico-total">
          <div>
            <div class="label">Total no período</div>
            <div class="value font-mono">R$ ${Number(resumo.total).toFixed(2)}</div>
          </div>
          <div style="text-align:right;">
            <div class="label">Entregas</div>
            <div class="value font-mono">${resumo.quantidade}</div>
          </div>
        </div>
      ` : ''}
    `;
  },

  async reload(inicio, fim) {
    const view = document.getElementById('historicoView');
    view.innerHTML = '<div class="loading-indicator visible"><div class="skeleton skeleton-card"></div></div>';

    try {
      const data = await EntregadorAPI.getHistorico(inicio, fim);
      view.innerHTML = this.render(data, inicio, fim);
    } catch (err) {
      view.innerHTML = `<div class="error-msg visible" style="display:block;">${err.message}</div>`;
    }
  },

  formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  },

  formatTime(isoStr) {
    if (!isoStr) return '--:--';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  getPaymentLabel(forma) {
    const labels = {
      'dinheiro': 'Dinheiro',
      'pix': 'PIX',
      'cartao_credito': 'Cartão',
      'cartao_debito': 'Cartão',
    };
    return labels[forma] || forma || '';
  },
};
