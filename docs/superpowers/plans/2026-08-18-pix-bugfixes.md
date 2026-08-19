# PIX Flow Bugfixes — E2E Test Results

## Context
E2E browser test of PIX payment flow (index.html → cart.html → admin.html) found 4 bugs.
Both test orders (#049 retirada, #050 delivery) completed successfully end-to-end.
Backend on port 3000, branch `feat/pix-asaas`, no commits.

## Global Constraints
- Do NOT commit (user directive: "sem commitar")
- Do NOT add new files or abstractions
- Do NOT refactor unrelated code
- Minimal diff — change only what's needed

## Task 1: Fix admin.html `prods.find` crash
- **File**: `admin.html`
- **Bug**: `fmtItens()` at line ~237 calls `prods.find()` but `/api/public/produtos` can return error object instead of array
- **Root cause**: No guard when `prods` is not an array
- **Fix**: Add `const prods = Array.isArray(data) ? data : [];` before the `.find()` call
- **Verify**: Reload admin.html, confirm no "Erro ao carregar pedidos" and both pedidos show

## Task 2: Fix CSP blocking Bootstrap Icons font
- **File**: `backend/src/app.js` (line 32, CSP config)
- **Bug**: `font-src` CSP directive doesn't include `cdn.jsdelivr.net`, blocking Bootstrap Icons woff2
- **Fix**: Add `'https://cdn.jsdelivr.net'` to the `fontSrc` array in helmet CSP config
- **Verify**: Reload admin.html, confirm Bootstrap Icons load (no CSP font errors in console)

## Task 3: Fix taxa PIX showing R$ 0,00 before order
- **File**: `js/cart.js`
- **Bug**: `updateValores()` doesn't correctly calculate PIX fee when payment method is PIX
- **Fix**: In `updateValores()`, calculate `taxaPix = total * (asaasPixFeePercent / 100)` and show it in `#taxaPixBox`
- **Verify**: In cart, select PIX → taxa should show non-zero value immediately

## Task 4: Fix cart values zeroing in PIX overlay
- **File**: `js/cart.js`
- **Bug**: After `generateOrder()`, cart is cleared and "Informações" section shows R$ 0,00
- **Fix**: Capture total values before clearing cart, or disable live-update of totals after order submission
- **Verify**: After generating PIX order, overlay shows correct total (not R$ 0,00)
