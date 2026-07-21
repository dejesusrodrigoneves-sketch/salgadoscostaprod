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
    fetch('/api/loja/settings')
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
        // Fallback: try cache
        try {
          var cached = JSON.parse(localStorage.getItem('themeCache'));
          if (cached && cached.theme && (Date.now() - cached.time < 300000)) {
            applyTheme(cached.theme);
          }
        } catch (e) {}
      });
  }

  // Auto-detect: always load theme from single store
  function init() {
    loadThemeFromAPI();
    var cached = JSON.parse(localStorage.getItem('themeCache'));
    if (!cached || !cached.theme) {
      try {
        var auth = JSON.parse(localStorage.getItem('authUser'));
        if (auth && auth.token) loadThemeFromAPI();
      } catch (e) {
        try {
          cached = JSON.parse(localStorage.getItem('themeCache'));
          if (cached && cached.theme) applyTheme(cached.theme);
        } catch (e2) {}
      }
    }
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
