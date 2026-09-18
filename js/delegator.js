// js/delegator.js — shared data-action click delegator
// Replaces inline onclick= handlers across all pages
(function () {
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = el.getAttribute('data-action');
    if (typeof window[fn] === 'function') window[fn](el.dataset);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-action-change]');
    if (!el) return;
    var fn = el.getAttribute('data-action-change');
    if (typeof window[fn] === 'function') window[fn](el.dataset);
  });
})();
