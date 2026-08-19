(function (root) {
  function totalSelecionado(sabores) {
    return Object.values(sabores || {}).reduce(function (s, q) { return s + (Number(q) || 0); }, 0);
  }
  function podeIncrementar(sabores, unidades) {
    return totalSelecionado(sabores) < Number(unidades);
  }
  var api = { totalSelecionado: totalSelecionado, podeIncrementar: podeIncrementar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ComboLimite = api;
})(typeof window !== 'undefined' ? window : globalThis);
