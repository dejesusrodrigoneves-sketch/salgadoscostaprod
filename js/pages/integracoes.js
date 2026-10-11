// js/pages/integracoes.js — módulo SPA (receita Task6)
const HTML_INTEGRACOES = `<body>
  <div id="integ-loading" class="integ-loading">Carregando integrações...</div>
  <div id="integ-lista" class="integ-grid"></div>

</body>
`;
let _abort = null;
const _cleanups = [];

const STYLE_INTEGRACOES = `
  #pageContainer { font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text); padding: 24px; }
  .integ-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .integ-card { background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
  .integ-card strong { font-size: 16px; }
  .integ-card span { font-size: 14px; color: var(--text-muted, #64748b); }
  .integ-card small { font-size: 12px; color: var(--text-muted, #94a3b8); }
  .integ-card button { margin-top: 8px; padding: 8px 16px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; }
  .integ-card button[data-platform] { background: #3b82f6; color: #fff; }
  .integ-card button[data-platform]:hover { background: #2563eb; }
  .integ-card button:disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; }
  .integ-loading { text-align: center; padding: 40px; color: var(--text-muted, #64748b); }

/* ===== HT — Integrações (únicos) ===== */
  .integ-grid { background: transparent; }
  .integ-card { background: var(--ht-spice) !important; border: none !important; border-radius: 6px !important; box-shadow: none !important; color: var(--ht-fg) !important; }
  .integ-card span, .integ-card small { color: var(--ht-fg-muted) !important; }
  .integ-card button[data-platform] { background: var(--ht-gold) !important; color: var(--ht-clove) !important; }
  .integ-card button[data-platform]:hover { filter: brightness(1.06); }
  .integ-card button:disabled { background: var(--ht-cardamom) !important; color: var(--ht-fg-dim) !important; }
  .integ-loading { color: var(--ht-fg-muted) !important; }
`;

export async function mount(container, params) {
  unmount();
  _abort = new AbortController();
  await loadScriptOnce('js/integracoes.js');
  container.innerHTML = HTML_INTEGRACOES;
  if (STYLE_INTEGRACOES) {
    const s = document.createElement('style');
    s.dataset.page = 'integracoes';
    s.textContent = STYLE_INTEGRACOES;
    document.head.appendChild(s);
    _cleanups.push(function () { s.remove(); });
  }
  (function () {
  (async function () {
    var loadingEl = document.getElementById('integ-loading');
    try {
      await Integracoes.carregar();
      if (loadingEl) loadingEl.style.display = 'none';
    } catch (e) {
      if (loadingEl) loadingEl.textContent = 'Erro ao carregar integrações.';
    }
  })();
  })();
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
