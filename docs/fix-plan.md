# Fix Remaining Hardcoded /api Paths — Implementation Plan

**Goal:** Eliminate all hardcoded /api paths in frontend JS and HTML so every request goes through getApiBase() to Railway backend.

**Architecture:** All API calls must use getApiBase() (js/config.js) which returns Railway URL on prod. Helper api() functions must prepend it. Direct fetch() calls must also use it.

## Error Inventory

| # | File | Line | Bug | Impact |
|---|---|---|---|---|
| E1 | js/financeiro.js | 15 | api() does fetch(path) without getApiBase() | Central Financeira 404 after deploy |
| E2 | js/integracoes.js | 10 | api() does fetch(path) without getApiBase() | Integracoes 404 after deploy |
| E3 | js/theme.js | 77,92 | Hardcoded /api/loja/settings-admin and /api/loja/settings | Theme 404 after deploy |
| E4 | js/cart.js | 786,976 | Hardcoded /api/proxy/geoapify and /api/payment/status | Cart 404 after deploy |
| E5 | 16 HTML files | various | config.js without ?v=N cache bust | Stale config.js in browser |
| E6 | admin-sicia.vercel.app | — | Domain not mapped in Vercel | Superadmin inaccessible |
| E7 | img/IMG-20250821-WA0028.jpg | — | Image 404 on loja page | Missing asset |

## Tasks

### Task 1: Fix js/financeiro.js
- Modify line 15: fetch(path, { → fetch((window.getApiBase ? window.getApiBase() : '') + path, {
- Verify: grep -n "fetch(path" js/financeiro.js

### Task 2: Fix js/integracoes.js
- Modify line 10: fetch(path, { → fetch((window.getApiBase ? window.getApiBase() : '') + path, {
- Verify: grep -n "fetch(path" js/integracoes.js

### Task 3: Fix js/theme.js
- Line 77: url = '/api/loja/settings-admin' → url = (window.getApiBase ? window.getApiBase() : '') + '/api/loja/settings-admin'
- Line 92: url = '/api/loja/settings?slug=...' → url = (window.getApiBase ? window.getApiBase() : '') + '/api/loja/settings?slug=...'
- Verify: grep -n "'/api" js/theme.js → 0 results

### Task 4: Fix js/cart.js
- Line 786: /api/proxy/geoapify → (window.getApiBase ? window.getApiBase() : '') + '/api/proxy/geoapify'
- Line 976: EventSource("/api/payment/status/...") → EventSource((window.getApiBase ? window.getApiBase() : '') + "/api/payment/status/...")
- Verify: grep -n "'/api" js/cart.js → 0 results

### Task 5: Cache-bust config.js in 16 HTML files
- sed -i 's|src="js/config.js"|src="js/config.js?v=2"|g' *.html
- Verify: grep -c 'config.js?v=2' *.html → all 16 show 1

### Task 6: Full verification
- grep -rn "'/api" js/*.js *.html | grep -v getApiBase → 0 results
- Local smoke test with vite

## Remaining Issues (outside scope)
- admin-sicia.vercel.app not mapped (Vercel dashboard)
- img/IMG-20250821-WA0028.jpg missing
- favicon.png missing
- superadmin.html loads for non-superadmin (403 errors)
