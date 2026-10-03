// ========== utils.js — Shared utilities ==========

// Toast notification (inline, sem dependência externa)
function toast(msg, type, duration) {
  type = type || 'success';
  duration = duration !== undefined ? duration : 4000;
  var colors = { success: '#16a34a', danger: '#dc2626', warning: '#f59e0b', info: '#3b82f6' };
  var icons = { success: 'check-circle', danger: 'times-circle', warning: 'exclamation-circle', info: 'info-circle' };
  var el = document.createElement('div');
  el.id = '_toast_' + Date.now();
  el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:' + (colors[type] || colors.info) + ';color:#fff;padding:12px 18px;border-radius:10px;font-weight:500;font-size:13px;font-family:Inter,Montserrat,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.15);animation:slideInRight 0.3s;max-width:360px;display:flex;align-items:center;gap:8px;cursor:pointer;';
  el.innerHTML = (icons[type] ? '<i class="fas fa-' + icons[type] + '"></i> ' : '') + escapeHtml(msg);
  el.onclick = function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 300); };
  document.body.appendChild(el);
  if (duration > 0) {
    setTimeout(function () { if (el.parentNode) { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 300); } }, duration);
  }
  return el;
}

// Confirm modal (returns Promise<boolean>)
function confirmModal(msg) {
  return new Promise(function (resolve) {
    var ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = '<div class="modal-box"><h3>Confirmação</h3><p>' + escapeHtml(msg) + '</p><div class="modal-actions"><button class="btn-modal-cancel" id="_mdCancel">Cancelar</button><button class="btn-modal-confirm" id="_mdConfirm">Confirmar</button></div></div>';
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
function authGuard(requiredRoles) {
  var u = localStorage.getItem('authUser');
  if (!u) { window.location.replace('login.html'); return false; }
  try {
    var user = JSON.parse(u);
    if (!user.username) { window.location.replace('login.html'); return false; }
    // Expiração de sessão (30 min)
    if (user._expiry && Date.now() > user._expiry) {
      hardLogout('expiry');
      return false;
    }
    if (requiredRoles) {
      var allowed = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (user.role !== 'superadmin' && allowed.indexOf(user.role) === -1) {
        window.location.replace('login.html');
        return false;
      }
    }
    return true;
  } catch (e) {
    window.location.replace('login.html');
    return false;
  }
}

// Session validation helper (returns boolean, redirects if invalid)
window.checkSessionValid = function() {
  try {
    var raw = localStorage.getItem('authUser');
    if (!raw) return false;
    var data = JSON.parse(raw);
    if (!data || !data.token) return false;
    if (data._expiry && Date.now() > data._expiry) {
      hardLogout('expiry');
      return false;
    }
    return true;
  } catch (e) {
    hardLogout('storage-corrupt');
    return false;
  }
};

// ========== Sessão: wipe + hard logout ==========
// Chaves de sessão removidas no logout. cart/userLogged/clientToken_* preservados.
var SESSION_KEYS = ['authUser', 'entregador_token', 'entregador_refresh', 'entregador_expiry'];

// Limpeza total de cookies do navegador (inclui não-httpOnly) + chaves de sessão.
// Cookies httpOnly são limpos pelo backend em /api/auth/wipe-cookies (hardLogout passo 2).
function wipeBrowserStorage() {
  try {
    if (typeof document !== 'undefined' && typeof document.cookie === 'string') {
      var paths = ['/'];
      try { if (location && location.pathname) paths.push(location.pathname); } catch (e) { /* sem location */ }
      for (var pass = 0; pass < 8; pass++) {
        var names = document.cookie
          .split(';')
          .map(function (c) { return (c.split('=')[0] || '').trim(); })
          .filter(Boolean);
        if (!names.length) break;
        names.forEach(function (n) {
          paths.forEach(function (p) {
            document.cookie = n + '=; max-age=0; path=' + p;
            try { document.cookie = n + '=; max-age=0; path=' + p + '; domain=' + location.hostname; } catch (e) { /* sem domain */ }
          });
        });
      }
    }
  } catch (e) { /* segue */ }
  try {
    SESSION_KEYS.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) { /* segue */ }
}
window.wipeBrowserStorage = wipeBrowserStorage;

// Hard logout — CONTRATO (ordem obrigatória):
//   1) POST /api/auth/logout       → revoke token + refreshToken ANTES de qualquer limpeza
//   2) POST /api/auth/wipe-cookies → limpa cookies httpOnly no servidor
//   3) wipeBrowserStorage()        → limpa cookies restantes + chaves de sessão
//   4) redirect → login.html
var _hardLogoutRunning = false;
function hardLogout(reason) {
  if (_hardLogoutRunning) return;
  _hardLogoutRunning = true;

  var au = null;
  try { au = JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { au = null; }

  var base = '';
  try {
    base = (typeof window.getApiBase === 'function') ? window.getApiBase() : (window.getApiBase || '');
  } catch (e) { base = ''; }

  // 1. revoke no backend ANTES de limpar dados locais (best-effort)
  var step1;
  try {
    step1 = fetch(base + '/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ((au && au.token) || '') },
      body: JSON.stringify({ refreshToken: (au && au.refreshToken) || '' })
    }).catch(function () {});
  } catch (e) { step1 = Promise.resolve(); }

  // 2. limpa cookies httpOnly via backend (best-effort)
  step1
    .then(function () {
      try { return fetch(base + '/api/auth/wipe-cookies', { method: 'POST' }).catch(function () {}); }
      catch (e) { return Promise.resolve(); }
    })
    .then(function () {
      // 3. cookies não-httpOnly + chaves de sessão
      wipeBrowserStorage();
      // 4. redirect
      try { window.location.href = 'login.html'; } catch (e) { /* segue */ }
    });
}
window.hardLogout = hardLogout;

// ========== Idle timeout: hard logout após 30 min de inatividade ==========
var _idleTimer = null;
var _idleStarted = false;
var IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

window.startIdleTimer = function() {
  if (_idleStarted) return; // proteção contra múltiplas inicializações
  _idleStarted = true;

  // Override de timeout (testes: window.__IDLE_TIMEOUT_MS)
  var timeout = IDLE_TIMEOUT;
  try {
    if (typeof window.__IDLE_TIMEOUT_MS === 'number' && window.__IDLE_TIMEOUT_MS > 0) {
      timeout = window.__IDLE_TIMEOUT_MS;
    }
  } catch (e) { /* segue com 30 min */ }

  function resetTimer() {
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(function() {
      hardLogout('idle');
    }, timeout);
  }
  ['mousedown','mousemove','keydown','scroll','touchstart'].forEach(function(evt) {
    document.addEventListener(evt, resetTimer, { passive: true });
  });
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      if (typeof checkSessionValid === 'function') checkSessionValid();
      resetTimer();
    }
  });
  resetTimer();
};
window.IDLE_TIMEOUT = IDLE_TIMEOUT;

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
// Safe token reader — authUser JSON only (never localStorage.token)
function safeGetToken() {
  try {
    var u = JSON.parse(localStorage.getItem('authUser') || '{}');
    return (u && u.token) || '';
  } catch (e) {
    return '';
  }
}
if (typeof window !== 'undefined') window.safeGetToken = safeGetToken;
