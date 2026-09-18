// js/pages/relatorios.js — extracted from relatorios.html inline scripts
// Delegator bridge functions
window.abrirAbaResumo = function () { abrirAba(null, 'abaResumo'); };
window.abrirAbaPeriodo = function () { abrirAba(null, 'abaPeriodo'); };
window.carregarRelatoriosDiaAction = function () { carregarRelatoriosDia(); };
window.carregarRelatoriosPeriodoAction = function () { carregarRelatoriosPeriodo(); };

(function () {
  if (!authGuard()) throw new Error('Redirect');
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!_au.role || !['admin', 'superadmin'].includes(_au.role)) { window.location.href = 'dashboard.html'; }

  function abrirAba(evt, abaId) {
    document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function (el) { el.classList.remove('active'); });
    document.getElementById(abaId).classList.add('active');
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
    else document.querySelector('[data-aba="' + abaId + '"]').classList.add('active');
  }
  window.abrirAba = abrirAba;

  var tabela = document.getElementById('relatoriosTabela');
  var ctxDia = document.getElementById('graficoFaturamentoDia').getContext('2d');
  var graficoDia;
  var isLoadingDia = false;

  function carregarRelatoriosDia() {
    if (isLoadingDia) return;
    isLoadingDia = true;
    var token = (JSON.parse(localStorage.getItem('authUser') || '{}')).token || '';
    fetch((getApiBase() || '') + '/api/pedidos', { headers: token ? { 'Authorization': 'Bearer ' + token } : {} }).then(function (r) { return r.json(); }).then(function (pedidos) {
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
        data: { labels: labels, datasets: [{ label: 'Valor total (R$)', data: valores, backgroundColor: '#f97316', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return 'R$ ' + c.raw.toFixed(2).replace('.', ','); } } } }, scales: { y: { beginAtZero: true } } }
      });
    }).catch(function (e) { console.error('Erro carregar relatorios:', e); }).finally(function () { isLoadingDia = false; });
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
    fetch(url, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} }).then(function (r) { return r.json(); }).then(function (pedidos) {
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
        data: { labels: labelsPeriodo, datasets: [{ label: 'Valor diário (R$)', data: valoresPeriodo, backgroundColor: '#f97316', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return 'R$ ' + c.raw.toFixed(2).replace('.', ','); } } } }, scales: { y: { beginAtZero: true } } }
      });
    }).catch(function (e) { container.innerHTML = '<p style="color:#94a3b8;">Erro ao carregar: ' + e.message + '</p>'; });
  }

  // Cleanup charts on page unload
  window.addEventListener('beforeunload', function () {
    if (graficoDia) graficoDia.destroy();
    if (graficoPeriodo) graficoPeriodo.destroy();
  });
})();
