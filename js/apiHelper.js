// ========== apiHelper.js — Public REST API client ==========
// Substitui chamadas Firebase no frontend público (menu, carrinho)

var PUBLIC_API = (function () {
  var base = '/api/public';

  function storeSlug() {
    return document.body.getAttribute('data-slug') || 'salgadoscosta';
  }

  function getToken() {
    return localStorage.getItem('clientToken');
  }

  function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(base + path, {
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
    // ---- Produtos ----
    listarProdutos: function (slug) {
      return request('GET', '/produtos?slug=' + encodeURIComponent(slug || storeSlug()));
    },
    listarCategorias: function (slug) {
      return request('GET', '/categorias?slug=' + encodeURIComponent(slug || storeSlug()));
    },

    // ---- Loja ----
    lojaStatus: function (slug) {
      return request('GET', '/loja/status?slug=' + encodeURIComponent(slug || storeSlug()));
    },
    lojaSettings: function (slug) {
      return request('GET', '/loja/settings?slug=' + encodeURIComponent(slug || storeSlug()));
    },

    // ---- Clientes ----
    register: function (data) {
      return request('POST', '/clientes/register', data);
    },
    login: function (data) {
      return request('POST', '/clientes/login', data);
    },
    me: function () {
      return request('GET', '/clientes/me');
    },
    updateMe: function (data) {
      return request('PUT', '/clientes/me', data);
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
