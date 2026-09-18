// js/pages/painelLoja.js — extracted from painelLoja.html inline scripts
(function () {
  if (!authGuard()) throw new Error('Redirect');
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!_au.role || !['admin', 'superadmin'].includes(_au.role)) { window.location.href = 'dashboard.html'; }

  // Task 8: Filial — tema pendente de aprovação
  var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (authUser.empresaTipo !== 'filial') return;

  var alertEl = document.getElementById('themePendingAlert');
  var colorsEl = document.getElementById('themePendingColors');
  var saveBtn = document.getElementById('btnSalvarTema');

  async function checkPendingTheme() {
    try {
      var token = localStorage.getItem('token');
      var empresaId = authUser.empresaId || authUser.id;
      var res = await fetch((window.getApiBase ? window.getApiBase() : '') + '/api/admin/empresas/' + empresaId, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      var data = await res.json();
      var empresa = data.empresa || data;

      if (empresa.pendingThemeSettings) {
        var pending = typeof empresa.pendingThemeSettings === 'string'
          ? JSON.parse(empresa.pendingThemeSettings)
          : empresa.pendingThemeSettings;

        alertEl.style.display = 'flex';

        colorsEl.innerHTML = '';
        var labels = { primary: 'Primária', background: 'Fundo', surface: 'Superfície', text: 'Texto' };
        Object.entries(labels).forEach(function (entry) {
          var key = entry[0], label = entry[1];
          if (pending[key]) {
            var chip = document.createElement('div');
            chip.style.cssText = 'display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.7);border:1px solid #FDE68A;border-radius:8px;padding:4px 10px 4px 6px;font-size:11px;color:#92400E;';
            chip.innerHTML = '<div style="width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,0.1);background:' + pending[key] + ';"></div>' + label;
            colorsEl.appendChild(chip);
          }
        });

        if (saveBtn) {
          saveBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar para Aprovação';
        }
      } else {
        alertEl.style.display = 'none';
        if (saveBtn) {
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Personalização';
        }
      }
    } catch (e) {
      console.error('Erro ao verificar tema pendente:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    checkPendingTheme();

    var observer = new MutationObserver(function () {
      var personalizacaoView = document.getElementById('view-personalizacao');
      if (personalizacaoView && !personalizacaoView.classList.contains('hidden')) {
        checkPendingTheme();
      }
    });
    var personalizacaoView = document.getElementById('view-personalizacao');
    if (personalizacaoView) {
      observer.observe(personalizacaoView, { attributes: true, attributeFilter: ['class'] });
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', async function (e) {
      if (authUser.empresaTipo !== 'filial') return;

      e.preventDefault();
      e.stopPropagation();

      var themeSettings = {
        primary: document.getElementById('themePrimary') ? document.getElementById('themePrimary').value : null,
        background: document.getElementById('themeBackground') ? document.getElementById('themeBackground').value : null,
        surface: document.getElementById('themeSurface') ? document.getElementById('themeSurface').value : null,
        text: document.getElementById('themeText') ? document.getElementById('themeText').value : null,
        isDark: document.getElementById('themeIsDark') ? document.getElementById('themeIsDark').checked : false
      };

      try {
        var token = localStorage.getItem('token');
        var empresaId = authUser.empresaId || authUser.id;
        var res = await fetch((window.getApiBase ? window.getApiBase() : '') + '/api/admin/empresas/' + empresaId + '/theme/pending', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ pendingThemeSettings: themeSettings })
        });

        if (res.ok) {
          alert('Tema enviado para aprovação da matriz!');
          checkPendingTheme();
        } else {
          var err = await res.json();
          alert('Erro: ' + (err.error || 'Não foi possível enviar tema'));
        }
      } catch (err) {
        alert('Erro de conexão ao enviar tema');
      }
    }, true);
  }
})();

// Bridge functions for painel.js onclick → data-action
window.adicionarLinhaSaborAction = function () {
  if (typeof adicionarLinhaSabor === 'function') adicionarLinhaSabor();
};

window.adicionarLinhaAcrescimoAction = function () {
  if (typeof adicionarLinhaAcrescimo === 'function') adicionarLinhaAcrescimo();
};
