// js/comboConfig.js
(function (root) {
  var TIPOS = ['combo_salgado', 'combo_acai'];

  function tipoDe(config) {
    if (config && TIPOS.indexOf(config.tipo) !== -1) return config.tipo;
    return null;
  }

  function calcularPrecoAcai(config, escolhidos) {
    var lista = Array.isArray(escolhidos) ? escolhidos : [];
    var gratis = lista.slice(0, config.acrescimosGratis);
    var pagos = lista.slice(config.acrescimosGratis);
    var extra = pagos.reduce(function (soma, nome) {
      var op = (config.acrescimos || []).find(function (a) { return a.nome === nome; });
      return soma + (op ? Number(op.preco) || 0 : 0);
    }, 0);
    return { extra: Number(extra.toFixed(2)), gratis: gratis, pagos: pagos };
  }

  function calcularPrecoSalgado() {
    return 0;
  }

  function validarConfig(tipo, cfg) {
    if (tipo === 'combo_salgado') {
      if (!cfg || !Number.isFinite(cfg.unidades) || Number(cfg.unidades) < 1) return { ok: false, erro: 'unidades deve ser >= 1' };
      return { ok: true };
    }
    if (tipo === 'combo_acai') {
      var g = Number(cfg && cfg.acrescimosGratis) || 0;
      var m = Number(cfg && cfg.maxAcrescimos) || 0;
      if (m < g) return { ok: false, erro: 'maxAcrescimos deve ser >= acrescimosGratis' };
      var opcoes = (cfg && cfg.acrescimos) || [];
      for (var i = 0; i < opcoes.length; i++) {
        var nome = String(opcoes[i].nome || '').trim();
        var preco = Number(opcoes[i].preco);
        if (!nome) return { ok: false, erro: 'acrescimo com nome vazio' };
        if (isNaN(preco) || preco < 0) return { ok: false, erro: 'preco negativo/invalido: ' + nome };
      }
      return { ok: true };
    }
    return { ok: false, erro: 'tipo invalido' };
  }

  var api = { tipoDe: tipoDe, calcularPrecoAcai: calcularPrecoAcai, calcularPrecoSalgado: calcularPrecoSalgado, validarConfig: validarConfig };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ComboConfig = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Explicit CommonJS export for Node.js/vitest
if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).ComboConfig;
}