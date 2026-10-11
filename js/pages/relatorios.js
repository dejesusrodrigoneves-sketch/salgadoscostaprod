// js/pages/relatorios.js — módulo SPA (receita Task3/Task5)
const HTML_RELATORIOS = `<body>

<h1><i class="fas fa-chart-bar"></i> Relatórios de Pedidos</h1>

<div class="tabs">
  <button class="tab-btn active" data-action="abrirAbaResumo" data-aba="abaResumo"><i class="fas fa-calendar-day"></i> Resumo do Dia</button>
  <button class="tab-btn" data-action="abrirAbaPeriodo" data-aba="abaPeriodo"><i class="fas fa-calendar-alt"></i> Relatório por Período</button>
</div>

<div id="abaResumo" class="tab-content active">
  <div class="card">
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr><th>Data</th><th>Total Pedidos</th><th>Finalizados</th><th>Valor Total (R$)</th></tr>
      </thead>
      <tbody id="relatoriosTabela">
        <tr><td colspan="4" style="color:#94a3b8;">Carregando...</td></tr>
      </tbody>
    </table>
    </div>
  </div>
  <div class="grafico-container">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h3><i class="fas fa-chart-bar"></i> Faturamento Diário</h3>
      <button class="btn btn-primary me-md-2" data-action="carregarRelatoriosDiaAction" aria-label="Atualizar gráfico"><i class="fas fa-sync-alt"></i> Atualizar</button>
    </div>
    <div class="chart-wrap">
      <canvas id="graficoFaturamentoDia"></canvas>
    </div>
  </div>
</div>

<div id="abaPeriodo" class="tab-content">
  <div class="card">
    <h2 style="font-size:16px;margin-bottom:16px;">📅 Relatório por Período</h2>
    <div class="filtro-datas">
      <label>De <input type="date" id="dataInicio"></label>
      <label>Até <input type="date" id="dataFim"></label>
      <button data-action="carregarRelatoriosPeriodoAction"><i class="fas fa-filter"></i> Filtrar</button>
    </div>
    <div id="resumoPeriodo" class="resumo-periodo"></div>
  </div>

  <div class="grafico-container" id="graficoPeriodoContainer" style="display:none;">
    <h3>Faturamento do Período</h3>
    <div class="chart-wrap">
      <canvas id="graficoFaturamentoPeriodo"></canvas>
    </div>
  </div>

  <div id="relatoriosPeriodo" style="margin-top:12px;">
    <p style="color:#94a3b8;font-size:13px;">Selecione um período para visualizar os relatórios.</p>
  </div>
</div>

</body>
`;
let _abort = null;
const _cleanups = [];

export  function mount(container, params) {
  unmount();
  _abort = new AbortController();
  _cleanups.push(pageCss('css/relatorios-page.css', 'relatorios'));
  container.innerHTML = HTML_RELATORIOS;
  (function () {
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!_au.role || !['admin', 'superadmin'].includes(_au.role)) { goTo('admin'); return; }

  function abrirAba(evt, abaId) {
    document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function (el) { el.classList.remove('active'); });
    document.getElementById(abaId).classList.add('active');
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
    else document.querySelector('[data-aba="' + abaId + '"]').classList.add('active');
  }
  window.abrirAba = abrirAba;
  window.abrirAbaResumo = function (ds) { abrirAba(null, 'abaResumo'); };
  window.abrirAbaPeriodo = function (ds) { abrirAba(null, 'abaPeriodo'); };
  window.carregarRelatoriosDiaAction = function (ds) {
    if (typeof carregarRelatoriosDia === 'function') return carregarRelatoriosDia(ds);
    console.warn('[delegator] handler not ready:', 'carregarRelatoriosDiaAction');
  };
  window.carregarRelatoriosPeriodoAction = function (ds) {
    if (typeof carregarRelatoriosPeriodo === 'function') return carregarRelatoriosPeriodo(ds);
    console.warn('[delegator] handler not ready:', 'carregarRelatoriosPeriodoAction');
  };

  var tabela = document.getElementById('relatoriosTabela');
  var ctxDia = document.getElementById('graficoFaturamentoDia').getContext('2d');
  var graficoDia;
  var isLoadingDia = false;

  function carregarRelatoriosDia() {
    if (isLoadingDia) return;
    isLoadingDia = true;
    if (typeof showLoading === 'function') showLoading();
    var token = (JSON.parse(localStorage.getItem('authUser') || '{}')).token || '';
    authFetch((getApiBase() || '') + '/api/pedidos').then(function (r) { return r.json(); }).then(function (pedidos) {
      var dadosPorDia = {};
      var hojeStr = new Date().toLocaleDateString('pt-BR');
      pedidos.forEach(function (p) {
        if (!p.createdAt) return;
        var d = new Date(p.createdAt);
        var diaStr = d.toLocaleDateString('pt-BR');
        if (!dadosPorDia[diaStr]) dadosPorDia[diaStr] = { totalPedidos: 0, finalizados: 0, valorTotal: 0 };
        dadosPorDia[diaStr].totalPedidos++;
        dadosPorDia[diaStr].valorTotal += Number(p.total) || 0;
        if (p.status === 'finalizado') dadosPorDia[diaStr].finalizados++;
      });
      tabela.innerHTML = '';
      var labels = [], valores = [];
      for (var dia in dadosPorDia) {
        var d = dadosPorDia[dia];
        if (dia === hojeStr) {
          tabela.innerHTML += '<tr><td>' + dia + '</td><td>' + d.totalPedidos + '</td><td>' + d.finalizados + '</td><td>' + d.valorTotal.toFixed(2).replace('.', ',') + '</td></tr>';
        }
        labels.push(dia);
        valores.push(d.valorTotal);
      }
      if (!tabela.innerHTML) tabela.innerHTML = '<tr><td colspan="4" style="color:#94a3b8;">Nenhum pedido hoje</td></tr>';
      if (graficoDia) graficoDia.destroy();
      graficoDia = new Chart(ctxDia, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Valor total (R$)', data: valores, backgroundColor: '#faae33', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return 'R$ ' + c.raw.toFixed(2).replace('.', ','); } } } }, scales: { y: { beginAtZero: true, ticks: { color: '#f0c46a' } }, x: { ticks: { color: '#f0c46a' } } } }
      });
    }).catch(function (e) { console.error('Erro carregar relatorios:', e); }).finally(function () { isLoadingDia = false; if (typeof hideLoading === 'function') hideLoading(); });
  }
  carregarRelatoriosDia();

  var ctxPeriodo = document.getElementById('graficoFaturamentoPeriodo').getContext('2d');
  var graficoPeriodo;

  function carregarRelatoriosPeriodo() {
    var inicio = document.getElementById('dataInicio').value;
    var fim = document.getElementById('dataFim').value;
    var container = document.getElementById('relatoriosPeriodo');
    var resumoDiv = document.getElementById('resumoPeriodo');
    var graficoContainer = document.getElementById('graficoPeriodoContainer');
    container.innerHTML = '<p style="color:#94a3b8;">Carregando...</p>';
    resumoDiv.innerHTML = '';
    graficoContainer.style.display = 'none';

    if (!inicio || !fim) { container.innerHTML = '<p style="color:#94a3b8;">Selecione um período válido.</p>'; return; }

    var token = (JSON.parse(localStorage.getItem('authUser') || '{}')).token || '';
    var url = (getApiBase() || '') + '/api/pedidos?createdAtFrom=' + encodeURIComponent(inicio + 'T00:00:00') + '&createdAtTo=' + encodeURIComponent(fim + 'T23:59:59') + '&order=asc';
    if (typeof showLoading === 'function') showLoading();
    authFetch(url).then(function (r) { return r.json(); }).then(function (pedidos) {
      if (!pedidos || pedidos.length === 0) { container.innerHTML = '<p style="color:#94a3b8;">Nenhum pedido encontrado nesse período.</p>'; return; }

      var pedidosPorDia = {}, totaisPorDia = {}, totalPeriodo = 0;
      pedidos.forEach(function (p) {
        if (!p.createdAt) return;
        var d = new Date(p.createdAt);
        var diaStr = d.toLocaleDateString('pt-BR');
        if (!pedidosPorDia[diaStr]) { pedidosPorDia[diaStr] = []; totaisPorDia[diaStr] = 0; }
        var valor = Number(p.total) || 0;
        totalPeriodo += valor;
        totaisPorDia[diaStr] += valor;
        pedidosPorDia[diaStr].push({ nome: p.clienteNome || 'Desconhecido', whatsapp: p.clienteWhatsapp || 'Não informado', valor: valor });
      });

      resumoDiv.innerHTML = 'Total no período: R$ ' + totalPeriodo.toFixed(2).replace('.', ',');

      container.innerHTML = '';
      var labelsPeriodo = [], valoresPeriodo = [];
      for (var dia in pedidosPorDia) {
        var pedidosHTML = pedidosPorDia[dia].map(function (p) {
          return '<div class="pedido-card"><strong>Cliente:</strong> ' + p.nome + '<br><strong>WhatsApp:</strong> ' + p.whatsapp + '<br><strong>Valor:</strong> R$ ' + p.valor.toFixed(2).replace('.', ',') + '</div>';
        }).join('');
        container.innerHTML += '<div class="dia-relatorio"><h3>' + dia + ' — Total: R$ ' + totaisPorDia[dia].toFixed(2).replace('.', ',') + '</h3>' + pedidosHTML + '</div>';
        labelsPeriodo.push(dia);
        valoresPeriodo.push(totaisPorDia[dia]);
      }

      graficoContainer.style.display = 'block';
      if (graficoPeriodo) graficoPeriodo.destroy();
      graficoPeriodo = new Chart(ctxPeriodo, {
        type: 'bar',
        data: { labels: labelsPeriodo, datasets: [{ label: 'Valor diário (R$)', data: valoresPeriodo, backgroundColor: '#faae33', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return 'R$ ' + c.raw.toFixed(2).replace('.', ','); } } } }, scales: { y: { beginAtZero: true, ticks: { color: '#f0c46a' } }, x: { ticks: { color: '#f0c46a' } } } }
      });
    }).catch(function (e) { container.innerHTML = '<p style="color:#94a3b8;">Erro ao carregar: ' + e.message + '</p>'; }).finally(function () { if (typeof hideLoading === 'function') hideLoading(); });
  }

  // Cleanup charts on page unload
  onPage(window, 'beforeunload', function () {
    if (graficoDia) graficoDia.destroy();
    if (graficoPeriodo) graficoPeriodo.destroy();
  });
  })();
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
