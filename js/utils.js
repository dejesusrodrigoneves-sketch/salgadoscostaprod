// ========== utils.js — Shared utilities ==========

// Toast notification (inline, sem dependência externa)
function toast(msg, type) {
  type = type || 'success';
  var colors = { success: '#16a34a', danger: '#dc2626', warning: '#f59e0b', info: '#3b82f6' };
  var icons = { success: 'check-circle', danger: 'times-circle', warning: 'exclamation-circle', info: 'info-circle' };
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:' + (colors[type] || colors.info) + ';color:#fff;padding:12px 18px;border-radius:10px;font-weight:500;font-size:13px;font-family:Inter,Montserrat,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.15);animation:slideInRight 0.3s;max-width:360px;display:flex;align-items:center;gap:8px;cursor:pointer;';
  el.innerHTML = (icons[type] ? '<i class="fas fa-' + icons[type] + '"></i> ' : '') + msg;
  el.onclick = function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 300); };
  document.body.appendChild(el);
  setTimeout(function () { if (el.parentNode) { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 300); } }, 4000);
}

// Confirm modal (returns Promise<boolean>)
function confirmModal(msg) {
  return new Promise(function (resolve) {
    var ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = '<div class="modal-box"><h3>Confirmação</h3><p>' + msg + '</p><div class="modal-actions"><button class="btn-modal-cancel" id="_mdCancel">Cancelar</button><button class="btn-modal-confirm" id="_mdConfirm">Confirmar</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#_mdConfirm').onclick = function () { ov.remove(); resolve(true); };
    ov.querySelector('#_mdCancel').onclick = function () { ov.remove(); resolve(false); };
    ov.addEventListener('click', function (e) { if (e.target === ov) { ov.remove(); resolve(false); } });
  });
}

// Escape HTML
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (s) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[s]; });
}

// Format currency BRL
function fmtMoeda(v) {
  if (v === undefined || v === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// Debounce utility
function debounce(fn, delay) {
  var timer;
  return function () {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
  };
}

// Blink feedback on element
function blink(el) {
  var prev = el.style.boxShadow;
  el.style.boxShadow = '0 0 0 6px rgba(249,115,22,0.4)';
  setTimeout(function () { el.style.boxShadow = prev; }, 300);
}

// Auth guard — redirect to login if not authenticated
function authGuard() {
  var u = localStorage.getItem('authUser');
  if (!u) { window.location.replace('login.html'); return false; }
  try {
    var user = JSON.parse(u);
    if (!user.username) { window.location.replace('login.html'); return false; }
    // Expiração de sessão (24h)
    if (user._expiry && Date.now() > user._expiry) {
      localStorage.removeItem('authUser');
      window.location.replace('login.html');
      return false;
    }
    // Renova expiry a cada acesso
    user._expiry = Date.now() + 86400000;
    localStorage.setItem('authUser', JSON.stringify(user));
    return true;
  } catch (e) {
    window.location.replace('login.html');
    return false;
  }
}

// Get current auth user
function getAuthUser() {
  try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
}

// Mask phone input (formata enquanto digita: (XX) XXXXX-XXXX)
function maskPhone(input) {
  input.addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 2) {
      this.value = v.length ? '(' + v : '';
    } else if (v.length <= 7) {
      this.value = '(' + v.slice(0, 2) + ') ' + v.slice(2);
    } else if (v.length <= 10) {
      this.value = '(' + v.slice(0, 2) + ') ' + v.slice(2, 6) + '-' + v.slice(6);
    } else {
      this.value = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    }
  });
}

// Mask CEP input (formata enquanto digita: XXXXX-XXX)
function maskCEP(input) {
  input.addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    this.value = v;
  });
}

// Get current date as YYYY-MM-DD
function dataHoje() { return new Date().toISOString().split('T')[0]; }