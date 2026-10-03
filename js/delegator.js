// js/delegator.js — shared data-action click delegator
// Replaces inline onclick= handlers across all pages
(function () {
  function dispatch(e, attr) {
    var el = e.target.closest('[' + attr + ']');
    if (!el) return;
    var fn = el.getAttribute(attr);
    if (typeof window[fn] === 'function') {
      window[fn](el.dataset);
    } else {
      console.warn('[delegator] missing action:', fn, el);
    }
  }
  document.addEventListener('click', function (e) { dispatch(e, 'data-action'); });
  document.addEventListener('change', function (e) { dispatch(e, 'data-action-change'); });
})();
