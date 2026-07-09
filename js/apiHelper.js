// ========== apiHelper.js — Public REST API client ==========
// Substitui chamadas Firebase no frontend público (menu, carrinho)

var PUBLIC_API = (function () {
  var base = '/api/public';

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
