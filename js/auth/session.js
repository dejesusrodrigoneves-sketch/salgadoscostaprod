// js/auth/session.js — dono único da sessão (carregado só pelo shell)
(function () {
  var REFRESH_LEEWAY_MS = 60 * 1000;
  var PROACTIVE_MIN_MS = 5000;
  var _refreshPromise = null;
  var _proTimer = null;

  function decodeJwtExp(token) {
    try {
      var payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var obj = JSON.parse(atob(payload));
      return obj.exp ? obj.exp * 1000 : null;
    } catch (e) { return null; }
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  }
  function setUser(u) { localStorage.setItem('authUser', JSON.stringify(u)); }

  // Alinha _expiry ao exp real do JWT (corrige o agora+30min fixo do login)
  function syncExpiry() {
    var u = getUser();
    if (!u || !u.token) return;
    var exp = decodeJwtExp(u.token);
    if (exp && u._expiry !== exp) { u._expiry = exp; setUser(u); }
  }

  // Single-flight: 1 request de refresh por vez; callers concorrentes aguardam o mesmo promise
  function refreshOnce() {
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async function () {
      var u = getUser();
      if (!u || !u.refreshToken) throw new Error('sem refresh token');
      var base = (typeof getApiBase === 'function') ? getApiBase() : '';
      var r = await fetch(base + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: u.refreshToken })
      });
      if (!r.ok) throw new Error('refresh falhou: ' + r.status);
      var d = await r.json();
      u.token = d.token;
      u.refreshToken = d.refreshToken;
      u._expiry = decodeJwtExp(d.token) || (Date.now() + 29 * 60 * 1000);
      setUser(u);
      scheduleProactive();
      return u.token;
    })();
    var clear = function () { _refreshPromise = null; };
    _refreshPromise.then(clear, clear);
    return _refreshPromise;
  }

  // Proativo: roda 60s antes de _expiry
  function scheduleProactive() {
    clearTimeout(_proTimer);
    var u = getUser();
    if (!u || !u.token || !u._expiry) return;
    var delay = u._expiry - Date.now() - REFRESH_LEEWAY_MS;
    if (delay < PROACTIVE_MIN_MS) delay = PROACTIVE_MIN_MS;
    _proTimer = setTimeout(function () {
      refreshOnce().catch(function () { window.hardLogout('refresh-failed'); });
    }, delay);
  }

  // Reativo: fetch com token; 401 → refresh → retry 1x; falhou → hardLogout
  async function authFetch(url, opts) {
    opts = opts || {};
    var u = getUser();
    if (u && u.token && u._expiry && Date.now() > u._expiry - 3000) {
      try { await refreshOnce(); } catch (e) { window.hardLogout('refresh-failed'); throw e; }
    }
    var headers = new Headers(opts.headers || {});
    var tok = (getUser() || {}).token;
    if (tok && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + tok);
    var r = await fetch(url, Object.assign({}, opts, { headers: headers }));
    if (r.status !== 401) return r;
    try { await refreshOnce(); } catch (e) { window.hardLogout('refresh-failed'); throw e; }
    var headers2 = new Headers(opts.headers || {});
    var tok2 = (getUser() || {}).token;
    if (tok2) headers2.set('Authorization', 'Bearer ' + tok2);
    return fetch(url, Object.assign({}, opts, { headers: headers2 }));
  }

  window.authFetch = authFetch;
  window.sessionManager = {
    refreshOnce: refreshOnce,
    scheduleProactive: scheduleProactive,
    syncExpiry: syncExpiry,
    decodeJwtExp: decodeJwtExp,
    getUser: getUser
  };

  // Boot do shell
  syncExpiry();
  scheduleProactive();
})();
