// js/pages/404-subscription.js — extracted from 404-subscription.html inline script
(function () {
  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');

  if (slug) {
    fetch((window.getApiBase ? window.getApiBase() : '') + '/api/public/empresa/' + slug + '/contact')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var phone = data.telefone || data.supportWhatsApp;
        if (phone) {
          var clean = phone.replace(/\D/g, '');
          document.getElementById('whatsappLink').href = 'https://wa.me/55' + clean;
          document.getElementById('companyName').textContent = data.nome || '';
        }
      })
      .catch(function () {});
  }
})();
