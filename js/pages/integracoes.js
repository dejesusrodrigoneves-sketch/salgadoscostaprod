// js/pages/integracoes.js — extracted from integracoes.html inline script
(function () {
  document.addEventListener('DOMContentLoaded', async function () {
    try {
      await Integracoes.carregar();
      document.getElementById('integ-loading').style.display = 'none';
    } catch (e) {
      document.getElementById('integ-loading').textContent = 'Erro ao carregar integrações.';
    }
  });
})();
