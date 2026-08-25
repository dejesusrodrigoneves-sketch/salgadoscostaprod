# Fix Login, Theme 404 & Role-Based Auth Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs: login.html TypeError, only-superadmin login, theme.js 404, themes not loading.

**Architecture:** 3 surgical fixes — (1) dead code removal in login.html, (2) authService.login fallback to find any user when no tenant context, (3) theme.js context-aware endpoint selection (authed vs public-with-slug).

**Tech Stack:** Vanilla JS frontend, Express.js/CJS backend, Prisma ORM, vitest.

## Global Constraints

- Branch: `main`. **No commits until user approves.**
- Backend port 3000; Vite 5173.
- Login creds: `djesus`/`tsa110594` (superadmin).
- Test suite: 79 tests, 14 files. Run via `cd backend && npx vitest run`.
- `backend/src/config/prisma.js` exports client directly.
- Backend module system: mixed CJS/ESM. `empresaCache.js`, `resolveEmpresa.js` are ESM; most files CJS.
- Skill tool fails: `'powershell.exe' is not recognized`. Read skill files directly.

---

## Root Cause Analysis

### Bug 1: login.html:114 TypeError
**Cause:** `registerForm` HTML was removed ("Register disabled in single-tenant mode" — line 44) but JS still binds at line 112: `document.getElementById('registerForm').addEventListener(...)`. Returns null → TypeError.

### Bug 2: Only superadmin can login
**Cause:** `authService.login()` (line 18-29): when `empresaId` is falsy (localhost — no `?slug=`, no subdomain), the `else` branch (line 27) ONLY calls `buscarUsuarioSuperadmin(username)`. Admin/user accounts are never found.

**Flow:** login.html → POST /api/auth/login → `authController.login` passes `req.ctx?.empresaId` (undefined on localhost) → `authService.login(username, password, undefined)` → only searches superadmin → 401 for non-superadmin.

### Bug 3: theme.js 404 on /api/loja/settings
**Cause:** `theme.js` line 69 fetches `/api/loja/settings` (public endpoint). `lojaController.settingsPublic` (line 16-21) requires `empId` from `empresaId(req)`. On localhost without slug, `empId` is undefined → returns 404.

**Flow:** theme.js → fetch `/api/loja/settings` → resolveEmpresa (no slug on localhost → next()) → settingsPublic → `empresaId(req)` = undefined → `if (!empId) return res.status(404)` → 404.

### Bug 4: Themes not loading
**Cause:** Direct consequence of Bug 3. theme.js catch block falls back to localStorage cache (which may be empty on first load) → no theme applied.

---

## Task 1: Fix login.html dead register code

**Files:**
- Modify: `login.html:54-59, 111-161`

**Interfaces:**
- Consumes: nothing (standalone fix)
- Produces: login.html loads without console errors

- [ ] **Step 1: Remove dead switchTab reference to boxRegister**

`login.html` line 54-59 currently references `boxRegister` which doesn't exist. Replace the entire `switchTab` function with a no-op or remove it (no tabs exist in the UI anymore).

OLD (login.html:54-59):
```javascript
function switchTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-box').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tab === 'login' ? 'boxLogin' : 'boxRegister').classList.add('active');
  document.getElementById('loginError').classList.remove('show');
}
```

NEW:
```javascript
function switchTab() { /* no-op: register disabled */ }
```

- [ ] **Step 2: Remove dead register JS block**

Remove lines 111-161 entirely (the `// ========== REGISTER ==========` block that binds to non-existent `registerForm`).

- [ ] **Step 3: Verify no console errors**

Open `http://localhost:5173/login.html` in browser. Console should show zero errors related to login.html.

- [ ] **Step 4: Verify login still works**

Enter `djesus` / `tsa110594` → should login and redirect to dashboard.html.

---

## Task 2: Fix authService.login for non-superadmin users on localhost

**Files:**
- Modify: `backend/src/services/authService.js:18-29`
- Test: manual curl verification (no unit test — vi.mock × CJS)

**Interfaces:**
- Consumes: `sql.buscarUsuario(username, empresaId)`, `sql.buscarUsuarioSuperadmin(username)` (existing)
- Produces: login succeeds for any role when empresaId is absent; token contains correct empresaId from DB

- [ ] **Step 1: Fix login fallback when empresaId is absent**

The `else` branch (empresaId falsy) should first try `buscarUsuario(username, undefined)` which calls `prisma.usuario.findFirst({ where: { username } })` — finds ANY user. Only if not found, fallback to superadmin search.

OLD (authService.js:18-29):
```javascript
  let user;
  if (empresaId) {
    // Admin/user em {slug}.sua-app.com
    user = await sql.buscarUsuario(username, empresaId);
    if (!user) {
      // Fallback: superadmin pode acessar qualquer empresa
      user = await sql.buscarUsuarioSuperadmin(username);
    }
  } else {
    // Superadmin em admin.sua-app.com
    user = await sql.buscarUsuarioSuperadmin(username);
  }
```

NEW:
```javascript
  let user;
  if (empresaId) {
    // Admin/user em {slug}.sua-app.com
    user = await sql.buscarUsuario(username, empresaId);
    if (!user) {
      // Fallback: superadmin pode acessar qualquer empresa
      user = await sql.buscarUsuarioSuperadmin(username);
    }
  } else {
    // Sem tenant context (localhost/testes): busca qualquer usuário
    user = await sql.buscarUsuario(username, undefined);
    if (!user) {
      user = await sql.buscarUsuarioSuperadmin(username);
    }
  }
```

**Rationale:** `buscarUsuario(username, undefined)` calls `findFirst({ where: { username } })` — finds any user by username across all empresas. Token payload includes their `empresaId` from DB, so all subsequent API calls are properly scoped. Superadmin remains as fallback for backward compat.

- [ ] **Step 2: Verify existing tests pass**

Run: `cd backend && npx vitest run 2>&1 | tail -4`
Expected: 79 passed (no regressions)

- [ ] **Step 3: Verify login via curl**

```bash
# Start server
cd backend && node server.js &
sleep 3

# Test superadmin login (should still work)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"djesus","password":"tsa110594"}' | head -c 100

# Test admin login (was failing before fix)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin-e2e","password":"senha123"}' | head -c 100

# Kill server
kill %1 2>/dev/null
```

Expected: Both return `{token: "...", user: {...}}` with 200 status. Admin token contains `empresaId: 2`.

---

## Task 3: Fix theme.js to use correct endpoint

**Files:**
- Modify: `js/theme.js:67-88`

**Interfaces:**
- Consumes: `localStorage.authUser` (token), `sessionStorage.sic_ia_slug` (slug), URL `?slug=` param
- Produces: theme loads correctly on all page types (public, admin, login)

- [ ] **Step 1: Rewrite loadThemeFromAPI to be context-aware**

The function must choose the right endpoint:
- **Admin pages** (has `authUser.token`): use `/api/loja/settings-admin` with Bearer header
- **Public pages** (has slug in URL or sessionStorage): use `/api/loja/settings?slug=<slug>`
- **Neither** (login page, no context): skip fetch, use cached theme or defaults

OLD (theme.js:67-88):
```javascript
  function loadThemeFromAPI() {
    var _fetch = (typeof fetchCached === 'function') ? fetchCached : fetch;
    _fetch('/api/loja/settings', {}, 300000)
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
```

NEW:
```javascript
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
      // Public page — detect slug
      var slug = '';
      try {
        var p = new URLSearchParams(window.location.search);
        slug = (p.get('slug') || '').trim().toLowerCase();
        if (!slug) slug = (sessionStorage.getItem('sic_ia_slug') || '').trim();
      } catch (e) {}
      if (!slug) {
        // No context (login page) — use cache or defaults, skip fetch
        try {
          var cached = JSON.parse(localStorage.getItem('themeCache'));
          if (cached && cached.theme) applyTheme(cached.theme);
        } catch (e) {}
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
        // Fallback: try cache
        try {
          var cached = JSON.parse(localStorage.getItem('themeCache'));
          if (cached && cached.theme && (Date.now() - cached.time < 300000)) {
            applyTheme(cached.theme);
          }
        } catch (e) {}
      });
  }
```

- [ ] **Step 2: Verify no JS parse errors**

```bash
node -e "const s=require('fs').readFileSync('js/theme.js','utf8'); new Function(s); console.log('JS_OK')"
```
Expected: `JS_OK`

- [ ] **Step 3: Verify theme loads on each page type**

1. **Public page:** Open `http://localhost:5173/?slug=empresa-e2e` → theme should apply (orange/white colors). No 404 in console.
2. **Admin page:** Login as `djesus`/`tsa110594` → dashboard.html → theme should apply. No 404.
3. **Login page:** Open `http://localhost:5173/login.html` → no 404 in console (theme loads from cache or defaults silently).

- [ ] **Step 4: Verify full test suite**

Run: `cd backend && npx vitest run 2>&1 | tail -4`
Expected: 79 passed (no regressions — this is a frontend-only change)

---

## Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| `login.html` | Remove dead register JS + switchTab | ~55 lines removed |
| `backend/src/services/authService.js` | Fix login else-branch to find any user | 2 lines changed |
| `js/theme.js` | Context-aware endpoint selection | ~25 lines rewritten |

**No new files. No new dependencies. No database changes.**

## Verification Checklist

- [ ] login.html loads with zero console errors
- [ ] Superadmin login works (djesus/tsa110594)
- [ ] Admin login works (admin-e2e/senha123)
- [ ] User login works (any user with role=user)
- [ ] Theme loads on public pages (?slug=empresa-e2e)
- [ ] Theme loads on admin pages (dashboard.html after login)
- [ ] No 404 for /api/loja/settings in console
- [ ] 79/79 tests pass
