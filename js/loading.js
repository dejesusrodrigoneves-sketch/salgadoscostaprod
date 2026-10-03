// js/loading.js — Global loading overlay (sistema interno)
(function () {
  'use strict';

  var count = 0;
  var safetyTimer = null;
  var SAFETY_TIMEOUT = 30000;

  function getDoc() {
    return (typeof document !== 'undefined') ? document : null;
  }

  function render() {
    var doc = getDoc();
    if (!doc || !doc.body) return;
    var overlay = doc.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-busy', 'true');
    overlay.innerHTML =
      '<div class="loading-dots">' +
        '<div class="loading-dot"></div>' +
        '<div class="loading-dot"></div>' +
        '<div class="loading-dot"></div>' +
      '</div>' +
      '<span class="loading-label">Carregando...</span>';
    doc.body.appendChild(overlay);
  }

  function remove() {
    var doc = getDoc();
    if (!doc) return;
    var el = doc.getElementById('loadingOverlay');
    if (el && el.remove) el.remove();
  }

  function show() {
    if (count === 0) {
      render();
      safetyTimer = setTimeout(function () {
        if (typeof console !== 'undefined') {
          console.warn('[loading] timeout de seguranca (30s) - forcando hide');
        }
        forceHide();
      }, SAFETY_TIMEOUT);
    }
    count++;
  }

  function hide() {
    count = Math.max(0, count - 1);
    if (count === 0) {
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
      remove();
    }
  }

  function forceHide() {
    count = 0;
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    remove();
  }

  var api = { show: show, hide: hide, forceHide: forceHide, _getCount: function () { return count; } };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof window !== 'undefined') {
    window.showLoading = show;
    window.hideLoading = hide;
  }
})();
