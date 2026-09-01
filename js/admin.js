// --- api() helper ---
function api(path, opts) {
  var headers = { 'Content-Type': 'application/json' };
  var token = (JSON.parse(localStorage.getItem('authUser') || '{}')).token;
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch('/api' + path, { headers: headers, ...opts }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Erro ' + r.status); });
    return r.json();
  });
}

// --- Auth guard + containers + tabs ---
var host = window.location.hostname;
var isLocal = host === 'localhost' || /^\d+(\.\d+){3}$/.test(host);
var sub = host.split('.')[0];
if (!isLocal && (sub === 'admin' || sub === 'www')) {
  window.location.href = '/superadmin.html';
}
// Auth guard — stops execution if not authenticated
if (typeof checkSessionValid === 'function' && !checkSessionValid()) {
  document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:40px;font-family:sans-serif;"><h2>Acesso negado</h2><p>Redirecionando para login...</p></div>';
  setTimeout(function(){ window.location.href = 'login.html'; }, 500);
  throw new Error('Redirecting to login');
} else if (typeof checkSessionValid !== 'function' && typeof authGuard === 'function' && !authGuard()) {
  document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:40px;font-family:sans-serif;"><h2>Acesso negado</h2><p>Redirecionando para login...</p></div>';
  setTimeout(function(){ window.location.href = 'login.html'; }, 500);
  throw new Error('Redirecting to login');
}

const containers = {
  pendente: document.getElementById('pendente'),
  producao: document.getElementById('producao'),
  pronto: document.getElementById('pronto'),
  'em_rota': document.getElementById('emRota'),
  finalizado: document.getElementById('finalizado')
};

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'aguardandoPagamento') carregarAguardandoPagamento();
    if (tab.dataset.tab === 'reembolsos') carregarReembolsos();
    if (tab.dataset.tab === 'naoConcluidos') carregarNaoConcluidos();
  });
});

// --- Main application JS ---
function agruparItensAdmin(itens) {
  if (!Array.isArray(itens)) return [];
  var mapa = {};
  itens.forEach(function(i) {
    if (typeof i === 'string') return;
    var pid = Number(i.produtoId);
    if (mapa[pid] === undefined) {
      mapa[pid] = { produtoId: pid, quantidade: Number(i.quantidade), precoUnitario: i.precoUnitario, sabores: i.sabores || null };
    } else {
      mapa[pid].quantidade += Number(i.quantidade);
    }
  });
  return Object.values(mapa);
}

function agruparItensComNovos(existentes, novos) {
  var temSabor = function(i) {
    if (!i || !i.sabores) return false;
    if (typeof i.sabores === 'string') return i.sabores.length > 0 && i.sabores !== '{}' && i.sabores !== 'null';
    return Object.keys(i.sabores).length > 0;
  };
  var resultado = (existentes || []).map(function(i) { return Object.assign({}, i); });
  (novos || []).forEach(function(n) {
    if (temSabor(n)) {
      resultado.push(Object.assign({}, n));
      return;
    }
    var existente = resultado.find(function(i) {
      return Number(i.produtoId) === Number(n.produtoId) && !temSabor(i);
    });
    if (existente) {
      existente.quantidade += Number(n.quantidade);
    } else {
      resultado.push(Object.assign({}, n));
    }
  });
  return resultado;
}

function fmtItens(itens) {
  if (!Array.isArray(itens)) return '<p style="font-size:12px;color:var(--stone)">Sem itens</p>';
  var prods = window.products || [];
  var groups = {};
  agruparItensAdmin(itens).forEach(function(i) {
    if (typeof i === 'string') {
      if (!groups['Outros']) groups['Outros'] = [];
      groups['Outros'].push(i);
      return;
    }
    var prod = prods.find(function(p) { return p.id === i.produtoId; });
    var cat = (prod && prod.category && prod.category.nome) || 'Outros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ item: i, prod: prod });
  });
  var html = '<div class="items-list"><h4>Itens</h4>';
  Object.keys(groups).forEach(function(cat) {
    html += '<h5 style="font-size:11px;color:var(--warning);text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px;font-weight:700;">' + escapeHtml(cat) + '</h5>';
    groups[cat].forEach(function(entry) {
      if (typeof entry === 'string') {
        var parts = entry.split('\u2192');
        if (parts.length === 2) {
          html += '<div class="item-row"><strong>' + escapeHtml(parts[0].trim()) + '</strong></div>';
          html += '<div class="sub-item">' + escapeHtml(parts[1].trim()) + '</div>';
        } else {
          html += '<div class="item-row">' + escapeHtml(entry) + '</div>';
        }
        return;
      }
      var i = entry.item;
      var prod = entry.prod;
      var qtd = i.quantidade || 1;
      var preco = Number(i.precoUnitario || 0);
      var nome = prod ? prod.name : (i.produtoNome || 'Produto #' + i.produtoId);
      var totalLinha = (qtd * preco).toFixed(2).replace('.', ',');
      html += '<div class="item-row">' +
        '<span class="item-name">' + escapeHtml(qtd + 'x ' + nome) + '</span>' +
        '<span class="leader-dots">......</span>' +
        '<span class="item-total">R$ ' + totalLinha + '</span>' +
        '</div>';
      if (i.sabores) {
        try {
          var saboresObj = typeof i.sabores === 'string' ? JSON.parse(i.sabores) : i.sabores;
          var saboresList = Object.keys(saboresObj).filter(function(id) { return Number(saboresObj[id]) > 0; }).map(function(id) {
            var s = prods.find(function(p) { return p.id == id; });
            return Number(saboresObj[id]) + 'x ' + (s ? s.name : 'Sabor #' + id);
          });
          if (saboresList.length > 0) {
            html += '<div class="sub-item">Sabores: ' + escapeHtml(saboresList.join(', ')) + '</div>';
          }
        } catch(e) {}
      }
    });
  });
  html += '</div>';
  return html;
}

function gerarHTMLImpressao(p) {
  let html = `
    <html><head><style>
      body { font-family: monospace; font-size: 12px; width: 230px; }
      h2,h3 { text-align: center; margin: 5px 0; }
      hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
    </style></head><body>
      <h2>Comprovante de Pedido</h2>
      <p><strong>Código:</strong> ${p.id || '-'}</p>
      <p><strong>Entrega:</strong> ${p.tipoEntrega || '-'}</p>
      <p><strong>Cliente:</strong> ${p.cliente?.nome || '-'}</p>
      <p><strong>Whatsapp:</strong> ${p.cliente?.whatsapp || '-'}</p>
      <p><strong>Endereço:</strong> ${p.cliente?.endereco || '-'}, ${p.cliente?.numero || '-'}</p>
      <p><strong>Bairro:</strong> ${p.cliente?.bairro || '-'}</p>
      <p><strong>Ref:</strong> ${p.cliente?.pontoReferencia || '-'}</p>
      <p><strong>Pagamento:</strong> ${p.formaPagamento || '-'}</p>
      <p><strong>Troco:</strong> ${p.troco || '-'}</p>
      <hr />`;
  if (Array.isArray(p.itens)) {
    html += '<h3>Itens:</h3>';
    var prods = window.products || [];
    var groups = {};
    agruparItensAdmin(p.itens).forEach(function(i) {
      if (typeof i === 'string') {
        if (!groups['Outros']) groups['Outros'] = [];
        groups['Outros'].push(i);
        return;
      }
      var prod = prods.find(function(p) { return p.id === i.produtoId; });
      var cat = (prod && prod.category && prod.category.nome) || 'Outros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ item: i, prod: prod });
    });
    Object.keys(groups).forEach(function(cat) {
      html += '<h4 style="margin:8px 0 2px;font-size:11px;">' + escapeHtml(cat) + '</h4>';
      groups[cat].forEach(function(entry) {
        if (typeof entry === 'string') {
          var parts = entry.split('\u2192');
          if (parts.length === 2) {
            html += '<p><strong>' + escapeHtml(parts[0].trim()) + ' \u2192</strong></p>';
            parts[1].split(',').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(sub) {
              html += '<p style="margin-left:10px;">' + escapeHtml(sub) + '</p>';
            });
          } else {
            html += '<p>' + escapeHtml(entry) + '</p>';
          }
          return;
        }
        var i = entry.item;
        var prod = entry.prod;
        var qtd = i.quantidade || 1;
        var preco = Number(i.precoUnitario || 0);
        var nome = prod ? prod.name : 'Produto #' + i.produtoId;
        var totalLinha = (qtd * preco).toFixed(2).replace('.', ',');
        html += '<p><strong>' + escapeHtml(qtd + 'x ' + nome + ' ...... R$ ' + totalLinha) + '</strong></p>';
        if (i.sabores) {
          try {
            var saboresObj = typeof i.sabores === 'string' ? JSON.parse(i.sabores) : i.sabores;
            Object.keys(saboresObj).filter(function(id) { return Number(saboresObj[id]) > 0; }).forEach(function(id) {
              var s = prods.find(function(p) { return p.id == id; });
              html += '<p style="margin-left:10px;">' + escapeHtml(Number(saboresObj[id]) + 'x ' + (s ? s.name : 'Sabor #' + id)) + '</p>';
            });
          } catch(e) {}
        }
      });
    });
  }
  html += '<hr>' +
    '<p><strong>Total itens:</strong> ' + fmtMoeda(p.valores?.itens) + '<br>' +
    '<strong>Taxa cartão:</strong> ' + (p.taxaCartao ? fmtMoeda(p.taxaCartao) : 'R$ 0,00') + '<br>' +
    '<strong>Taxa entrega:</strong> ' + fmtMoeda(p.valores?.entrega) + '<br>' +
    '<strong>Desconto:</strong> ' + fmtMoeda(p.valores?.desconto) + '<br><br>' +
    '<strong>Total:</strong> ' + fmtMoeda(p.valores?.total) + '</p>' +
    '<hr><p style="text-align:center;">Obrigado pelo seu pedido!</p>' +
    '</body></html>';
  return html;
}

function imprimirPedido(p) {
  const w = window.open('', '', 'width=300,height=600');
  w.document.write(gerarHTMLImpressao(p));
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

function atualizarBadgeEsteira() {
  const total = document.querySelectorAll('.order-card').length;
  window.parent.postMessage({ tipo: 'atualizarBadge', total }, window.location.origin);
}

function renderCard(p, docId) {
  const statusMap = {
    pendente: 'Pendente', producao: 'Produção', pronto: 'Pronto', emRota: 'Em Rota', finalizado: 'Finalizado'
  };

  const card = document.createElement('div');
  card.className = 'order-card status-' + p.status;
  card.dataset.status = p.status;
  card.dataset.id = docId;

  const nome = p.cliente?.nome || 'Cliente';
  const total = fmtMoeda(p.valores?.total);
  const isPendente = p.status === 'pendente';
  const editavel = p.status === 'producao';
  const iconeCampo = (icone, titulo, campo) => editavel
    ? ' <button type="button" class="field-edit" data-campo="' + campo + '" title="' + titulo + '" style="border:none;background:none;color:var(--primary);cursor:pointer;padding:0;font-size:14px;"><i class="bi ' + icone + '"></i></button>'
    : '';

  const podeAdicionarItem = (p.status === 'producao');

  card.innerHTML = `
    <div class="order-header${isPendente ? ' no-toggle' : ''}" ${isPendente ? '' : 'onclick="this.closest(\'.order-card\').classList.toggle(\'open\')"'}>
      <div class="order-header-left">
        <span class="order-name">${escapeHtml(nome)}</span>
        <span class="order-code">#${docId.slice(-6)}</span>
        <span class="order-status status-${p.status}">${statusMap[p.status] || p.status}</span>
        ${isPendente ? '<span class="badge-novo">NOVO</span>' : ''}
      </div>
      <div class="order-header-right">
        <span class="order-total">${total}</span>
        ${isPendente ? '' : '<i class="fas fa-chevron-down order-toggle"></i>'}
      </div>
    </div>
    <div class="order-body">
      <div class="order-info-grid">
        <div class="info-item"><strong>Whatsapp</strong>${escapeHtml(p.cliente?.whatsapp || '-')}</div>
        <div class="info-item"><strong>Endereço</strong>${escapeHtml(p.cliente?.endereco || '-')}, ${escapeHtml(p.cliente?.numero || '-')}${iconeCampo('bi-geo-alt', 'Editar endereço', 'endereco')}</div>
        <div class="info-item"><strong>Bairro</strong>${escapeHtml(p.cliente?.bairro || '-')}${iconeCampo('bi-signpost', 'Editar bairro', 'bairro')}</div>
        <div class="info-item"><strong>CEP</strong>${escapeHtml(p.cep || '-')}${iconeCampo('bi-mailbox', 'Editar CEP', 'cep')}</div>
        <div class="info-item"><strong>Ref</strong>${escapeHtml(p.cliente?.pontoReferencia || '-')}${iconeCampo('bi-pin-map', 'Editar referência', 'referencia')}</div>
        <div class="info-item"><strong>Pagamento</strong>${escapeHtml(p.formaPagamento || '-')}${iconeCampo('bi-credit-card', 'Editar pagamento', 'pagamento')}</div>
        <div class="info-item"><strong>Troco</strong>${p.troco ? fmtMoeda(p.troco) : '-'}${iconeCampo('bi-cash-coin', 'Editar troco', 'troco')}</div>
        <div class="info-item"><strong>Desconto</strong>${fmtMoeda(p.valores?.desconto)}${iconeCampo('bi-percent', 'Editar desconto', 'desconto')}</div>
        <div class="info-item"><strong>Entrega</strong>${p.tipoEntrega || '-'}${iconeCampo('bi-truck', 'Editar tipo de entrega', 'entrega')}</div>
        <div class="info-item"><strong>Total Itens</strong>${fmtMoeda(p.valores?.itens)}</div>
        <div class="info-item"><strong>Taxa Cartão</strong>${p.taxaCartao ? fmtMoeda(p.taxaCartao) : '-'}</div>
        <div class="info-item"><strong>Taxa Entrega</strong>${fmtMoeda(p.valores?.entrega)}</div>
      </div>
      ${fmtItens(p.itens)}
      <div class="order-actions">
        ${isPendente ? `
          <button class="btn-aceitar" data-action="aceitar"><i class="fas fa-check"></i> Aceitar Pedido</button>
          <button class="btn btn-print" data-action="print"><i class="fas fa-print"></i> Imprimir</button>
        ` : `
          <button class="btn btn-producao" data-action="producao"><i class="fas fa-box"></i> Produção</button>
          <button class="btn btn-pronto" data-action="pronto"><i class="fas fa-bell"></i> Pronto</button>
          ${deveMostrarEmRota(p.tipoEntrega) ? `<button class="btn btn-rota" data-action="rota"><i class="fas fa-truck"></i> Em Rota</button>` : ''}
          <button class="btn btn-finalizar" data-action="finalizar"><i class="fas fa-check"></i> Finalizar</button>
          <button class="btn btn-print" data-action="print"><i class="fas fa-print"></i> Imprimir</button>
          <button class="btn btn-delete" data-action="delete"><i class="fas fa-trash"></i> Excluir</button>
          ${podeAdicionarItem ? '<button class="btn btn-add-item" data-action="add-item"><i class="fas fa-plus"></i> Adicionar Item</button>' : ''}
        `}
      </div>
    </div>
  `;

  function notificarComLoading(acao, status, extraData, msgSucesso) {
    return async function() {
      var loadEl = toast('📤 Enviando notificação para o cliente...', 'info', 0);
      try {
        var body = { status: status, ...(extraData || {}) };
        await api('/pedidos/' + docId + '/status', { method: 'PATCH', body: JSON.stringify(body) });
        if (loadEl.parentNode) loadEl.remove();
        toast(msgSucesso, 'success');
        carregarPedidos();
      } catch(e) {
        if (loadEl.parentNode) loadEl.remove();
        toast('❌ Erro: ' + e.message, 'danger');
      }
    };
  }

  if (isPendente) {
    card.querySelector('[data-action="aceitar"]').onclick = notificarComLoading('aceitar', 'producao', null, '✅ Pedido aceito e notificação enviada!');
    card.querySelector('[data-action="print"]').onclick = () => imprimirPedido(p);
    return card;
  }

  card.querySelector('[data-action="producao"]').onclick = notificarComLoading('producao', 'producao', null, '✅ Pedido em produção e notificação enviada!');

  card.querySelector('[data-action="pronto"]').onclick = notificarComLoading('pronto', 'pronto', null, '✅ Pedido pronto e notificação enviada!');

  if (deveMostrarEmRota(p.tipoEntrega)) {
  card.querySelector('[data-action="rota"]').onclick = async function() {
    const driverId = await selecionarEntregadorModal(nome);
    if (!driverId) return;
    var loadEl = toast('📤 Enviando notificação para o cliente...', 'info', 0);
    try {
      await api('/pedidos/' + docId + '/status', { method: 'PATCH', body: JSON.stringify({ status: 'em_rota', entregadorId: driverId }) });
      await api('/entregas', { method: 'POST', body: JSON.stringify({ entregadorId: Number(driverId), pedidoId: docId, valor: Number(p.valores?.entrega) || 0 }) });
      if (loadEl.parentNode) loadEl.remove();
      toast('✅ Pedido em rota e notificação enviada!', 'success');
      carregarPedidos();
    } catch(e) {
      if (loadEl.parentNode) loadEl.remove();
      toast('❌ Erro: ' + e.message, 'danger');
    }
  };
  }

  card.querySelector('[data-action="finalizar"]').onclick = async function() {
    const ok = await confirmModal('Deseja finalizar o pedido de ' + nome + '?');
    if (!ok) return;
    var loadEl = toast('📤 Enviando notificação de finalização...', 'info', 0);
    try {
      await api('/pedidos/' + docId + '/finalizar', { method: 'POST' });
      if (loadEl.parentNode) loadEl.remove();
      toast('✅ Pedido finalizado e notificação enviada!', 'success');
      carregarPedidos();
      atualizarBadgeEsteira();
    } catch(e) {
      if (loadEl.parentNode) loadEl.remove();
      toast('❌ Erro: ' + e.message, 'danger');
    }
  };

  card.querySelector('[data-action="print"]').onclick = () => imprimirPedido(p);

  card.querySelector('[data-action="delete"]').onclick = async () => {
    const ok = await confirmModal('Deseja excluir o pedido de ' + nome + '?');
    if (!ok) return;
    await api('/pedidos/' + docId, { method: 'DELETE' });
    carregarPedidos();
    atualizarBadgeEsteira();
    toast('Pedido excluído', 'danger');
  };

  if (p.status === 'producao') {
    card.querySelectorAll('[data-campo]').forEach(function(btn) {
      btn.onclick = function() {
        modalCampo(p, btn.dataset.campo).then(function(payload) {
          if (!payload) return;
          api('/pedidos/' + p.id + '/editar', { method: 'PATCH', body: JSON.stringify(payload) })
            .then(function() { toast('✅ Campo atualizado!', 'success'); carregarPedidos(); })
            .catch(function(e) { toast('Erro ao salvar: ' + e.message, 'danger'); });
        });
      };
    });
  }

  const btnAddItem = card.querySelector('[data-action="add-item"]');
  if (btnAddItem) {
    btnAddItem.onclick = function() { abrirOverlayAdicionar(p, docId); };
  }

  return card;
}

function updateStats() {
  const counts = {};
  document.querySelectorAll('.order-card').forEach(c => {
    const s = c.dataset.status;
    counts[s] = (counts[s] || 0) + 1;
  });
  document.getElementById('statPendente').textContent = counts.pendente || 0;
  document.getElementById('statProducao').textContent = counts.producao || 0;
  document.getElementById('statPronto').textContent = counts.pronto || 0;
  document.getElementById('statRota').textContent = counts.emRota || 0;
  document.getElementById('tabCountPendente').textContent = counts.pendente || 0;
  document.getElementById('tabCountProducao').textContent = counts.producao || 0;
  document.getElementById('tabCountPronto').textContent = counts.pronto || 0;
  document.getElementById('tabCountRota').textContent = counts.emRota || 0;
  document.getElementById('tabCountFinalizado').textContent = counts.finalizado || 0;
}

async function selecionarEntregadorModal(pedidoNome) {
  return new Promise(async (resolve) => {
    var drivers = [];
    try { drivers = await api('/entregadores?ativo=true'); } catch(e) {}
    if (!drivers || drivers.length === 0) { toast('Nenhum entregador ativo cadastrado.', 'warning'); resolve(null); return; }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>Selecionar Entregador</h3>
        <p style="margin-bottom:16px;">Atribuir entregador para o pedido de <strong>${pedidoNome}</strong></p>
        <div class="driver-modal-list" id="driverModalList">
          ${drivers.map(d => `
            <div class="driver-option" data-id="${d.id}">
              <div class="driver-info">
                <span class="driver-name">${d.nome}</span>
                <span class="driver-detail">📱 ${d.whatsapp || '-'}</span>
              </div>
              <div class="driver-check"><i class="fas fa-check"></i></div>
            </div>
          `).join('')}
        </div>
        <div class="modal-actions" style="margin-top:16px;">
          <button class="btn btn-modal-cancel" id="driverModalCancel">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    let selectedId = null;
    overlay.querySelectorAll('.driver-option').forEach(el => {
      el.addEventListener('click', () => {
        overlay.querySelectorAll('.driver-option').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        selectedId = el.dataset.id;
        overlay.remove();
        resolve(selectedId);
      });
    });
    overlay.querySelector('#driverModalCancel').onclick = () => { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}

// --- Helpers de cálculo de edição (replica cart.js) ---
function calcularTaxaCartao(formaPagamento, subtotal) {
  if (formaPagamento === 'credito') return Number((subtotal * 0.06).toFixed(2));
  if (formaPagamento === 'debito')  return Number((subtotal * 0.03).toFixed(2));
  return 0;
}

function calcularTaxaEntrega(tipoEntrega, bairroNome, bairrosAtendidos) {
  if (tipoEntrega !== 'delivery') return 0;
  if (!Array.isArray(bairrosAtendidos) || !bairroNome) return 0;
  var match = bairrosAtendidos.find(function(b) {
    return b && b.nome && b.nome.toLowerCase() === String(bairroNome).toLowerCase();
  });
  return match && match.taxa ? Number(match.taxa) : 0;
}

function recalcularTotais(estado) {
  var bairros = estado.bairrosAtendidos || [];
  var subtotalItens = (estado.itens || []).reduce(function(acc, i) {
    return acc + (Number(i.quantidade) * Number(i.precoUnitario || 0));
  }, 0);
  var taxaEntrega = calcularTaxaEntrega(estado.tipoEntrega, estado.bairro, bairros);
  var subtotal = subtotalItens + taxaEntrega - Number(estado.desconto || 0);
  var taxaCartao = calcularTaxaCartao(estado.formaPagamento, subtotal);
  var total = subtotal + taxaCartao;
  return {
    subtotalItens: Number(subtotalItens.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    taxaEntrega: Number(taxaEntrega.toFixed(2)),
    taxaCartao: Number(taxaCartao.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

// Retorna true apenas para entrega delivery. Retirada = qualquer valor != 'delivery'.
function deveMostrarEmRota(tipoEntrega) {
  return String(tipoEntrega || '').toLowerCase() === 'delivery';
}

function optsBairros(est) {
  var bairrosAtendidos = est.bairrosAtendidos || [];
  var sel = est.bairro || '';
  var matchFound = bairrosAtendidos.some(function(b) { return b.nome.toLowerCase() === String(sel).toLowerCase(); });
  var html = bairrosAtendidos.map(function(b) {
    var selected = (b.nome.toLowerCase() === String(sel).toLowerCase()) ? ' selected' : '';
    return '<option value="' + b.nome + '"' + selected + '>' + b.nome + ' (R$ ' + Number(b.taxa).toFixed(2) + ')</option>';
  }).join('');
  if (!matchFound && sel) html = '<option value="' + sel + '" selected>' + sel + ' (sem taxa)</option>' + html;
  return html;
}

// --- Modal A: Editar Itens ---
function modalEditarItens(p) {
  return new Promise(async (resolve) => {
    var produtos = window.products || [];
    if (!produtos.length) {
      try {
        var r = await fetch('/api/produtos', { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (JSON.parse(localStorage.getItem('authUser') || '{}')).token } });
        var d = await r.json(); produtos = Array.isArray(d) ? d : [];
        window.products = produtos;
      } catch(e) { console.error('Falha ao carregar produtos', e); }
    }

    // clone itens atuais (deep copy rasa), agrupado por produtoId
    var itens = agruparItensAdmin(p.itens || []).map(function(i) {
      return {
        produtoId: Number(i.produtoId),
        nome: i.produto ? i.produto.name : (produtos.find(function(pr){ return pr.id === Number(i.produtoId); }) || {}).name || 'Produto #' + i.produtoId,
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.precoUnitario),
        sabores: i.sabores || null,
      };
    });

    function precoTotal() {
      return itens.reduce(function(acc, i) { return acc + (i.quantidade * i.precoUnitario); }, 0);
    }

    function renderLista() {
      return itens.map(function(i, idx) {
        return '<div class="driver-option" data-idx="' + idx + '" style="flex-direction:column;align-items:stretch;padding:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">' +
            '<span class="driver-name">' + (i.nome || 'Produto') + '</span>' +
            '<button class="btn btn-delete" style="padding:4px 8px;" data-remove="' + idx + '"><i class="fas fa-times"></i></button>' +
          '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;width:100%;">' +
            '<label style="font-size:12px;">Qtd:</label>' +
            '<input type="number" min="1" step="1" value="' + i.quantidade + '" data-qtd="' + idx + '" style="width:70px;padding:4px;">' +
            '<span style="font-size:12px;color:var(--text-muted);">R$ ' + Number(i.precoUnitario).toFixed(2) + ' / un</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderProdutosSelect() {
      var opts = '<option value="">Selecione...</option>' +
        produtos.map(function(pr) { return '<option value="' + pr.id + '">' + pr.name + ' (R$ ' + Number(pr.price).toFixed(2) + ')</option>'; }).join('');
      return opts;
    }

    function atualizaPreview() {
      var el = overlay.querySelector('#subtotalPreview');
      if (el) el.textContent = 'R$ ' + precoTotal().toFixed(2);
    }

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:600px;">' +
        '<h3><i class="fas fa-edit"></i> Editar Itens — Pedido #' + p.id + '</h3>' +
        '<p style="margin:8px 0 16px;font-size:13px;color:var(--text-muted);">Cliente: ' + (p.clienteNome || p.cliente?.nome || '-') + '</p>' +
        '<div class="driver-modal-list" id="listaItens">' + renderLista() + '</div>' +
        '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
          '<h4 style="font-size:14px;margin-bottom:8px;"><i class="fas fa-plus-circle"></i> Adicionar Item</h4>' +
          '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">' +
            '<div style="flex:1;min-width:200px;"><label style="font-size:12px;">Produto</label><select id="addProduto" style="width:100%;padding:6px;">' + renderProdutosSelect() + '</select></div>' +
            '<div style="width:80px;"><label style="font-size:12px;">Qtd</label><input type="number" id="addQtd" min="1" value="1" style="width:100%;padding:6px;"></div>' +
            '<button class="btn btn-producao" id="btnAdd"><i class="fas fa-plus"></i> Add</button>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;">' +
          '<strong>Subtotal itens: <span id="subtotalPreview">R$ ' + precoTotal().toFixed(2) + '</span></strong>' +
        '</div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="modalACancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="modalASave"><i class="fas fa-check"></i> Salvar Itens</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function rebind() {
      var container = overlay.querySelector('#listaItens');
      container.innerHTML = renderLista();
      container.querySelectorAll('button[data-remove]').forEach(function(btn) {
        btn.onclick = function() {
          var idx = Number(btn.dataset.remove);
          itens.splice(idx, 1);
          rebind();
          atualizaPreview();
        };
      });
      container.querySelectorAll('input[data-qtd]').forEach(function(inp) {
        inp.onchange = function() {
          var idx = Number(inp.dataset.qtd);
          var nova = Math.max(1, parseInt(inp.value, 10) || 1);
          itens[idx].quantidade = nova;
          atualizaPreview();
        };
      });
      atualizaPreview();
    }

    overlay.querySelector('#btnAdd').onclick = function() {
      var prodId = Number(overlay.querySelector('#addProduto').value);
      var qtd = Math.max(1, parseInt(overlay.querySelector('#addQtd').value, 10) || 1);
      if (!prodId) { toast('Selecione um produto', 'warning'); return; }
      var prod = produtos.find(function(pr) { return pr.id === prodId; });
      if (!prod) { toast('Produto não encontrado', 'danger'); return; }
      var existente = itens.find(function(i) { return Number(i.produtoId) === prodId; });
      if (existente) {
        existente.quantidade += qtd;
      } else {
        itens.push({ produtoId: prodId, nome: prod.name, quantidade: qtd, precoUnitario: Number(prod.price), sabores: null });
      }
      rebind();
      overlay.querySelector('#addProduto').value = '';
      overlay.querySelector('#addQtd').value = '1';
    };

    overlay.querySelector('#modalASave').onclick = function() {
      if (!itens.length) { toast('Adicione ao menos 1 item', 'warning'); return; }
      overlay.remove();
      resolve({ itens: itens });
    };
    overlay.querySelector('#modalACancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}

// --- Overlay Adicionar Itens (iframe balcao embedded) ---
function abrirOverlayAdicionar(p, docId) {
  // Remove modal anterior se existir
  var existing = document.getElementById('modalAdicionarItens');
  if (existing) existing.remove();

  var modalHtml = `
    <div class="modal fade" id="modalAdicionarItens" tabindex="-1">
      <div class="modal-dialog modal-fullscreen">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Adicionar Itens — Pedido #${String(docId).slice(-6)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-0">
            <iframe src="balcao.html?embedded=1" id="iframeBalcao"
                    style="width:100%;height:calc(100vh - 140px);border:none;"></iframe>
          </div>
          <div class="modal-footer d-flex flex-column p-0">
            <!-- Mini-cart bar (admin) -->
            <div class="admin-mini-cart" id="adminMiniCart" style="display:none;">
              <div class="admin-mini-cart-header" onclick="toggleAdminMiniCart()">
                <div><h4><i class="fas fa-chevron-down chevron"></i> Carrinho <span class="badge" id="adminMiniCartBadge">0</span></h4></div>
                <button class="fechar-btn" onclick="event.stopPropagation();fecharAdminMiniCart()">✕</button>
              </div>
              <div class="admin-mini-cart-lista" id="adminMiniCartLista"></div>
              <div class="admin-mini-cart-footer">
                <span class="total-label">Total</span>
                <span class="total-mini" id="adminMiniCartTotal">R$ 0,00</span>
              </div>
            </div>
            <div class="d-flex align-items-center justify-content-end p-3">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="btnSalvarItens" disabled>Salvar Alterações</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  var modalEl = document.getElementById('modalAdicionarItens');
  var iframe = document.getElementById('iframeBalcao');
  if (typeof bootstrap === 'undefined') { toast('Bootstrap não carregou', 'danger'); return; }
  var modal = new bootstrap.Modal(modalEl);

  var btnSalvar = document.getElementById('btnSalvarItens');
  var novosItens = [];

  function onMessage(e) {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === 'ITENS' && Array.isArray(e.data.itens)) {
      novosItens = e.data.itens;
      novosItens.forEach(function(n) {
        if (n.precoUnitario == null || n.precoUnitario === 0) {
          var prod = (window.products || []).find(function(pr) { return pr.id === Number(n.produtoId); });
          n.precoUnitario = prod ? Number(prod.price) : 0;
        }
        if (!n.nome) {
          var prod2 = (window.products || []).find(function(pr) { return pr.id === Number(n.produtoId); });
          n.nome = prod2 ? prod2.name : ('Item #' + n.produtoId);
        }
      });
      btnSalvar.disabled = novosItens.length === 0;
    }
    // Mini-cart update from iframe
    if (e.data && e.data.type === 'CARRINHO_UPDATE' && Array.isArray(e.data.itens)) {
      updateAdminMiniCart(e.data.itens, e.data.total, e.data.totalItens);
    }
  }
  window.addEventListener('message', onMessage);

  // Mini-cart functions
  var adminMiniCart = document.getElementById('adminMiniCart');
  var adminMiniCartBadge = document.getElementById('adminMiniCartBadge');
  var adminMiniCartLista = document.getElementById('adminMiniCartLista');
  var adminMiniCartTotal = document.getElementById('adminMiniCartTotal');

  function updateAdminMiniCart(itens, total, totalItens) {
    if (!adminMiniCart || !adminMiniCartBadge || !adminMiniCartLista || !adminMiniCartTotal) return;
    if (!itens || !itens.length) {
      adminMiniCart.style.display = 'none';
      adminMiniCart.classList.remove('aberto');
      adminMiniCartBadge.textContent = '0';
      adminMiniCartLista.innerHTML = '';
      adminMiniCartTotal.textContent = 'R$ 0,00';
      return;
    }
    adminMiniCart.style.display = 'flex';
    adminMiniCartBadge.textContent = totalItens;
    adminMiniCartTotal.textContent = 'R$ ' + total.toFixed(2);
    
    var html = '';
    itens.forEach(function(item) {
      var saboresText = '';
      if (item.sabores) {
        try {
          var s = JSON.parse(item.sabores);
          saboresText = Object.entries(s).map(function(kv) { return kv[0] + ' (' + kv[1] + ')'; }).join(', ');
        } catch (e) { saboresText = item.sabores; }
      }
      var tipo = item.produto ? item.produto.tipo : 1;
      var controlesHtml = '';
      // Note: edit/remove would need to communicate back to iframe
      html += '<div class="admin-mini-cart-item">'
        + '<div class="nome">'
        + item.nome
        + (saboresText ? '<small>' + saboresText + '</small>' : '')
        + '</div>'
        + '<span class="preco">R$ ' + Number(item.preco).toFixed(2) + '</span>'
        + '<span class="qtd-display">\u00d7' + item.quantidade + '</span>'
        + '</div>';
    });
    adminMiniCartLista.innerHTML = html;
  }

  function toggleAdminMiniCart() {
    if (!adminMiniCart) return;
    adminMiniCart.classList.toggle('aberto');
  }

  function fecharAdminMiniCart() {
    if (!adminMiniCart) return;
    adminMiniCart.classList.remove('aberto');
  }

  window.toggleAdminMiniCart = toggleAdminMiniCart;
  window.fecharAdminMiniCart = fecharAdminMiniCart;

  var pollTimer = setInterval(function() {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'SOLICITAR_ITENS' }, window.location.origin);
    }
  }, 800);

  btnSalvar.onclick = async function() {
    if (!novosItens.length) return;
    var itensAtuais = (p.itens || []).map(function(i) {
      return {
        produtoId: Number(i.produtoId),
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.precoUnitario),
        sabores: i.sabores || null,
      };
    });
    var consolidados = agruparItensComNovos(itensAtuais, novosItens);
    // Check stock for products that control stock
    var prods = window.products || [];
    for (var idx = 0; idx < novosItens.length; idx++) {
      var n = novosItens[idx];
      var produto = prods.find(function(pr) { return pr.id === Number(n.produtoId); });
      if (produto && produto.controlaEstoque) {
        if (Number(produto.estoqueAtual) < Number(n.quantidade)) {
          toast('Estoque insuficiente: ' + (n.nome || produto.name || 'Produto') + ' (estoque: ' + Number(produto.estoqueAtual) + ')', 'danger');
          return;
        }
      }
    }
    var bairrosAtendidos = [];
    try {
      var config = await api('/loja/settings-admin');
      if (config && Array.isArray(config.bairrosAtendidos)) {
        bairrosAtendidos = config.bairrosAtendidos;
      }
    } catch(e) { console.error('Falha ao buscar settings-admin', e); }
    var estado = {
      itens: consolidados,
      formaPagamento: p.formaPagamento || 'dinheiro',
      tipoEntrega: p.tipoEntrega || 'retirada',
      bairro: p.bairro || (p.cliente && p.cliente.bairro) || '',
      desconto: Number(((p.valores && p.valores.desconto) != null ? p.valores.desconto : p.desconto) || 0),
      troco: Number(p.troco || 0),
      bairrosAtendidos: bairrosAtendidos,
    };
    var totais = recalcularTotais(estado);
    var payload = {
      formaPagamento: estado.formaPagamento,
      tipoEntrega: estado.tipoEntrega,
      bairro: estado.bairro,
      taxasEntrega: totais.taxaEntrega,
      taxasCartao: totais.taxaCartao,
      desconto: Number(estado.desconto || 0),
      total: String(totais.total),
      troco: Number(estado.troco || 0),
      itens: consolidados.map(function(i) {
        return {
          produtoId: Number(i.produtoId),
          quantidade: Number(i.quantidade),
          precoUnitario: String(i.precoUnitario),
          sabores: i.sabores || null,
        };
      }),
    };
    try {
      await api('/pedidos/' + docId + '/editar', { method: 'PATCH', body: JSON.stringify(payload) });
      modal.hide();
      toast('Itens adicionados!', 'success');
      carregarPedidos();
    } catch (e) {
      toast('Erro: ' + e.message, 'danger');
    }
  };

  modalEl.addEventListener('hidden.bs.modal', function() {
    clearInterval(pollTimer);
    window.removeEventListener('message', onMessage);
    modalEl.remove();
  });

  modal.show();
}

// --- Modal B: Editar Valores + orquestração ---
async function modalEditarValores(p, estado) {
  // fetch bairros
  var bairrosAtendidos = [];
  try {
    var config = await api('/loja/settings-admin');
    if (config && Array.isArray(config.bairrosAtendidos)) {
      bairrosAtendidos = config.bairrosAtendidos;
    }
  } catch(e) { console.error('Falha ao buscar settings-admin', e); }
  estado.bairrosAtendidos = bairrosAtendidos;

  // defaults a partir do pedido
  estado.formaPagamento = estado.formaPagamento || p.formaPagamento || 'dinheiro';
  estado.tipoEntrega = estado.tipoEntrega || p.tipoEntrega || 'retirada';
  estado.bairro = estado.bairro || p.bairro || p.cliente?.bairro || '';
  estado.desconto = estado.desconto || Number(p.desconto || 0);
  estado.troco = estado.troco || Number(p.troco || 0);

  function refresh() {
    var totais = recalcularTotais(estado);
    estado.taxaEntrega = totais.taxaEntrega;
    estado.taxaCartao = totais.taxaCartao;
    estado.total = totais.total;
    var elSubItens = overlay.querySelector('#valSubItens');
    var elEntrega   = overlay.querySelector('#valEntrega');
    var elCartao    = overlay.querySelector('#valCartao');
    var elTotal     = overlay.querySelector('#valTotal');
    if (elSubItens) elSubItens.textContent = 'R$ ' + totais.subtotalItens.toFixed(2);
    if (elEntrega)   elEntrega.textContent   = 'R$ ' + totais.taxaEntrega.toFixed(2);
    if (elCartao)    elCartao.textContent    = 'R$ ' + totais.taxaCartao.toFixed(2);
    if (elTotal)     elTotal.textContent     = 'R$ ' + totais.total.toFixed(2);
    // toggle bairro section visibility
    var secBairro = overlay.querySelector('#secBairro');
    if (secBairro) secBairro.style.display = estado.tipoEntrega === 'delivery' ? 'block' : 'none';
    // toggle troco section
    var secTroco = overlay.querySelector('#secTroco');
    if (secTroco) secTroco.style.display = estado.formaPagamento === 'dinheiro' ? 'block' : 'none';
  }

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal-box" style="max-width:500px;">' +
      '<h3><i class="fas fa-sliders-h"></i> Ajustar Valores — Pedido #' + p.id + '</h3>' +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">' +
        '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Forma de Pagamento</label>' +
          '<select id="valFormaPagamento" style="width:100%;padding:6px;">' +
            '<option value="dinheiro">Dinheiro</option>' +
            '<option value="pix">PIX</option>' +
            '<option value="debito">Débito</option>' +
            '<option value="credito">Crédito</option>' +
          '</select></div>' +
        '<div id="secTroco"><label style="font-size:12px;display:block;margin-bottom:4px;">Troco para (R$)</label>' +
          '<input type="number" id="valTroco" min="0" step="0.01" value="' + Number(estado.troco || 0).toFixed(2) + '" style="width:100%;padding:6px;"></div>' +
        '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Tipo de Entrega</label>' +
          '<div style="display:flex;gap:8px;">' +
            '<label style="flex:1;"><input type="radio" name="valTipoEntrega" value="retirada"> Retirada</label>' +
            '<label style="flex:1;"><input type="radio" name="valTipoEntrega" value="delivery"> Delivery</label>' +
          '</div></div>' +
        '<div id="secBairro"><label style="font-size:12px;display:block;margin-bottom:4px;">Bairro</label>' +
          '<select id="valBairro" style="width:100%;padding:6px;">' + optsBairros(estado) + '</select></div>' +
        '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Desconto (R$)</label>' +
          '<input type="number" id="valDesconto" min="0" step="0.01" value="' + Number(estado.desconto || 0).toFixed(2) + '" style="width:100%;padding:6px;"></div>' +
        '<div style="padding:12px;background:var(--secondary);border-radius:8px;">' +
          '<div style="display:flex;justify-content:space-between;"><span>Itens:</span><span id="valSubItens">R$ 0,00</span></div>' +
          '<div style="display:flex;justify-content:space-between;"><span>Entrega:</span><span id="valEntrega">R$ 0,00</span></div>' +
          '<div style="display:flex;justify-content:space-between;"><span>Taxa cartão:</span><span id="valCartao">R$ 0,00</span></div>' +
          '<div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:4px;border-top:1px solid var(--border);padding-top:4px;"><span>Total:</span><span id="valTotal">R$ 0,00</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:16px;">' +
        '<button class="btn btn-modal-cancel" id="modalBCancel">Cancelar</button>' +
        '<button class="btn btn-pronto" id="modalBSave"><i class="fas fa-check"></i> Salvar Alterações</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // init form values
  overlay.querySelector('#valFormaPagamento').value = estado.formaPagamento;
  var radios = overlay.querySelectorAll('input[name="valTipoEntrega"]');
  radios.forEach(function(r) { r.checked = (r.value === estado.tipoEntrega); });
  refresh();

  // listeners
  overlay.querySelector('#valFormaPagamento').onchange = function() { estado.formaPagamento = this.value; refresh(); };
  overlay.querySelector('#valTroco').onchange = function() { estado.troco = Number(this.value) || 0; };
  overlay.querySelector('#valDesconto').onchange = function() { estado.desconto = Number(this.value) || 0; refresh(); };
  overlay.querySelector('#valBairro').onchange = function() { estado.bairro = this.value; refresh(); };
  radios.forEach(function(r) {
    r.onchange = function() { if (r.checked) { estado.tipoEntrega = r.value; refresh(); } };
  });

  return new Promise(function(resolve) {
    overlay.querySelector('#modalBSave').onclick = async function() {
      try {
        var payload = {
          formaPagamento: estado.formaPagamento,
          tipoEntrega: estado.tipoEntrega,
          bairro: estado.bairro,
          taxasEntrega: estado.taxaEntrega,
          taxasCartao: estado.taxaCartao,
          desconto: Number(estado.desconto || 0),
          total: String(estado.total),
          troco: Number(estado.troco || 0),
          itens: (estado.itens || []).map(function(i) {
            return { produtoId: Number(i.produtoId), quantidade: Number(i.quantidade), precoUnitario: String(i.precoUnitario), sabores: i.sabores || null };
          }),
        };
        await api('/pedidos/' + p.id + '/editar', { method: 'PATCH', body: JSON.stringify(payload) });
        toast('✅ Pedido atualizado!', 'success');
        overlay.remove();
        resolve(true);
      } catch(e) {
        console.error('Erro ao editar pedido', e);
        toast('Erro ao salvar: ' + (e.message || 'desconhecido'), 'danger');
      }
    };
    overlay.querySelector('#modalBCancel').onclick = function() { overlay.remove(); resolve(false); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

async function abrirFluxoEdicao(p) {
  // Modal A → Modal B → carregarPedidos
  var resultadoItens = await modalEditarItens(p);
  if (!resultadoItens) return; // cancelado
  var estado = { itens: resultadoItens.itens };
  var salvou = await modalEditarValores(p, estado);
  if (salvou) carregarPedidos();
}

function montarPayload(est) {
  formularioControles(est); // garante totais atualizados
  return {
    formaPagamento: est.formaPagamento,
    tipoEntrega: est.tipoEntrega,
    bairro: est.bairro,
    endereco: est.endereco,
    numero: est.numero,
    cep: est.cep,
    referencia: est.referencia,
    taxasEntrega: est.taxaEntrega,
    taxasCartao: est.taxaCartao,
    desconto: Number(est.desconto || 0),
    total: String(est.total),
    troco: Number(est.troco || 0),
    itens: est.itens.map(function(i) {
      return { produtoId: Number(i.produtoId), quantidade: Number(i.quantidade), precoUnitario: String(i.precoUnitario), sabores: i.sabores || null };
    }),
  };
}

function formularioControles(est) {
  var totais = recalcularTotais(est);
  est.taxaEntrega = totais.taxaEntrega;
  est.taxaCartao = totais.taxaCartao;
  est.total = totais.total;
  return totais;
}

async function modalCampo(p, nomeCampo) {
  var bairrosAtendidos = [];
  try {
    var cfg = await api('/loja/settings-admin');
    if (cfg && Array.isArray(cfg.bairrosAtendidos)) bairrosAtendidos = cfg.bairrosAtendidos;
  } catch(e) { console.warn('settings-admin falhou', e); }

  var est = {
    itens: agruparItensAdmin(p.itens || []).map(function(i) {
      return { produtoId: Number(i.produtoId), quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario), sabores: i.sabores || null };
    }),
    formaPagamento: p.formaPagamento || 'dinheiro',
    tipoEntrega: p.tipoEntrega || 'retirada',
    bairro: p.cliente?.bairro || '',
    endereco: p.cliente?.endereco || '',
    numero: p.cliente?.numero || '',
    cep: p.cep || '',
    referencia: p.cliente?.pontoReferencia || '',
    desconto: Number(p.valores?.desconto || 0),
    troco: Number(p.troco || 0),
    bairrosAtendidos: bairrosAtendidos,
  };

  switch (nomeCampo) {
    case 'entrega':    return modalEntrega(p, est);
    case 'pagamento':  return modalCampoSimples(p, est, 'pagamento');
    case 'troco':      return modalCampoSimples(p, est, 'troco');
    case 'desconto':   return modalCampoSimples(p, est, 'desconto');
    case 'bairro':     return modalCampoSimples(p, est, 'bairro');
    case 'cep':        return modalCampoTexto(p, est, 'cep', 'CEP');
    case 'referencia': return modalCampoTexto(p, est, 'referencia', 'Ponto de referência');
    case 'endereco':   return modalEndereco(p, est);
    default: return Promise.resolve(null);
  }
}

function modalCampoSimples(p, est, campo) {
  return new Promise(function(resolve) {
    var titulos = { pagamento: 'Forma de Pagamento', troco: 'Troco para (R$)', desconto: 'Desconto (R$)', bairro: 'Bairro' };
    var corpo = '';
    if (campo === 'pagamento') {
      corpo =
        '<select id="fcVal" style="width:100%;padding:6px;">' +
          '<option value="dinheiro">Dinheiro</option>' +
          '<option value="pix">PIX</option>' +
          '<option value="debito">Débito</option>' +
          '<option value="credito">Crédito</option>' +
        '</select>';
    } else if (campo === 'bairro') {
      corpo = '<select id="fcVal" style="width:100%;padding:6px;">' + optsBairros(est) + '</select>';
    } else {
      corpo = '<input type="number" id="fcVal" min="0" step="0.01" value="' +
        (campo === 'troco' ? Number(est.troco || 0).toFixed(2) : Number(est.desconto || 0).toFixed(2)) +
        '" style="width:100%;padding:6px;">';
    }

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:400px;">' +
        '<h3>Editar ' + titulos[campo] + ' — #' + p.id + '</h3>' +
        '<div style="margin-top:12px;">' + corpo + '</div>' +
        '<div style="margin-top:8px;font-size:13px;">Total atualizado: <strong>R$ <span id="fcTotal"></span></strong></div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="fcCancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="fcSave">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var elVal = overlay.querySelector('#fcVal');
    if (campo === 'pagamento') elVal.value = est.formaPagamento;

    function refresh() {
      formularioControles(est);
      overlay.querySelector('#fcTotal').textContent = 'R$ ' + est.total.toFixed(2);
    }
    elVal.onchange = function() {
      if (campo === 'pagamento') est.formaPagamento = this.value;
      else if (campo === 'bairro') est.bairro = this.value;
      else if (campo === 'troco') est.troco = Number(this.value) || 0;
      else if (campo === 'desconto') est.desconto = Number(this.value) || 0;
      refresh();
    };
    refresh();

    overlay.querySelector('#fcSave').onclick = function() {
      if (campo === 'pagamento') est.formaPagamento = elVal.value;
      else if (campo === 'bairro') est.bairro = elVal.value;
      else if (campo === 'troco') est.troco = Number(elVal.value) || 0;
      else if (campo === 'desconto') est.desconto = Number(elVal.value) || 0;
      overlay.remove();
      resolve(montarPayload(est));
    };
    overlay.querySelector('#fcCancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}

function modalCampoTexto(p, est, campo, rotulo) {
  return new Promise(function(resolve) {
    var valAtual = campo === 'cep' ? (est.cep || '') : (est.referencia || '');
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:400px;">' +
        '<h3>Editar ' + rotulo + ' — #' + p.id + '</h3>' +
        '<div style="margin-top:12px;"><input type="text" id="fcVal" value="' + escapeHtml(valAtual) + '" style="width:100%;padding:6px;"></div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="fcCancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="fcSave">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#fcSave').onclick = function() {
      var v = overlay.querySelector('#fcVal').value.trim();
      if (campo === 'cep') est.cep = v;
      else est.referencia = v;
      overlay.remove();
      resolve(montarPayload(est));
    };
    overlay.querySelector('#fcCancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}

function modalEndereco(p, est) {
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:400px;">' +
        '<h3>Editar Endereço — #' + p.id + '</h3>' +
        '<div style="margin-top:12px;">' +
          '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Endereço (rua)</label>' +
          '<input type="text" id="enRua" value="' + escapeHtml(est.endereco || '') + '" style="width:100%;padding:6px;"></div>' +
          '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Número</label>' +
          '<input type="text" id="enNum" value="' + escapeHtml(est.numero || '') + '" style="width:100%;padding:6px;"></div>' +
        '</div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="enCancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="enSave">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#enSave').onclick = function() {
      est.endereco = overlay.querySelector('#enRua').value.trim();
      est.numero = overlay.querySelector('#enNum').value.trim();
      overlay.remove();
      resolve(montarPayload(est));
    };
    overlay.querySelector('#enCancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}

function modalEntrega(p, est) {
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    function build() {
      var isDel = est.tipoEntrega === 'delivery';
      overlay.innerHTML =
        '<div class="modal-box" style="max-width:520px;">' +
          '<h3>Editar Entrega — #' + p.id + '</h3>' +
          '<div style="margin-top:12px;">' +
            '<label style="font-size:12px;display:block;margin-bottom:4px;">Tipo de Entrega</label>' +
            '<div style="display:flex;gap:8px;">' +
              '<label style="flex:1;"><input type="radio" name="enTipo" value="retirada"' + (isDel ? '' : ' checked') + '> Retirada</label>' +
              '<label style="flex:1;"><input type="radio" name="enTipo" value="delivery"' + (isDel ? ' checked' : '') + '> Delivery</label>' +
            '</div>' +
            '<div id="blocoEntrega" style="margin-top:12px;' + (isDel ? '' : 'display:none;') + '">' +
              '<div style="display:flex;gap:8px;">' +
                '<div style="flex:3;"><label style="font-size:12px;display:block;margin-bottom:4px;">Endereço (rua)</label>' +
                '<input type="text" id="enRua" value="' + escapeHtml(est.endereco || '') + '" style="width:100%;padding:6px;"></div>' +
                '<div style="flex:1;"><label style="font-size:12px;display:block;margin-bottom:4px;">Número</label>' +
                '<input type="text" id="enNum" value="' + escapeHtml(est.numero || '') + '" style="width:100%;padding:6px;"></div>' +
              '</div>' +
              '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Bairro (taxa de entrega)</label>' +
              '<select id="enBairro" style="width:100%;padding:6px;">' + optsBairros(est) + '</select></div>' +
              '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">CEP</label>' +
              '<input type="text" id="enCep" value="' + escapeHtml(est.cep || '') + '" style="width:100%;padding:6px;"></div>' +
              '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Referência</label>' +
              '<input type="text" id="enRef" value="' + escapeHtml(est.referencia || '') + '" style="width:100%;padding:6px;"></div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:12px;padding:10px;background:var(--secondary);border-radius:8px;">' +
            '<div style="display:flex;justify-content:space-between;"><span>Taxa entrega:</span><span>R$ <span id="enTaxa"></span></span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span>Taxa cartão:</span><span>R$ <span id="enCartao"></span></span></div>' +
            '<div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:4px;border-top:1px solid var(--border);padding-top:4px;"><span>Total:</span><span>R$ <span id="enTotal"></span></span></div>' +
          '</div>' +
          '<div class="modal-actions" style="margin-top:16px;">' +
            '<button class="btn btn-modal-cancel" id="enCancel">Cancelar</button>' +
            '<button class="btn btn-pronto" id="enSave">Salvar</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      function atualizaRecap() {
        est.endereco = overlay.querySelector('#enRua') ? overlay.querySelector('#enRua').value.trim() : est.endereco;
        est.numero = overlay.querySelector('#enNum') ? overlay.querySelector('#enNum').value.trim() : est.numero;
        est.bairro = overlay.querySelector('#enBairro') ? overlay.querySelector('#enBairro').value : est.bairro;
        est.cep = overlay.querySelector('#enCep') ? overlay.querySelector('#enCep').value.trim() : est.cep;
        est.referencia = overlay.querySelector('#enRef') ? overlay.querySelector('#enRef').value.trim() : est.referencia;
        var t = formularioControles(est);
        overlay.querySelector('#enTaxa').textContent = 'R$ ' + t.taxaEntrega.toFixed(2);
        overlay.querySelector('#enCartao').textContent = 'R$ ' + t.taxaCartao.toFixed(2);
        overlay.querySelector('#enTotal').textContent = 'R$ ' + t.total.toFixed(2);
      }

      overlay.querySelectorAll('input[name="enTipo"]').forEach(function(r) {
        r.onchange = function() {
          est.tipoEntrega = r.value;
          overlay.querySelector('#blocoEntrega').style.display = r.value === 'delivery' ? '' : 'none';
          atualizaRecap();
        };
      });
      overlay.querySelector('#enBairro').onchange = function() { atualizaRecap(); };
      overlay.querySelector('#enRua').oninput = function() { atualizaRecap(); };
      overlay.querySelector('#enNum').oninput = function() { atualizaRecap(); };
      overlay.querySelector('#enCep').oninput = function() { atualizaRecap(); };
      overlay.querySelector('#enRef').oninput = function() { atualizaRecap(); };
      atualizaRecap();

      overlay.querySelector('#enSave').onclick = function() {
        atualizaRecap();
        overlay.remove();
        resolve(montarPayload(est));
      };
      overlay.querySelector('#enCancel').onclick = function() { overlay.remove(); resolve(null); };
      overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    }
    build();
  });
}

// --- Web Audio API beep system ---
let audioCtx = null;
let beepLoopId = null;
let beepInProg = false;
let customNotifSound = null;

async function loadNotifSound() {
  try {
    const config = await api('/loja/settings-admin');
    const url = config.notificationSound || (config.themeSettings && config.themeSettings.notificationSound);
    if (url) {
      customNotifSound = new Audio(url);
      customNotifSound.load();
    }
  } catch(e) { /* fallback to beep */ }
}
loadNotifSound();

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function beep(freq, duration, type) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq || 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function tocarAlarmeNovoPedido() {
  if (customNotifSound) {
    try {
      const clone = customNotifSound.cloneNode();
      clone.volume = 1;
      clone.play().catch(function(e) {
        console.warn('Som custom falhou, usando beep:', e);
        toast('Som padrão usado (erro ao reproduzir custom)', 'warning');
        beep(880, 0.2);
        setTimeout(function() { beep(880, 0.2); }, 250);
        setTimeout(function() { beep(880, 0.3); }, 500);
      });
      return;
    } catch(e) {
      console.warn('Som custom erro:', e);
      customNotifSound = null;
    }
  }
  beep(880, 0.2);
  setTimeout(function() { beep(880, 0.2); }, 250);
  setTimeout(function() { beep(880, 0.3); }, 500);
}

function beepLoop() {
  if (beepInProg) return;
  beepInProg = true;
  function tick() {
    beepLoopId = setTimeout(function() {
      if (customNotifSound) {
        try {
          const clone = customNotifSound.cloneNode();
          clone.volume = 0.7;
          clone.play().catch(function(e) {
            console.warn('Loop custom falhou, usando beep:', e);
            beep(880, 0.5, 'sine');
          });
        } catch(e) {
          beep(880, 0.5, 'sine');
        }
      } else {
        beep(880, 0.5, 'sine');
      }
      tick();
    }, 3000);
  }
  tick();
}

function pararBeepLoop() {
  if (beepLoopId) { clearTimeout(beepLoopId); beepLoopId = null; }
  beep(660, 0.15, 'sine');
  beepInProg = false;
}

document.addEventListener('click', function() {
  var ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
}, { once: true });

// --- polling + detection ---
let pendentesAnteriores = [];
let primeiraCarga = true;

async function carregarPedidos() {
  try {
    var openIds = [];
    document.querySelectorAll('.order-card.open').forEach(function(c) {
      if (c.dataset.id) openIds.push(c.dataset.id);
    });

    // Show skeletons on first load
    if (primeiraCarga) {
      Object.values(containers).forEach(function(c) {
        c.innerHTML =
          '<div class="skeleton-card"><div class="skeleton-header"><div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-line skeleton-line-md"></div></div><div class="skeleton-body"><div class="skeleton skeleton-line skeleton-line-lg"></div><div class="skeleton-row"><div class="skeleton skeleton-line skeleton-line-sm"></div><div class="skeleton skeleton-line skeleton-line-md"></div></div></div></div>' +
          '<div class="skeleton-card"><div class="skeleton-header"><div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-line skeleton-line-md"></div></div><div class="skeleton-body"><div class="skeleton skeleton-line skeleton-line-lg"></div></div></div>';
      });
    }

    var pedidos = await api('/pedidos');

    // Clear containers
    Object.values(containers).forEach(function(c) { c.innerHTML = ''; });

    if (!pedidos || pedidos.length === 0) {
      // Show empty state with icon + action
      Object.keys(containers).forEach(function(key) {
        containers[key].innerHTML =
          '<div class="empty-state">' +
          '<i class="fas fa-clipboard-list"></i>' +
          '<p>Nenhum pedido encontrado</p>' +
          '</div>';
      });
    } else {
      pedidos.forEach(function(p) {
        if (!p.status) return;
        var container = containers[p.status];
        if (!container) return;
        var card = renderCard(p, p.id);
        container.appendChild(card);
      });
    }

    updateStats();
    atualizarBadgeEsteira();

    openIds.forEach(function(id) {
      var card = document.querySelector('.order-card[data-id="' + id + '"]');
      if (card) card.classList.add('open');
    });

    var pendentesAtuais = pedidos.filter(function(p) { return p.status === 'pendente'; });
    var novosIds = pendentesAtuais.filter(function(p) {
      return !pendentesAnteriores.some(function(a) { return a.id === p.id; });
    });

    if (novosIds.length > 0) {
      tocarAlarmeNovoPedido();
      var abaAtiva = document.querySelector('.tab.active');
      if (abaAtiva && abaAtiva.dataset.tab !== 'pendente') {
        var tabPendente = document.querySelector('.tab[data-tab="pendente"]');
        if (tabPendente) tabPendente.click();
      }
    }

    if (pendentesAtuais.length > 0 && !beepLoopId) beepLoop();
    else if (pendentesAtuais.length === 0 && beepLoopId) pararBeepLoop();

    pendentesAnteriores = pendentesAtuais;
    primeiraCarga = false;
  } catch(e) {
    console.error('Erro ao carregar pedidos:', e);
    // Show error state in containers instead of leaving them blank
    Object.values(containers).forEach(function(c) {
      c.innerHTML = '<div class="error-state">Erro ao carregar pedidos. <button onclick="carregarPedidos()">Tentar novamente</button></div>';
    });
    toast('Erro ao carregar pedidos. Tentando novamente...', 'danger');
  }
}
async function carregarAguardandoPagamento() {
  var el = document.getElementById('aguardandoPagamento');
  el.innerHTML = '<div class="skeleton-card"><div class="skeleton-header"><div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-line skeleton-line-md"></div></div><div class="skeleton-body"><div class="skeleton skeleton-line skeleton-line-lg"></div></div></div>';
  try {
    var pedidos = await api('/pedidos?paymentStatus=aguardando_pagamento');
    if (!pedidos || !pedidos.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-hourglass-half"></i><p>Nenhum pedido aguardando pagamento</p></div>'; return; }
    el.innerHTML = '';
    pedidos.forEach(function(p) {
      var card = document.createElement('div');
      card.className = 'order-card status-' + (p.status || 'pendente');
      card.dataset.status = p.status;
      var nome = p.cliente?.nome || 'Cliente';
      var total = fmtMoeda(p.valores?.total);
      var created = p.createdAt ? new Date(p.createdAt).toLocaleString('pt-BR') : '-';
      card.innerHTML =
        '<div class="order-header no-toggle">' +
          '<div class="order-header-left">' +
            '<span class="order-name">' + escapeHtml(nome) + '</span>' +
            '<span class="order-code">#' + String(p.id).slice(-6) + '</span>' +
            '<span class="order-status status-' + (p.status || 'pendente') + '" style="font-size:11px;background:var(--warning);color:#fff;padding:2px 8px;border-radius:4px;">Aguardando Pagamento</span>' +
          '</div>' +
          '<div class="order-header-right">' +
            '<span class="order-total">' + total + '</span>' +
            '<i class="fas fa-chevron-down order-toggle" onclick="this.closest(\'.order-card\').classList.toggle(\'open\')"></i>' +
          '</div>' +
        '</div>' +
        '<div class="order-body">' +
          '<div class="order-info-grid">' +
            '<div class="info-item"><strong>Whatsapp</strong>' + escapeHtml(p.cliente?.whatsapp || '-') + '</div>' +
            '<div class="info-item"><strong>Pagamento</strong>' + escapeHtml(p.formaPagamento || '-') + '</div>' +
            '<div class="info-item"><strong>Entrega</strong>' + escapeHtml(p.tipoEntrega || '-') + '</div>' +
            '<div class="info-item"><strong>Criado em</strong>' + created + '</div>' +
          '</div>' +
          (p.itens ? fmtItens(p.itens) : '') +
        '</div>';
      el.appendChild(card);
    });
  } catch(e) {
    el.innerHTML = '<div class="error-state">Erro ao carregar pedidos aguardando pagamento. <button onclick="carregarAguardandoPagamento()">Tentar novamente</button></div>';
    toast('Erro ao carregar pedidos aguardando pagamento', 'danger');
  }
}

async function carregarReembolsos() {
  var el = document.getElementById('reembolsos');
  el.innerHTML = '<div class="skeleton-card"><div class="skeleton-body"><div class="skeleton skeleton-line skeleton-line-lg"></div><div class="skeleton skeleton-line skeleton-line-lg"></div></div></div>';
  try {
    var rejeitados = await api('/payment/rejeitados');
    if (!rejeitados || !rejeitados.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-undo"></i><p>Nenhum pagamento rejeitado para reembolso</p></div>'; return; }
    var html = '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--border);text-align:left;">' +
        '<th style="padding:8px;">Cliente</th>' +
        '<th style="padding:8px;">WhatsApp</th>' +
        '<th style="padding:8px;">Pedido</th>' +
        '<th style="padding:8px;">Criado</th>' +
        '<th style="padding:8px;">Rejeitado</th>' +
        '<th style="padding:8px;">Valor</th>' +
        '<th style="padding:8px;">Motivo</th>' +
        '<th style="padding:8px;">Ação</th>' +
      '</tr></thead><tbody>';
    rejeitados.forEach(function(r) {
      var criado = r.criadoEm ? new Date(r.criadoEm).toLocaleString('pt-BR') : '-';
      var rejeitado = r.rejeitadoEm ? new Date(r.rejeitadoEm).toLocaleString('pt-BR') : '-';
      var valor = r.valor != null ? fmtMoeda(r.valor) : '-';
      var motivos = {
        'NOT_ACCEPTED': 'Cartão não aceito',
        'INTERNAL_ERROR': 'Erro interno',
        'BY_PAYER': 'Cancelado pelo pagador',
        'RETURNED': 'Devolvido',
        'EXPIRED': 'Expirado'
      };
      var motivoTexto = motivos[r.motivo] || r.motivo || '-';
      var jaReembolsado = r.refundId;
      html += '<tr style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:8px;">' + escapeHtml(r.clienteNome || '-') + '</td>' +
        '<td style="padding:8px;">' + escapeHtml(r.clienteWhatsapp || '-') + '</td>' +
        '<td style="padding:8px;">#' + String(r.pedidoId || '').slice(-6) + '</td>' +
        '<td style="padding:8px;">' + criado + '</td>' +
        '<td style="padding:8px;">' + rejeitado + '</td>' +
        '<td style="padding:8px;">' + valor + '</td>' +
        '<td style="padding:8px;">' + escapeHtml(motivoTexto) + '</td>' +
        '<td style="padding:8px;">' +
          (jaReembolsado
            ? '<span style="color:var(--success);font-weight:600;">Reembolsado</span>'
            : '<button class="btn btn-reembolsar" data-refund-id="' + r.id + '" style="padding:4px 12px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;"><i class="fas fa-undo"></i> Reembolsar</button>') +
        '</td></tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
    el.querySelectorAll('.btn-reembolsar').forEach(function(btn) {
      btn.onclick = async function() {
        var pagamentoId = btn.dataset.refundId;
        var ok = await confirmModal('Confirmar reembolso deste pagamento?');
        if (!ok) return;
        btn.disabled = true;
        btn.textContent = 'Processando...';
        try {
          await api('/payment/' + pagamentoId + '/refund', { method: 'POST' });
          toast('✅ Reembolso solicitado com sucesso!', 'success');
          carregarReembolsos();
        } catch(e) {
          toast('❌ Erro ao reembolsar: ' + e.message, 'danger');
          btn.disabled = false;
          btn.textContent = ' Reembolsar';
        }
      };
    });
  } catch(e) {
    el.innerHTML = '<div class="error-state">Erro ao carregar reembolsos. <button onclick="carregarReembolsos()">Tentar novamente</button></div>';
    toast('Erro ao carregar reembolsos', 'danger');
  }
}

// --- Helper: formatar tempo decorrido (mesma lógica do backend) ---
function formatarTempoDecorrido(dataISO) {
  const diffMs = Date.now() - new Date(dataISO).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 60) return minutos + 'min';
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas + 'h';
  const dias = Math.floor(horas / 24);
  const horasRest = horas % 24;
  return dias + 'd ' + horasRest + 'h';
}

// --- Modal de limpeza de pedidos não concluídos ---
function abrirModalLimpezaNaoConcluidos() {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal-box" style="max-width:700px;">' +
      '<h3><i class="fas fa-broom"></i> Limpeza de Pedidos Não Concluídos</h3>' +
      '<p style="margin:8px 0 16px;font-size:13px;color:var(--text-muted);">Pré-visualização dos pedidos que serão removidos (expirados ou rejeitados há mais de 30 dias).</p>' +
      '<div id="limpezaPreview" style="max-height:300px;overflow-y:auto;"></div>' +
      '<div class="modal-actions" style="margin-top:16px;">' +
        '<button class="btn btn-modal-cancel" id="limpezaCancel">Cancelar</button>' +
        '<button class="btn btn-delete" id="limpezaConfirm"><i class="fas fa-trash"></i> Confirmar Limpeza (30 dias)</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  async function carregarPreview() {
    var previewEl = overlay.querySelector('#limpezaPreview');
    previewEl.innerHTML = '<div class="empty-state">Carregando...</div>';
    try {
      var data = await api('/admin/pedidos/preview-limpeza?dias=30');
      if (!data || !data.pedidos || data.pedidos.length === 0) {
        previewEl.innerHTML = '<div class="empty-state">Nenhum pedido para limpar (mais de 30 dias).</div>';
        overlay.querySelector('#limpezaConfirm').disabled = true;
        return;
      }
      var html = '<div style="font-size:13px;margin-bottom:12px;"><strong>Total: </strong>' + data.count + ' pedidos &nbsp;|&nbsp; <strong>Valor total: </strong>' + fmtMoeda(data.totalValor) + '</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
        '<thead><tr style="border-bottom:2px solid var(--border);text-align:left;">' +
        '<th style="padding:6px;">ID</th>' +
        '<th style="padding:6px;">Cliente</th>' +
        '<th style="padding:6px;">Total</th>' +
        '<th style="padding:6px;">Motivo</th>' +
        '<th style="padding:6px;">Data</th>' +
        '</tr></thead><tbody>';
      data.pedidos.forEach(function(p) {
        var motivoBadge = '';
        if (p.motivo === 'expirado') {
          motivoBadge = '<span style="background:var(--warning);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">🟠 Expirado há ' + formatarTempoDecorrido(p.data) + '</span>';
        } else if (p.motivo === 'rejeitado') {
          motivoBadge = '<span style="background:var(--danger);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">🔴 Rejeitado: ' + escapeHtml(p.detalhe || '-') + '</span>';
        }
        html += '<tr style="border-bottom:1px solid var(--border);">' +
          '<td style="padding:6px;">' + escapeHtml(String(p.id).slice(-6)) + '</td>' +
          '<td style="padding:6px;">' + escapeHtml(p.cliente || '-') + '</td>' +
          '<td style="padding:6px;">' + fmtMoeda(p.total) + '</td>' +
          '<td style="padding:6px;">' + motivoBadge + '</td>' +
          '<td style="padding:6px;">' + (p.data ? new Date(p.data).toLocaleString('pt-BR') : '-') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table>';
      previewEl.innerHTML = html;
    } catch(e) {
      previewEl.innerHTML = '<div class="error-state">Erro ao carregar prévia: ' + e.message + '</div>';
      overlay.querySelector('#limpezaConfirm').disabled = true;
    }
  }

  carregarPreview();

  overlay.querySelector('#limpezaConfirm').onclick = async function() {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Limpando...';
    try {
      var res = await api('/admin/pedidos/limpar-expirados', { method: 'POST', body: JSON.stringify({ dias: 30 }) });
      toast('✅ ' + res.removidos + ' pedidos removidos (R$ ' + fmtMoeda(res.valorTotal) + ')', 'success');
      overlay.remove();
      carregarNaoConcluidos();
    } catch(e) {
      toast('❌ Erro: ' + e.message, 'danger');
      btn.disabled = false;
      btn.textContent = 'Confirmar Limpeza (30 dias)';
    }
  };

  overlay.querySelector('#limpezaCancel').onclick = function() { overlay.remove(); };
  overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); } });
}

// --- Carregar pedidos não concluídos ---
async function carregarNaoConcluidos() {
  var el = document.getElementById('naoConcluidos');
  el.innerHTML = '<div class="skeleton-card"><div class="skeleton-body"><div class="skeleton skeleton-line skeleton-line-lg"></div><div class="skeleton skeleton-line skeleton-line-lg"></div></div></div>';
  try {
    var pedidos = await api('/pedidos/nao-concluidos');
    if (!pedidos || !pedidos.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-ban"></i><p>Nenhum pedido não concluído encontrado</p></div>';
      document.getElementById('tabCountNaoConcluidos').textContent = 0;
      return;
    }
    document.getElementById('tabCountNaoConcluidos').textContent = pedidos.length;

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<h3 style="margin:0;">Não Concluídos (' + pedidos.length + ')</h3>' +
      '<button class="btn btn-delete" onclick="abrirModalLimpezaNaoConcluidos()" style="padding:6px 12px;font-size:12px;"><i class="fas fa-broom"></i> Limpar (>30 dias)</button>' +
      '</div>';
    html += '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--border);text-align:left;">' +
      '<th style="padding:8px;">ID</th>' +
      '<th style="padding:8px;">Cliente</th>' +
      '<th style="padding:8px;">Total</th>' +
      '<th style="padding:8px;">Motivo</th>' +
      '<th style="padding:8px;">Data</th>' +
      '</tr></thead><tbody>';
    pedidos.forEach(function(p) {
      var motivoBadge = '';
      if (p.motivo === 'expirado') {
        motivoBadge = '<span style="background:var(--warning);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">🟠 Expirado há ' + formatarTempoDecorrido(p.data) + '</span>';
      } else if (p.motivo === 'rejeitado') {
        motivoBadge = '<span style="background:var(--danger);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">🔴 Rejeitado: ' + escapeHtml(p.detalhe || '-') + '</span>';
      }
      html += '<tr style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:8px;">' + escapeHtml(String(p.id).slice(-6)) + '</td>' +
        '<td style="padding:8px;">' + escapeHtml(p.cliente || '-') + '</td>' +
        '<td style="padding:8px;">' + fmtMoeda(p.total) + '</td>' +
        '<td style="padding:8px;">' + motivoBadge + '</td>' +
        '<td style="padding:8px;">' + (p.data ? new Date(p.data).toLocaleString('pt-BR') : '-') + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div class="error-state">Erro ao carregar não concluídos. <button onclick="carregarNaoConcluidos()">Tentar novamente</button></div>';
    toast('Erro ao carregar não concluídos', 'danger');
  }
}

async function initAdmin() {
  try { var r = await fetch('/api/produtos', { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (JSON.parse(localStorage.getItem('authUser') || '{}')).token } }); var d = await r.json(); window.products = Array.isArray(d) ? d : []; } catch(e) { window.products = []; }
  carregarPedidos();
}
initAdmin();
var lastPedidosHash = '';
var pedidosTimer = setInterval(async function() {
  try {
    var res = await fetch('/api/pedidos', { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (JSON.parse(localStorage.getItem('authUser') || '{}')).token } });
    var data = await res.json();
    var hash = JSON.stringify(data.map(function(p) { return p.id + p.status; }));
    if (hash !== lastPedidosHash) {
      lastPedidosHash = hash;
      renderPedidos(data);
    }
    else { console.log('[polling] hash igual, skip re-render'); }
  } catch (e) { console.error('[polling] erro:', e); }
}, 10000);
