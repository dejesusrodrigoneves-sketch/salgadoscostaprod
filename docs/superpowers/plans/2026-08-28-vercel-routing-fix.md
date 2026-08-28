# Vercel Routing Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Vercel routing so `login-sicia.vercel.app` serves `login.html`, tenant subdomains serve `index.html` (cardápio), and all CSS/JS/static assets load correctly.

**Architecture:** Reorder `vercel.json` routes: API first → host-based routing (login) → static assets → clean URLs → SPA fallback.

**Tech Stack:** Vercel routing config only (1 file change).

## Global Constraints

- Single file change: `vercel.json`
- No code changes to HTML/JS/CSS
- Must preserve API routing to `backend/api.js`
- Must preserve static asset serving

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `vercel.json` | Fix route order + host-based routing |

---

### Task 1: Fix vercel.json Route Order

**Files:**
- Modify: `vercel.json:13-21` (routes section)

**Interfaces:**
- Consumes: existing API routes, static files, login.html, index.html

- [ ] **Step 1: Replace routes section**

Replace the entire `"routes"` array in `vercel.json` with the corrected order:

```json
{
  "version": 2,
  "framework": null,
  "builds": [
    { "src": "backend/api.js", "use": "@vercel/node" },
    { "src": "*.html", "use": "@vercel/static" },
    { "src": "js/**/*.js", "use": "@vercel/static" },
    { "src": "css/**/*.{css,scss}", "use": "@vercel/static" },
    { "src": "img/**/*", "use": "@vercel/static" },
    { "src": "public/**/*", "use": "@vercel/static" },
    { "src": "view/**/*", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "backend/api.js" },
    { "src": "/health", "dest": "backend/api.js" },
    { "src": "/(.*)", "dest": "/login.html", "headers": { "host": "login-sicia.vercel.app" } },
    { "src": "/(.*)", "dest": "/superadmin.html", "headers": { "host": "admin-sicia.vercel.app" } },
    { "src": "/(.*\\.(?:css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot))$", "dest": "/$1" },
    { "src": "/([^/.]+)$", "dest": "/$1.html" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

**Route order explanation:**

| Priority | Route | Purpose |
|----------|-------|---------|
| 1 | `/api/*` → `backend/api.js` | API endpoints |
| 2 | `/health` → `backend/api.js` | Health check |
| 3 | `login-sicia.vercel.app/*` → `/login.html` | Login page (host-based) |
| 4 | `admin-sicia.vercel.app/*` → `/superadmin.html` | Superadmin page (host-based) |
| 5 | `*.{css,js,...}` → `/$1` | Static assets (explicit extension) |
| 6 | `/([^/.]+)$` → `/$1.html` | Clean URLs (`/about` → `/about.html`) |
| 7 | `/(.*)` → `/index.html` | SPA fallback (last resort) |

---

### Task 2: Verify

- [ ] **Step 1: Test locally with vercel dev**

```bash
npx vercel dev
```

Test URLs:
- `http://localhost:3000/` → should serve `index.html` (cardápio)
- `http://localhost:3000/css/tokens.css` → should serve CSS file
- `http://localhost:3000/js/app.js` → should serve JS file
- `http://localhost:3000/login.html` → should serve login page

- [ ] **Step 2: Deploy to Vercel**

```bash
npx vercel --prod
```

- [ ] **Step 3: Test production URLs**

- `https://login-sicia.vercel.app/` → should serve `login.html`
- `https://login-sicia.vercel.app/css/tokens.css` → should serve CSS
- `https://salgadoscosta.vercel.app/` → should serve `index.html` (cardápio)
- `https://salgadoscosta.vercel.app/css/tokens.css` → should serve CSS
- `https://salgadoscosta.vercel.app/js/app.js` → should serve JS
