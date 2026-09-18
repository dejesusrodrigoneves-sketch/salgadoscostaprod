// js/pages/cart-actions.js — bridge functions for view/cart.html onclick → data-action
window.fecharOverlayBairroAction = function () {
  if (typeof fecharOverlayBairro === 'function') fecharOverlayBairro();
};

window.fecharOverlayAction = function () {
  if (typeof fecharOverlay === 'function') fecharOverlay();
};

window.copiarPixAction = function () {
  if (typeof copiarPix === 'function') copiarPix();
};

window.fecharPixAction = function () {
  if (typeof fecharPix === 'function') fecharPix();
};
