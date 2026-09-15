// js/config.js — base da API em runtime.
// '' => same-origin (Vercel /api, fallback durante a migração).
// Corte: definir SIC_API_BASE = 'https://<svc>.up.railway.app' (sem barra final).
function _stripTrailingSlash(u) {
  return (u || '').replace(/\/+$/, '');
}

window.SIC_API_BASE = _stripTrailingSlash(
  window.SIC_API_BASE || 'https://backend-sicia-production.up.railway.app'
);

window.getApiBase = function () {
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
  return _stripTrailingSlash(window.SIC_API_BASE) || '';
};
