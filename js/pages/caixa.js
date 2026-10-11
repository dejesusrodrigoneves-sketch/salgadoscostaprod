// js/pages/caixa.js — módulo Controle de Caixa
const HTML_CAIXA = `<body>

<div class="container">
  <div class="card" id="aberturaCard">
    <h2><i class="fas fa-cash-register"></i> Abertura de Caixa</h2>
    <input type="number" id="valorInicial" aria-label="Valor inicial do troco" placeholder="Valor inicial (troco)">
    <button class="btn-primary" data-action="abrirCaixaAction"><i class="fas fa-play"></i> Abrir Caixa</button>
  </div>

  <div class="card" id="caixaCard" style="display:none;">
    <h2><i class="fas fa-chart-pie"></i> Resumo do Dia</h2>
    <div class="resumo-grid">
      <div class="resumo-item"><i class="fas fa-money-bill-wave"></i> Dinheiro<br><span id="dinheiro">0</span></div>
      <div class="resumo-item"><i class="fas fa-qrcode"></i> Pix<br><span id="pix">0</span></div>
      <div class="resumo-item"><i class="fas fa-credit-card"></i> Débito<br><span id="debito">0</span></div>
      <div class="resumo-item"><i class="fas fa-credit-card"></i> Crédito<br><span id="credito">0</span></div>
    </div>

    <div class="total-geral">
      <i class="fas fa-calculator"></i> Total Geral: R$ <span id="totalGeral">0</span><br>
      <span style="font-size:14px;font-weight:500;color:#16a34a;">
        Troco Inicial: R$ <span id="trocoInicial">0</span>
        &nbsp;|&nbsp; Pedidos: <span id="qtdPedidos">0</span>
      </span>
    </div>

    <canvas id="graficoPagamentos"></canvas>

    <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn-info" data-action="verRelatoriosAction"><i class="fas fa-history"></i> Ver Relatórios</button>
      <button class="btn-danger" data-action="fecharCaixaAction"><i class="fas fa-stop"></i> Fechar Caixa</button>
    </div>
    <div class="relatorios-list" id="listaRelatorios"></div>
  </div>
</div>

<div class="toast-container" id="toastContainer"></div>

</body>
`;
let _abort = null;
const _cleanups = [];

export function mount(container, params) {
  unmount();
  _abort = new AbortController();
  _cleanups.push(pageCss('css/caixa-page.css', 'caixa'));
  container.innerHTML = HTML_CAIXA;
  (function () {
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!_au.role || !['admin', 'superadmin'].includes(_au.role)) { goTo('admin'); return; }

  async function api(path, opts) {
    var o = opts || {};
    var skip = o.skipLoading === true;
    if (!skip && typeof showLoading === 'function') showLoading();
    try {
      var headers = { 'Content-Type': 'application/json' };
      var r = await authFetch((window.getApiBase ? window.getApiBase() : '') + '/api' + path,
        Object.assign({}, o, { headers: Object.assign({}, headers, o.headers || {}) }));
      if (r.status === 204) return null;
      if (!r.ok) {
        var e = await r.json().catch(function () { return { error: 'Erro ' + r.status }; });
        throw new Error(e.error || 'Erro ' + r.status);
      }
      var text = await r.text();
      return text ? JSON.parse(text) : null;
    } finally {
      if (!skip && typeof hideLoading === 'function') hideLoading();
    }
  }

  window.abrirCaixaAction = function (ds) {
    if (typeof abrirCaixa === 'function') return abrirCaixa(ds);
    console.warn('[delegator] handler not ready:', 'abrirCaixaAction');
  };
  window.verRelatoriosAction = function (ds) {
    if (typeof verRelatorios === 'function') return verRelatorios(ds);
    console.warn('[delegator] handler not ready:', 'verRelatoriosAction');
  };
  window.fecharCaixaAction = function (ds) {
    if (typeof fecharCaixa === 'function') return fecharCaixa(ds);
    console.warn('[delegator] handler not ready:', 'fecharCaixaAction');
  };

  function toast(message, type) {
    type = type || 'success';
    var c = document.getElementById('toastContainer');
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<i class="fas fa-' + (type === 'danger' ? 'times-circle' : 'check-circle') + '"></i> ' + message;
    el.onclick = function () { el.remove(); };
    c.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, 4000);
  }

  var resumo = { dinheiro: 0, pix: 0, debito: 0, credito: 0 };
  var quantidadePedidos = 0;
  var trocoInicial = 0;

  function dataHoje() { return new Date().toISOString().split('T')[0]; }

  async function abrirCaixa() {
    var valor = parseFloat(document.getElementById('valorInicial').value) || 0;
    try {
      await api('/caixa/abrir', { method: 'POST', body: JSON.stringify({ valorInicial: valor }) });
      carregarResumo();
    } catch (e) {
      toast('Erro ao abrir caixa', 'danger');
    }
  }

  async function carregarResumo() {
    document.getElementById('aberturaCard').style.display = 'none';
    document.getElementById('caixaCard').style.display = 'block';
    try {
      var caixa = await api('/caixa/hoje', { skipLoading: true });
      trocoInicial = Number(caixa.valorInicial) || 0;
      document.getElementById('trocoInicial').textContent = trocoInicial.toFixed(2);
      var hojeStr = new Date().toISOString().split('T')[0];
      var pedidos = await api('/pedidos?createdAtFrom=' + hojeStr + 'T00:00:00&createdAtTo=' + hojeStr + 'T23:59:59', { skipLoading: true });
      resumo = { dinheiro: 0, pix: 0, debito: 0, credito: 0 };
      quantidadePedidos = pedidos.length;
      pedidos.forEach(function (p) {
        var pag = (p.formaPagamento || '').toLowerCase();
        var total = Number(p.total) || 0;
        if (resumo[pag] !== undefined) resumo[pag] += total;
      });
      atualizarTela();
      gerarGrafico();
    } catch (e) {
      console.error('carregarResumo erro:', e.message);
      toast('Erro ao carregar caixa', 'danger');
    }
  }

  function atualizarTela() {
    document.getElementById('dinheiro').textContent = resumo.dinheiro.toFixed(2);
    document.getElementById('pix').textContent = resumo.pix.toFixed(2);
    document.getElementById('debito').textContent = resumo.debito.toFixed(2);
    document.getElementById('credito').textContent = resumo.credito.toFixed(2);
    document.getElementById('totalGeral').textContent = calcularTotalComTroco().toFixed(2);
    document.getElementById('qtdPedidos').textContent = quantidadePedidos;
  }

  function gerarGrafico() {
    new Chart(document.getElementById('graficoPagamentos'), {
      type: 'doughnut',
      data: {
        labels: ['Dinheiro', 'Pix', 'Débito', 'Crédito'],
        datasets: [{ data: [resumo.dinheiro, resumo.pix, resumo.debito, resumo.credito] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  async function fecharCaixa() {
    var totalPedidos = calcularTotalPedidos();
    var totalComTroco = calcularTotalComTroco();
    try {
      await api('/caixa/fechar', { method: 'POST', body: JSON.stringify({
        totalPedidos: totalPedidos,
        totalDinheiro: resumo.dinheiro, totalPix: resumo.pix,
        totalDebito: resumo.debito, totalCredito: resumo.credito,
        quantidadePedidos: quantidadePedidos,
      }) });
      imprimirRelatorio();
      toast('Caixa fechado com sucesso!');
      location.reload();
    } catch (e) {
      console.error('fecharCaixa erro:', e.message);
      toast('Erro ao fechar caixa', 'danger');
    }
  }

  function imprimirRelatorio() {
    var win = window.open('', '', 'width=300,height=600');
    win.document.write('<pre>\n' +
      'RELATÓRIO DIÁRIO - ' + dataHoje() + '\n\n' +
      'Pedidos no dia: ' + quantidadePedidos + '\n' +
      'Troco Inicial: R$ ' + trocoInicial.toFixed(2) + '\n\n' +
      '----------------------------\n' +
      'Dinheiro: R$ ' + resumo.dinheiro.toFixed(2) + '\n' +
      'Pix: R$ ' + resumo.pix.toFixed(2) + '\n' +
      'Débito: R$ ' + resumo.debito.toFixed(2) + '\n' +
      'Crédito: R$ ' + resumo.credito.toFixed(2) + '\n\n' +
      '----------------------------\n' +
      'Total Pedidos: R$ ' + calcularTotalPedidos().toFixed(2) + '\n' +
      'Total Final: R$ ' + calcularTotalComTroco().toFixed(2) + '\n' +
      '</pre>');
    win.print(); win.close();
  }

  window.onload = async function () {
    try {
      var caixa = await api('/caixa/hoje', { skipLoading: true });
      if (caixa && caixa.status === 'aberto') {
        document.getElementById('aberturaCard').style.display = 'none';
        document.getElementById('caixaCard').style.display = 'block';
        carregarResumo();
      }
    } catch (e) { /* fechado ou sem caixa */ }
  };

  async function verRelatorios() {
    var container = document.getElementById('listaRelatorios');
    container.innerHTML = '<h3 style="margin-bottom:12px;font-size:15px;">Relatórios Anteriores</h3>';
    try {
      var relatorios = await api('/caixa/relatorios');
      relatorios.forEach(function (r) {
        var div = document.createElement('div');
        div.className = 'relatorio-item';
        var total = Number(r.totalComTroco || r.totalPedidos || 0);
        div.innerHTML = '<span><strong>' + (r.data ? r.data.split('T')[0] : '-') + '</strong> — Pedidos: ' + (r.quantidadePedidos || 0) + ' — Total: R$ ' + total.toFixed(2) + '</span>';
        container.appendChild(div);
      });
    } catch (e) {
      container.innerHTML += '<p style="color:#94a3b8;">Erro ao carregar relatórios</p>';
    }
  }

  async function imprimirRelatorioAntigo(id) {
    var relatorios;
    try {
      relatorios = await api('/caixa/relatorios');
    } catch (e) { relatorios = []; }
    var d = relatorios.find(function (r) { return r.id === Number(id); }) || {};
    var win = window.open('', '', 'width=300,height=600');
    win.document.write('<pre>\n' +
      'RELATÓRIO DIÁRIO - ' + d.data + '\n\n' +
      'Pedidos no dia: ' + d.quantidadePedidos + '\n' +
      'Troco Inicial: R$ ' + (d.trocoInicial || 0).toFixed(2) + '\n\n' +
      '----------------------------\n' +
      'Dinheiro: R$ ' + (d.totalDinheiro || 0).toFixed(2) + '\n' +
      'Pix: R$ ' + (d.totalPix || 0).toFixed(2) + '\n' +
      'Débito: R$ ' + (d.totalDebito || 0).toFixed(2) + '\n' +
      'Crédito: R$ ' + (d.totalCredito || 0).toFixed(2) + '\n\n' +
      '----------------------------\n' +
      'Total Pedidos: R$ ' + (d.totalPedidos || 0).toFixed(2) + '\n' +
      'Total Final: R$ ' + (d.totalComTroco || 0).toFixed(2) + '\n' +
      '</pre>');
    win.print(); win.close();
  }

  function calcularTotalPedidos() { return Object.values(resumo).reduce(function (a, b) { return a + b; }, 0); }
  function calcularTotalComTroco() { return calcularTotalPedidos() + trocoInicial; }
  })();
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
