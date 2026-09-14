// js/config.js — base da API em runtime.
// '' => same-origin (Vercel /api, fallback durante a migração).
// Corte: definir SIC_API_BASE = 'https://<svc>.up.railway.app'.
window.SIC_API_BASE = window.SIC_API_BASE || '';

window.getApiBase = function () {
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
  return window.SIC_API_BASE || '';
};
