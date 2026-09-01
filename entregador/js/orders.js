/**
 * Orders module for delivery driver app
 */
const EntregadorOrders = {
  async load() {
    const view = document.getElementById('pedidosView');
    const loading = document.getElementById('loadingView');
    const empty = document.getElementById('emptyState');

    loading.classList.remove('hidden');
    view.classList.add('hidden');
    empty.classList.remove('visible');

    try {
      // Use offline-aware loader
      const data = await EntregadorOffline.loadOrders();
      loading.classList.add('hidden');

      if (data.fromCache) {
        // Show offline indicator
        const offlineMsg = document.createElement('div');
        offlineMsg.className = 'badge badge-rota';
        offlineMsg.style.cssText = 'margin-bottom:12px;display:inline-flex;';
        offlineMsg.innerHTML = '<i class="bi bi-wifi-off"></i> Dados offline';
        view.prepend(offlineMsg);
      }

      if (!data.pedidos || data.pedidos.length === 0) {
        empty.classList.add('visible');
        return;
      }

      view.innerHTML = data.pedidos.map(p => this.renderCard(p)).join('');
      view.classList.remove('hidden');

      // Bind events
      view.querySelectorAll('[data-action="mapa"]').forEach(btn => {
        btn.addEventListener('click', () => this.openMap(btn.dataset.address, btn.dataset.lat, btn.dataset.lon));
      });
      view.querySelectorAll('[data-action="whatsapp"]').forEach(btn => {
        btn.addEventListener('click', () => this.openWhatsApp(btn.dataset.phone, btn.dataset.name));
      });
      view.querySelectorAll('[data-action="entregar"]').forEach(btn => {
        btn.addEventListener('click', () => EntregadorConfirm.open(btn.dataset.id));
      });
    } catch (err) {
      loading.classList.add('hidden');
      view.innerHTML = `<div class="error-msg visible" style="display:block;">${err.message}</div>`;
      view.classList.remove('hidden');
    }
  },

  renderCard(p) {
    const itens = p.itens.map(i => `${i.quantidade}x ${i.nome}${i.sabores ? ` (${i.sabores})` : ''}`).join(' • ');
    const statusBadge = this.getStatusBadge(p.status);
    const paymentLabel = this.getPaymentLabel(p.formaPagamento, p.troco);

    return `
      <div class="card">
        <div class="card-header">
          <span class="order-id">#${p.id.substring(0, 6).toUpperCase()}</span>
          ${statusBadge}
        </div>
        <div class="client-name">${p.clienteNome}</div>
        <div class="address">
          <i class="bi bi-geo-alt"></i>
          ${p.clienteEndereco || 'Endereço não informado'}${p.clienteNumero ? `, ${p.clienteNumero}` : ''}${p.clienteBairro ? ` — ${p.clienteBairro}` : ''}
        </div>
        <div class="items">${itens}</div>
        <div class="payment-info">
          <i class="bi ${p.formaPagamento === 'pix' ? 'bi-qr-code' : 'bi-cash-stack'}"></i>
          ${paymentLabel}
        </div>
        <div class="btn-row">
          <button class="btn btn-mapa" data-action="mapa" data-address="${p.clienteEndereco || ''}" data-lat="${p.lat || ''}" data-lon="${p.lon || ''}">
            <i class="bi bi-map"></i> Mapa
          </button>
          <button class="btn btn-whatsapp" data-action="whatsapp" data-phone="${p.clienteWhatsapp || ''}" data-name="${p.clienteNome}">
            <i class="bi bi-whatsapp"></i> WhatsApp
          </button>
          ${(p.status === 'em_rota' || p.status === 'pendente') ? `
            <button class="btn btn-entregar" data-action="entregar" data-id="${p.id}">
              <i class="bi bi-check-circle"></i> Entregar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  getStatusBadge(status) {
    const badges = {
      'em_rota': '<span class="badge badge-rota"><i class="bi bi-truck"></i> Em rota</span>',
      'pendente': '<span class="badge badge-pendente"><i class="bi bi-hourglass-split"></i> Pendente</span>',
      'finalizado': '<span class="badge badge-entregue"><i class="bi bi-check-circle"></i> Entregue</span>',
    };
    return badges[status] || '';
  },

  getPaymentLabel(forma, troco) {
    const labels = {
      'dinheiro': `Dinheiro${troco ? ` • Troco para R$ ${Number(troco).toFixed(2)}` : ''}`,
      'pix': 'PIX',
      'cartao_credito': 'Cartão de crédito',
      'cartao_debito': 'Cartão de débito',
    };
    return labels[forma] || forma || 'Não informado';
  },

  openMap(address, lat, lon) {
    if (lat && lon) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, '_blank');
    } else if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  },

  openWhatsApp(phone, name) {
    if (!phone) {
      alert('Número de WhatsApp não informado');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Olá ${name}, aqui é da entrega!`);
    window.open(`https://wa.me/55${clean}?text=${msg}`, '_blank');
  },
};
