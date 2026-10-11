// js/router.js — hash routing + lazy load + guards + lifecycle (carregado só pelo shell)
(function () {
  var container = document.getElementById('pageContainer');
  var loader = document.getElementById('pageLoader');
  var defaultRoute = 'admin';

  var routes = {
    'admin':                   function () { return import('./pages/admin.js'); },
    'balcao':                  function () { return import('./pages/balcao.js'); },
    'caixa':                   function () { return import('./pages/caixa.js'); },
    'relatorios':              function () { return import('./pages/relatorios.js'); },
    'relatorios-entregadores': function () { return import('./pages/relatorios-entregadores.js'); },
    'financeiro':              function () { return import('./pages/financeiro-page.js'); },
    'pagamentos':              function () { return import('./pages/pagamentos.js'); },
    'entregador':              function () { return import('./pages/entregador.js'); },
    'painelLoja':              function () { return import('./pages/painelLoja.js'); },
    'filiais':                 function () { return import('./pages/filiais.js'); },
    'whatsapp':                function () { return import('./pages/whatsapp.js'); },
    'integracoes':             function () { return import('./pages/integracoes.js'); },
    'alterar-senha':           function () { return import('./pages/alterar-senha.js'); },
    'superadmin':              function () { return import('./pages/superadmin.js'); }
  };

  var current = null; // { route, mod, cleanup }
  var navSeq = 0; // serializa navegações — montagem órfã é descartada

  function parseHash() {
    var h = window.location.hash || '';
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.charAt(0) === '/') h = h.slice(1);
    var qi = h.indexOf('?');
    var path = (qi >= 0 ? h.slice(0, qi) : h);
    var query = qi >= 0 ? h.slice(qi + 1) : '';
    var params = {};
    query.split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { route: path || defaultForRole(), params: params };
  }

  function defaultForRole() {
    try {
      var u = JSON.parse(localStorage.getItem('authUser') || 'null');
      if (u && u.role === 'superadmin') return 'superadmin';
    } catch (e) {}
    return defaultRoute;
  }

  function guard(route) {
    var u = null;
    try { u = JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) {}
    if (!u || !u.token) { window.location.replace('login.html'); return false; }
    if (route === 'superadmin' && u.role !== 'superadmin') {
      window.location.hash = '#/admin';
      return false;
    }
    return true;
  }

  async function navigate(route, params) {
    if (!routes[route]) { window.location.replace(location.pathname + '#/' + defaultRoute); return; }
    if (!guard(route)) return;
    if (current && current.route === route && container.firstChild) return;

    var seq = ++navSeq;
    if (loader) loader.classList.remove('hidden');
    try {
      // 1. unmount do módulo anterior
      if (current && current.mod) {
        if (typeof current.mod.unmount === 'function') { try { current.mod.unmount(); } catch (e) { console.error('[router] unmount', e); } }
        else if (typeof current.cleanup === 'function') { try { current.cleanup(); } catch (e) { console.error('[router] cleanup', e); } }
      }
      offPage();
      container.innerHTML = '';
      // scroll da área de conteúdo volta ao topo em cada navegação
      var sc = container.parentNode;
      if (sc && sc.scrollTop) sc.scrollTop = 0;

      // 2. lazy load
      var mod = await routes[route]();
      if (seq !== navSeq) return; // navegação mais nova assumiu

      // 3. mount
      var cleanup = await mod.mount(container, params || {});
      if (seq !== navSeq) {
        // mount ficou órfão (outra navegação assumiu) — desfaz efeitos
        if (typeof mod.unmount === 'function') { try { mod.unmount(); } catch (e) {} }
        else if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} }
        return;
      }
      current = { route: route, mod: mod, cleanup: typeof cleanup === 'function' ? cleanup : null };

      // 4. hash + evento
      var want = '#/' + route;
      if (window.location.hash !== want) {
        window.removeEventListener('hashchange', onHash);
        window.location.hash = want;
        window.addEventListener('hashchange', onHash);
      }
      document.dispatchEvent(new CustomEvent('page:change', { detail: { route: route } }));
    } catch (e) {
      console.error('[router] falha ao montar', route, e);
      if (typeof toast === 'function') toast('Erro ao carregar a tela.', 'error');
    } finally {
      if (seq === navSeq && loader) loader.classList.add('hidden');
    }
  }

  function onHash() {
    var p = parseHash();
    if (!current || current.route !== p.route) navigate(p.route, p.params);
  }

  // Monta um módulo num container arbitrário (overlay do admin) — lifecycle próprio
  async function mountInto(el, route, params) {
    if (!routes[route]) throw new Error('rota inexistente: ' + route);
    var mod = await routes[route]();
    var cleanup = await mod.mount(el, params || {});
    return function () {
      if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} }
      if (typeof mod.unmount === 'function') { try { mod.unmount(); } catch (e) {} }
      el.innerHTML = '';
    };
  }

  window.router = { navigate: navigate, mountInto: mountInto };

  window.addEventListener('hashchange', onHash);
  var boot = parseHash();
  navigate(boot.route, boot.params);
})();
