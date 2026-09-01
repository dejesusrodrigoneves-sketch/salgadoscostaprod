/**
 * Delivery confirmation module
 * Full-screen modal showing delivery fee + "Quanto o cliente pagou?"
 */
const EntregadorConfirm = {
  pedido: null,

  async open(pedidoId) {
    const modal = document.getElementById('confirmModal');
    const body = document.getElementById('confirmBody');

    // Fetch order details
    try {
      this.pedido = await EntregadorAPI.getPedido(pedidoId);
    } catch (err) {
      alert('Erro ao carregar pedido: ' + err.message);
      return;
    }

    const p = this.pedido;
    const itens = p.itens.map(i =>
      `<div class="row"><span class="label">${i.quantidade}x ${i.nome}${i.sabores ? ` (${i.sabores})` : ''}</span><span class="value">R$ ${Number(i.precoUnitario || 0).toFixed(2)}</span></div>`
    ).join('');

    const taxaEntrega = Number(p.taxaEntrega || 0).toFixed(2);

    body.innerHTML = `
      <div class="modal-client">
        <div class="avatar"><i class="bi bi-person"></i></div>
        <div class="name">${p.clienteNome}</div>
        <div class="addr">${p.clienteEndereco || ''}${p.clienteNumero ? `, ${p.clienteNumero}` : ''}</div>
      </div>

      <div class="modal-summary">
        ${itens}
      </div>

      <div class="delivery-fee-box">
        <div class="label">Sua taxa de entrega</div>
        <div class="value font-mono">R$ ${taxaEntrega}</div>
        <div class="hint">seu ganho nesta entrega</div>
      </div>

      <div class="input-group">
        <label for="valorCobrado">Quanto o cliente pagou?</label>
        <input type="number" id="valorCobrado" class="value-input" placeholder="R$ 0,00" step="0.01" min="0" inputmode="decimal">
      </div>

      <div class="input-group">
        <label for="observacao">Observação (opcional)</label>
        <textarea id="observacao" placeholder="Ex: Cliente não estava em casa, deixou com vizinho..."></textarea>
      </div>
    `;

    // Bind events
    document.getElementById('confirmBack').onclick = () => this.close();
    document.getElementById('confirmCancel').onclick = () => this.close();
    document.getElementById('confirmBtn').onclick = () => this.submit();

    modal.classList.add('visible');
    document.getElementById('valorCobrado').focus();
  },

  close() {
    document.getElementById('confirmModal').classList.remove('visible');
    this.pedido = null;
  },

  async submit() {
    if (!this.pedido) return;

    const valorCobrado = parseFloat(document.getElementById('valorCobrado').value);
    const observacao = document.getElementById('observacao').value.trim();
    const btn = document.getElementById('confirmBtn');

    if (isNaN(valorCobrado) || valorCobrado < 0) {
      alert('Informe o valor que o cliente pagou');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat" style="animation:spin 1s linear infinite;"></i> Confirmando...';

    try {
      // Use offline-aware confirm
      const result = await EntregadorOffline.confirmDelivery(this.pedido.id, valorCobrado, observacao);
      this.close();
      // Reload orders
      EntregadorOrders.load();
      // Show success toast
      if (result.offline) {
        this.showToast('Entrega salva offline — sincronizará quando voltar online');
      } else {
        this.showToast('Entrega confirmada!');
      }
    } catch (err) {
      alert('Erro ao confirmar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check-circle"></i> Confirmar Entrega';
    }
  },

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: #059669; color: #fff; padding: 12px 24px; border-radius: 12px;
      font-size: 14px; font-weight: 600; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },
};
