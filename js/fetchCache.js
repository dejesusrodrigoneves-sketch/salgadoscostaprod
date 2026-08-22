(function() {
  'use strict';
  var PREFIX = 'fc:';
  var DEFAULT_TTL = 60000;

  function fetchCached(url, options, ttl) {
    ttl = ttl || DEFAULT_TTL;
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET') return fetch(url, options);
    var key = PREFIX + url;
    try {
      var cached = localStorage.getItem(key);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.ts && (Date.now() - parsed.ts) < ttl) {
          return Promise.resolve(new Response(JSON.stringify(parsed.data), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          }));
        }
      }
    } catch (e) {}
    return fetch(url, options).then(function(res) {
      if (res.ok) {
        var clone = res.clone();
        clone.json().then(function(data) {
          try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
        }).catch(function() {});
      }
      return res;
    });
  }
  function invalidateCached(url) {
    try { localStorage.removeItem(PREFIX + url); } catch (e) {}
  }
  window.fetchCached = fetchCached;
  window.invalidateCached = invalidateCached;
})();
