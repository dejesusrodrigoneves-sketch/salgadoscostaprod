/* ═══════════════════════════════════════════════
   theme.js — Per-company theming engine
   Injects CSS custom properties from API settings
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  var DEFAULT_THEME = {
    primaryColor: '#F26D3D',
    backgroundColor: '#FFFAF8',
    surfaceColor: '#FFFFFF',
    textColor: '#2D1A12',
    textMuted: '#7C7C7C',
    successColor: '#4CAF50',
    warningColor: '#F59E0B',
    dangerColor: '#DC2626',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    isDark: false,
    borderRadius: '16px',
    borderRadiusSm: '8px',
    borderRadiusLg: '24px',
  };

  function applyTheme(t) {
    if (!t) t = {};
    var root = document.documentElement;
    function set(prop, val, fallback) {
      root.style.setProperty(prop, val || fallback);
    }
    set('--primary',       t.primaryColor,     DEFAULT_THEME.primaryColor);
    set('--primary-hover', t.primaryColor       ? adjustBrightness(t.primaryColor, -15) : '#E05A2A');
    set('--primary-bg',    t.primaryColor       ? adjustBrightness(t.primaryColor, 92)  : '#FFF0EA');
    set('--secondary',     t.backgroundColor,   DEFAULT_THEME.backgroundColor);
    set('--surface',       t.surfaceColor,      DEFAULT_THEME.surfaceColor);
    set('--text',          t.textColor,         DEFAULT_THEME.textColor);
    set('--text-muted',    t.textMuted,         DEFAULT_THEME.textMuted);
    set('--success',       t.successColor,      DEFAULT_THEME.successColor);
    set('--warning',       t.warningColor,      DEFAULT_THEME.warningColor);
    set('--danger',        t.dangerColor,       DEFAULT_THEME.dangerColor);
    set('--font',          t.fontFamily,        DEFAULT_THEME.fontFamily);
    set('--radius',        t.borderRadius,      DEFAULT_THEME.borderRadius);
    set('--radius-sm',     t.borderRadiusSm,    DEFAULT_THEME.borderRadiusSm);
    set('--radius-lg',     t.borderRadiusLg,    DEFAULT_THEME.borderRadiusLg);

    if (t.isDark) {
      set('--secondary', '#0E100F');
      set('--surface',   '#191919');
      set('--text',      '#FFFCE1');
      set('--text-muted','#7C7C6F');
      set('--danger-bg',  '#3D1A1A');
      set('--warning-bg', '#3D2E0A');
      set('--success-bg', '#0A3D1A');
    }
  }

  function adjustBrightness(hex, percent) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var num = parseInt(hex, 16);
    var r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + percent));
    var g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + percent));
    var b = Math.min(255, Math.max(0, (num & 0xFF) + percent));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function loadThemeFromAPI() {
    var url;
    var headers = {};

    // Detect context: admin (authed) vs public (slug) vs neither
    var authUser;
    try { authUser = JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) {}

    if (authUser && authUser.token) {
      // Admin page — use authenticated endpoint
      url = '/api/loja/settings-admin';
      headers['Authorization'] = 'Bearer ' + authUser.token;
    } else {
      // Public page — detect slug from URL or sessionStorage
      var slug = '';
      try {
        var p = new URLSearchParams(window.location.search);
        slug = (p.get('slug') || '').trim().toLowerCase();
        if (!slug) slug = (sessionStorage.getItem('sic_ia_slug') || '').trim();
      } catch (e) {}
      if (!slug) {
        // No context (login page) — apply dark default theme
        applyTheme(Object.assign({}, DEFAULT_THEME, { isDark: true }));
        return;
      }
      url = '/api/loja/settings?slug=' + encodeURIComponent(slug);
    }

    fetch(url, { headers: headers })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load theme');
        return res.json();
      })
      .then(function (data) {
        var t = data.themeSettings || {};
        applyTheme(t);
        try { localStorage.setItem('themeCache', JSON.stringify({ theme: t, time: Date.now() })); } catch (e) {}
      })
      .catch(function () {
        // Fallback: try cache, then dark default
        try {
          var cached = JSON.parse(localStorage.getItem('themeCache'));
          if (cached && cached.theme && (Date.now() - cached.time < 300000)) {
            applyTheme(cached.theme);
            return;
          }
        } catch (e) {}
        applyTheme(Object.assign({}, DEFAULT_THEME, { isDark: true }));
      });
  }

  function init() {
    loadThemeFromAPI();
  }

  // Expose globally for the theme editor
  window.applyTheme = applyTheme;
  window.DEFAULT_THEME = DEFAULT_THEME;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
