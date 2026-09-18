// js/pages/caixa.js — extracted from caixa.html inline scripts
// Delegator bridge functions
window.abrirCaixaAction = function () { abrirCaixa(); };
window.verRelatoriosAction = function () { verRelatorios(); };
window.fecharCaixaAction = function () { fecharCaixa(); };

(function () {
  if (!authGuard(['admin', 'user'])) throw new Error('Redirect');
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!_au.role || !['admin', 'superadmin'].includes(_au.role)) { window.location.href = 'dashboard.html'; }

  function api(path, opts) {
    var headers = { 'Content-Type': 'application/json' };
    var token = (JSON.parse(localStorage.getItem('authUser') || '{}')).token;
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch((window.getApiBase ? window.getApiBase() : '') + '/api' + path, { headers: headers, ...opts }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Erro ' + r.status); });
      return r.json();
    });
  }

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
      var caixa = await api('/caixa/hoje');
      trocoInicial = Number(caixa.valorInicial) || 0;
      document.getElementById('trocoInicial').textContent = trocoInicial.toFixed(2);
      var hojeStr = new Date().toISOString().split('T')[0];
      var pedidos = await api('/pedidos?createdAtFrom=' + hojeStr + 'T00:00:00&createdAtTo=' + hojeStr + 'T23:59:59');
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
      var caixa = await api('/caixa/hoje');
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
