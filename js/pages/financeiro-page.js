// js/pages/financeiro.js — extracted from financeiro.html inline script
// Delegator bridge functions
window.financeiroSincronizar = function () { if (typeof Financeiro !== 'undefined') Financeiro.sincronizar(); };
window.financeiroGerarFechamento = function () { if (typeof Financeiro !== 'undefined') Financeiro.gerarFechamento(); };

(function () {
  var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
  var isMatriz = authUser.empresaTipo === 'matriz';

  // Formatação BRL
  function fmtBRL(v) {
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  window.fmtBRL = fmtBRL;

  // Tabs
  var tabsEl = document.getElementById('fin-tabs');
  var tabBtns = document.querySelectorAll('.fin-tab');
  var tabPanels = document.querySelectorAll('.fin-tab-panel');

  if (isMatriz) {
    tabsEl.style.display = 'flex';
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('fin-tab-' + btn.dataset.tab).classList.add('active');

      // Carregar consolidado ao clicar na tab
      if (btn.dataset.tab === 'consolidado' && isMatriz) {
        carregarConsolidado();
      }
    });
  });

  // Checar URL params para abrir consolidado direto
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('consolidated') === '1' && isMatriz) {
    tabBtns.forEach(function (b) { b.classList.remove('active'); });
    tabPanels.forEach(function (p) { p.classList.remove('active'); });
    document.querySelector('[data-tab="consolidado"]').classList.add('active');
    document.getElementById('fin-tab-consolidado').classList.add('active');
  }

  // Carregar consolidado
  async function carregarConsolidado() {
    var loadingEl = document.getElementById('consol-loading');
    var contentEl = document.getElementById('consol-content');
    try {
      var token = localStorage.getItem('token');
      var res = await fetch((getApiBase() || '') + '/api/financeiro/consolidated', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Erro ao carregar consolidado');
      var data = await res.json();

      // Totais
      document.getElementById('consol-bruto').textContent = fmtBRL(data.bruto);
      document.getElementById('consol-descontos').textContent = '-' + fmtBRL(data.descontos);
      document.getElementById('consol-taxas').textContent = '-' + fmtBRL(data.taxas);
      document.getElementById('consol-liquido').textContent = fmtBRL(data.liquido);
      document.getElementById('consol-recebido').textContent = fmtBRL(data.recebido);
      document.getElementById('consol-a-receber').textContent = fmtBRL(data.aReceber);

      // Tabela por filial
      var tbody = document.getElementById('consol-filiais-tbody');
      var tfoot = document.getElementById('consol-filiais-tfoot');
      tbody.innerHTML = '';
      tfoot.innerHTML = '';

      var filiais = data.filiais || [];
      var totalBruto = 0, totalLiquido = 0, totalRecebido = 0, totalAReceber = 0;

      filiais.forEach(function (f) {
        totalBruto += f.bruto || 0;
        totalLiquido += f.liquido || 0;
        totalRecebido += f.recebido || 0;
        totalAReceber += f.aReceber || 0;

        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="filial-name">' + (f.nome || 'Filial') + '</td>' +
          '<td>' + fmtBRL(f.bruto) + '</td>' +
          '<td class="positive">' + fmtBRL(f.liquido) + '</td>' +
          '<td>' + fmtBRL(f.recebido) + '</td>' +
          '<td class="pending">' + fmtBRL(f.aReceber) + '</td>';
        tbody.appendChild(tr);
      });

      tfoot.innerHTML =
        '<tr>' +
        '<td>TOTAL</td>' +
        '<td>' + fmtBRL(totalBruto) + '</td>' +
        '<td style="color:#10b981;">' + fmtBRL(totalLiquido) + '</td>' +
        '<td>' + fmtBRL(totalRecebido) + '</td>' +
        '<td style="color:#f59e0b;">' + fmtBRL(totalAReceber) + '</td>' +
        '</tr>';

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    } catch (e) {
      loadingEl.textContent = 'Erro ao carregar dados consolidados.';
      console.error(e);
    }
  }

  // Init
  (async function init() {
    try {
      if (typeof Financeiro !== 'undefined' && Financeiro.carregarBalanco) {
        await Financeiro.carregarBalanco();
      }
      document.getElementById('fin-loading').style.display = 'none';
      document.getElementById('fin-content').style.display = 'block';
    } catch (e) {
      document.getElementById('fin-loading').textContent = 'Erro ao carregar dados.';
    }
  })();
})();
