# Fix Cart — Itens não aparecem no cart.html

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o carrinho em `view/cart.html` exibir itens adicionados no `index.html`.

**Architecture:** O fluxo é: `index.html` → `menu.js` adiciona item ao `localStorage.cart` → usuário clica "Ver carrinho" → `view/cart.html` → `cart.js` lê `localStorage.cart` → busca detalhes em `window.products` → renderiza. O bug é que `view/cart.html` não carrega `config.js`, então `getApiBase` é `undefined`, requests vão pro Vercel (que retorna HTML via catch-all), `PUBLIC_API.listarProdutos()` falha, `window.products` fica vazio, e `renderizaItens()` encontra zero correspondências.

**Tech Stack:** Vanilla JS, localStorage, Vercel static hosting, Railway backend

## Root Cause Chain

```
view/cart.html não carrega config.js
  → window.getApiBase = undefined
  → apiHelper.js: base = '' + '/api/public' = '/api/public'
  → fetch('/api/public/produtos') → salgadoscosta.vercel.app/api/public/produtos
  → Vercel catch-all route returns index.html (HTML)
  → SyntaxError: Unexpected token '<'
  → window.products = []
  → renderizaItens() finds no matching products → cart empty
```

## Error Inventory

| # | File | Bug | Fix |
|---|---|---|---|
| E1 | `view/cart.html` | Não carrega `config.js` → `getApiBase` undefined | Adicionar `<script src="../js/config.js?v=2"></script>` |
| E2 | `view/cart.html` | `config.js?v=2` via path relativo `../js/` | Funciona porque `view/` é subdiretório de root |
| E3 | `js/cart.js:786,976` | Hardcoded `/api/proxy/geoapify` e `/api/payment/status` (JÁ FIXADO NA T4 anterior) | Já corrigido |
| E4 | Persistência | `localStorage.cart` persiste entre reloads | Comportamento padrão — NÃO é bug |

## Sobre a persistência

`localStorage` é armazenamento persistente por design. Itens no carrinho permanecem entre:
- Reload da página
- Fechar e reabrir o browser
- Navegar entre páginas

Isso é **comportamento esperado** de e-commerce. Para limpar: o usuário pode usar "Limpar Carrinho" ou finalizar o pedido.

---

### Task 1: Adicionar `config.js` em `view/cart.html`

**Files:**
- Modify: `view/cart.html:127-133`

**Interfaces:**
- Consumes: `js/config.js` (define `window.getApiBase`, `window.SIC_API_BASE`)
- Produzes: `getApiBase()` retorna Railway URL em prod

- [ ] **Step 1: Read current script tags in cart.html**

```bash
sed -n '125,135p' view/cart.html
```

Current code:
```html
  <script src="https://code.iconify.design/2/2.2.1/iconify.min.js"></script>
  <script src="../js/utils.js"></script>
  <script src="../js/apiHelper.js"></script>

  <script src="../js/comboConfig.js"></script>
  <script src="../js/comboLimite.js"></script>
  <script src="../js/cart.js?=17"></script>
```

Note: `config.js` is MISSING. `apiHelper.js` loads before `config.js` would define `getApiBase`.

- [ ] **Step 2: Add config.js BEFORE apiHelper.js**

Insert `<script src="../js/config.js?v=2"></script>` before `utils.js`:

```html
  <script src="https://code.iconify.design/2/2.2.1/iconify.min.js"></script>
  <script src="../js/config.js?v=2"></script>
  <script src="../js/utils.js"></script>
  <script src="../js/apiHelper.js"></script>
```

- [ ] **Step 3: Verify config.js loads before apiHelper.js**

```bash
grep -n "config.js\|apiHelper.js" view/cart.html
```

Expected: `config.js?v=2` appears BEFORE `apiHelper.js`

- [ ] **Step 4: Verify getApiBase is defined after load**

Open `http://localhost:5173/view/cart.html?slug=salgadoscosta` in browser, check console:

```js
console.log(window.getApiBase());
```

Expected: `https://backend-sicia-production.up.railway.app`

---

### Task 2: Verify cart renders items

**Files:** None (verification only)

- [ ] **Step 1: Add test item via index.html**

1. Open `http://localhost:5173/?slug=salgadoscosta`
2. Click "+" on any product (e.g., Pepsi)
3. Verify cart badge shows "1 item"

- [ ] **Step 2: Navigate to cart.html**

Click "Ver carrinho" or navigate to `http://localhost:5173/view/cart.html?slug=salgadoscosta`

Expected:
- "Itens escolhidos" shows the product name, image, price
- "Valor final" shows correct total
- "Total" shows correct total

- [ ] **Step 3: Verify localStorage persists**

```js
// In browser console on cart.html:
JSON.parse(localStorage.getItem('cart'))
```

Expected: `[{"id":7,"qtd":1}]` (or whichever product was added)

- [ ] **Step 4: Verify products loaded**

```js
// In browser console on cart.html:
window.products.length
```

Expected: > 0 (products loaded from API)

---

### Task 3: Verify on prod (post-deploy)

- [ ] **Step 1: Deploy to Vercel**

Push `view/cart.html` with `config.js?v=2` added.

- [ ] **Step 2: Test on salgadoscosta.vercel.app**

1. Open `https://salgadoscosta.vercel.app/?slug=salgadoscosta`
2. Add item to cart
3. Click "Ver carrinho"
4. Verify items appear in cart.html

- [ ] **Step 3: Verify API calls go to Railway**

Open DevTools Network tab, filter by `backend-sicia`:
- Expected: `GET https://backend-sicia-production.up.railway.app/api/public/produtos` → 200

---

## Summary

| Fix | Arquivo | Mudança |
|---|---|---|
| Adicionar config.js | `view/cart.html` | +1 linha: `<script src="../js/config.js?v=2"></script>` |

**1 arquivo. 1 linha. Fix mínimo.**

## NOTA: Sobre persistência

A persistência de itens no carrinho via `localStorage` é **comportamento padrão de e-commerce** — NÃO é bug. Itens permanecem entre reloads, fechamento do browser, e navegação entre páginas. Para implementar "limpar ao fechar", seria necessário código adicional (ex: `sessionStorage` em vez de `localStorage`, ou listener de `beforeunload`). Isso está fora do escopo deste fix.
