// js/pages/index-actions.js — bridge functions for index.html onclick → data-action
window.abrirPedidosNavAction = function () {
  event.preventDefault();
  if (typeof abrirPedidosNav === 'function') abrirPedidosNav();
};

window.fecharOverlayPedidosAction = function () {
  if (typeof fecharOverlayPedidos === 'function') fecharOverlayPedidos();
};

// These functions are expected to be defined in other JS files (menu.js, etc.)
// If not defined yet, they will be called when the scripts load
