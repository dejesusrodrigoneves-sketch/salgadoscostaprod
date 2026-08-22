# Combo Açaí Overlay — Storefront

## Global Constraints
- Same dark theme as combo salgado overlay (background #191919, text #FFFCE1, accent #F26D3D/#1FA58D)
- Bootstrap NOT loaded — use custom checkbox CSS (accent-color approach)
- `ComboConfig.separarAcai` is the single source of truth for split gratis/pagos
- cart item format açaí: `{id, qtd:1, sabores:{nome:qtd} (insertion order), extra:number}`
- `calcularPrecoAcai` already exists and is tested — reuse via `separarAcai`

## Task 1: comboConfig.js — add `separarAcai`

Add pure helper `separarAcai(config, saboresObj)` to `js/comboConfig.js`.

**Input:** `config` = combo_acai config object, `saboresObj` = `{nome: qtd}` ordered by insertion.

**Logic:**
1. Expand saboresObj into ordered unit array: for each key in Object.keys(saboresObj), repeat nome qtd times.
2. Call `calcularPrecoAcai(config, units)` → `{gratis, pagos, extra}` (arrays of names).
3. Group gratis by name → `[{nome, qtd}]` preserving first-appearance order.
4. Group pagos by name → `[{nome, qtd}]` preserving first-appearance order.
5. Return `{gratis, pagos, extra}`.

**Expose:** add `separarAcai` to the `api` object.

**Tests:** add to `tests/comboConfig.test.js`:
- Basic: 4 flavors, gratis 3 → gratis [a,b,c], pagos [d], extra = preco d
- Duplicate in both: {a:2, b:1, c:1} gratis 3 → gratis a(2),b(1); pagos c(1)
- Empty sabores → gratis [], pagos [], extra 0
- Insertion order preserved: {b:1,a:1,c:1} → gratis [b,a,c]

## Task 2: menu.js — generalize overlay for combo_acai

### 2a. Button routing (line 78)
`isComboSalgado` → `isCombo` (truthy check for any tipo). Button calls `abrirOverlayCombo(prod.id)` for both types.

### 2b. abrirOverlayCombo — guard
Accept both `combo_salgado` and `combo_acai`. Remove the tipo !== 'combo_salgado' guard. Use `tipo` variable.

### 2c. açaí overlay render
New function `montarOverlayAcai(produto, prefill)` builds:
- Shell overlay (same dark card style as salgado)
- Subtitle: `acrescimosGratis grátis · máx ${maxAcrescimos}`
- List of all `!pausado` acréscimos
- Footer with live count + extra
- Adicionar/Cancelar buttons

**Checkbox phase** (totalSelecionado < acrescimosGratis):
- Each row: custom checkbox + nome + label (gratis/+R$X)
- Checkbox: `<input type="checkbox" style="accent-color:#1FA58D">`
- Click toggles selection (1 unit per click)
- When totalSelecionado reaches acrescimosGratis → re-render to stepper

**Stepper phase** (totalSelecionado >= acrescimosGratis):
- Each row: nome + `- qty +` + paid badge
- Paid badge: `+R$ X` where X = preco × paidUnitsInRow (orange)
- Free badge: `grátis` (green)
- Can increment/decrement any flavor

**Live total:** `Selecionados: N · Acréscimos: +R$ X`

### 2d. confirmarOverlayCombo — açaí branch
- Validate ≥1 selected
- Build saboresObj from comboSelecao (ordered keys)
- Compute extra via `ComboConfig.separarAcai(cfg, saboresObj).extra`
- Save `{id, qtd:1, sabores: saboresObj, extra}` to localStorage cart

### 2e. Edit prefill
`abrirOverlayCombo(produtoId, prefill)` — optional prefill object. Used by cart edit.

## Task 3: cart.js — combo_acai render + price + edit

### 3a. calculaValorItens (line 124-142)
Add `+ (Number(prod.extra) || 0)` after the price calculation branch.

### 3b. precoItem display (line 223-228)
After computing precoItem, add `precoItem += Number(prod.extra) || 0;`

### 3c. sabores render (line 248-272)
Add `combo_acai` branch using `ComboConfig.separarAcai`:
- Block "Grátis": list flavors with green label
- Block "Extras": list flavors with orange label + individual price
- Same flavor in both → shown separately (not concatenated)
- "+R$ X (acréscimos)" line

### 3d. abrirModalSabores (line 420)
açaí branch → delegate to `abrirOverlayCombo(pacote.id, prefill)` with store-open check bypassed for edits.

### 3e. itensFormatados (line 826-831)
Non-numeric key fallback: if productsMap lookup fails and key is not numeric, use key as name.

### 3f. valorItens payload (line 840-845)
Add `+ (Number(prod.extra) || 0)` in the else branch.

## Task 4: tests — run existing + new

- Run `npx vitest run --root .. tests/comboConfig.test.js` from backend/
- All separarAcai tests pass
- All existing calcularPrecoAcai tests pass (no regressions)
