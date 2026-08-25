// ========== apiHelper.js — Public REST API client ==========
// Substitui chamadas Firebase no frontend público (menu, carrinho)

var PUBLIC_API = (function () {
  var base = '/api/public';

  // Persiste ?slug= em sessionStorage p/ navegação entre páginas (cart.html etc)
  try {
    var _p = new URLSearchParams(window.location.search);
    var _qs = _p.get('slug');
    if (_qs && _qs.trim()) sessionStorage.setItem('sic_ia_slug', _qs.trim().toLowerCase());
  } catch (e) { /* sessionStorage indisponível — segue */ }

  function getSlug() {
    var p = new URLSearchParams(window.location.search);
    var qs = p.get('slug');
    if (qs) return qs.trim().toLowerCase();
    var host = window.location.hostname;
    var labels = host.split('.');
    if (labels.length >= 3) {
      var first = labels[0];
      if (!/^\d+$/.test(first) && ['www', 'api', 'admin', 'mail', 'ftp'].indexOf(first) === -1) {
        return first.toLowerCase();
      }
    }
    try {
      var stored = sessionStorage.getItem('sic_ia_slug');
      if (stored && stored.trim()) return stored.trim().toLowerCase();
    } catch (e) {}
    return '';
  }

  function getToken() {
    var slug = getSlug();
    return localStorage.getItem('clientToken_' + slug);
  }

  function setToken(token) {
    var slug = getSlug();
    localStorage.setItem('clientToken_' + slug, token);
  }

  function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var url = base + path;
    var slug = getSlug();
    if (slug) url += (path.indexOf('?') === -1 ? '?' : '&') + 'slug=' + encodeURIComponent(slug);
    return fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) { throw new Error(err.error || 'Erro na requisição'); });
      }
      return res.json();
    });
  }

  return {
    // ---- Token (helpers p/ outros scripts: menu.js, cart.js) ----
    getToken: getToken,
    setToken: setToken,
    clearToken: function () {
      var slug = getSlug();
      localStorage.removeItem('clientToken_' + slug);
    },

    // ---- Produtos ----
    listarProdutos: function () {
      return request('GET', '/produtos');
    },
    listarCategorias: function () {
      return request('GET', '/categorias');
    },

    // ---- Loja ----
    lojaStatus: function () {
      return request('GET', '/loja/status');
    },
    lojaSettings: function () {
      return request('GET', '/loja/settings');
    },

    // ---- Clientes ----
    register: function (data) {
      return request('POST', '/clientes/register', data).then(function (r) { if (r.token) setToken(r.token); return r; });
    },
    login: function (data) {
      return request('POST', '/clientes/login', data).then(function (r) { if (r.token) setToken(r.token); return r; });
    },
    me: function () {
      return request('GET', '/clientes/me');
    },
    updateMe: function (data) {
      return request('PUT', '/clientes/me', data);
    },
    deleteMe: function () {
      return request('DELETE', '/clientes/me');
    },
    revogarConsentimento: function () {
      return request('POST', '/clientes/consent/revogar', {});
    },

    // ---- Pedidos ----
    meusPedidos: function () {
      return request('GET', '/pedidos');
    },
    criarPedido: function (data) {
      return request('POST', '/pedidos', data);
    },
    criarPedidoAutenticado: function (data) {
      return request('POST', '/pedidos', data);
    },
    buscarPedido: function (id) {
      return request('GET', '/pedidos/' + encodeURIComponent(id));
    },

    // ---- Cupons ----
    validarCupom: function (codigo) {
      return request('GET', '/cupons/' + encodeURIComponent(codigo));
    },
  };
})();
