# Admin Overlay Mini-Cart Design

## Goal

Add a persistent mini-cart bar with full controls inside the "Adicionar Item" iframe overlay, plus a toast notification on first item add, and update the admin overlay footer to mirror the same item list.

## Architecture

The iframe (`balcao.html?embedded=1`) communicates with the parent admin page via `postMessage`. Currently, the iframe hides all cart UI in embedded mode and only sends item data on poll. This design adds:

1. **Mini-cart bar** inside the iframe (fixed footer)
2. **Toast notification** on first item add
3. **Admin footer item list** (mirrors iframe mini-cart)

## Tech Stack

- Vanilla JS (existing patterns)
- Bootstrap 5 (admin overlay footer styling)
- No new dependencies

## Files to Modify

| File | Changes |
|------|---------|
| `balcao.html` | Add `<div id="mini-cart">`, `renderMiniCart()`, toast on add, update `ITENS` message with `nome`/`preco` |
| `admin.html` | Update `onMessage()` to use `nome`/`preco`, render item list in `modal-footer` |

---

## Design Details

### 1. Mini-Cart Bar (iframe)

**When it appears:** Only in embedded mode (`?embedded=1`) AND when `carrinho.length > 0`.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🛒 2x coxinha         [−] [2] [+]    R$ 2,00     ✕        │
│    Combo Especial (sabores: coxinha, risole)  Editar Excluir│
│    1x Pepsi            [−] [1] [+]    R$ 10,00    ✕        │
├─────────────────────────────────────────────────────────────┤
│ Total: R$ 12,00                              [Fechar Pedido]│
└─────────────────────────────────────────────────────────────┘
```

**Behavior per item type:**
- **Regular (type 1):** −/+ buttons, remove (✕)
- **Combo (type 3):** Fixed quantity (1), "Editar" opens `abrirSeletorSabores()`, "Excluir" removes
- **Congelado (type 6):** Quantity = sum of flavors, "Editar" opens `abrirSeletorSabores()`, "Excluir" removes

**Position:** `position: fixed; bottom: 0; left: 0; right: 0;` inside iframe.

**Z-index:** 1000 (above product grid).

**Max-height:** 40vh with overflow-y: auto (scrollable if many items).

### 2. Toast Notification

**When it appears:** Immediately after `adicionarAoCarrinho(produto)` is called.

**Format:** `"✓ {nome} adicionado ao carrinho"`

**Examples:**
- "✓ coxinha adicionado ao carrinho"
- "✓ Pepsi adicionado ao carrinho"
- "✓ Combo Especial adicionado ao carrinho"

**Toast rule:**
- **First add:** Show toast
- **Subsequent adds** (same item): Silently increment quantity, no toast

**Implementation:** Track added items in a Set (`itensNotificados`). Only show toast if `produtoId` is not in the Set.

**Duration:** 2 seconds, then fade out.

**Position:** Top-right of iframe.

### 3. Admin Overlay Footer

**Current:**
```
[0 itens selecionados]              [Cancelar] [Salvar Alterações]
```

**New:**
```
┌─────────────────────────────────────────────────────────────┐
│ list-group-item  2x coxinha    [−] [2] [+]   R$ 2,00      │
│ list-group-item  1x Pepsi      [−] [1] [+]   R$ 10,00     │
│ list-group-item  Total: R$ 12,00                           │
├─────────────────────────────────────────────────────────────┤
│                                    [Cancelar] [Salvar]      │
└─────────────────────────────────────────────────────────────┘
```

**Styling:** Bootstrap 5 classes: `list-group`, `list-group-item`, `d-flex`, `justify-content-between`, `btn-outline-secondary`, `btn-primary`

**Data source:** Receives via `postMessage` from iframe (already implemented, just needs to render the list).

### 4. postMessage Data Flow

**Current:**
```
Admin → iframe: { type: 'SOLICITAR_ITENS' } (every 800ms)
Iframe → Admin: { type: 'ITENS', itens: [{ produtoId, quantidade, sabores }] }
```

**Updated:**
```
Iframe → Admin: {
  type: 'ITENS',
  itens: [{ produtoId, quantidade, nome, preco, sabores }]
}
```

**Why:** Admin footer needs `nome` and `preco` to render item list.

### 5. Stock Management

- **If `produto.controlaEstoque === true`:** Decrement `estoqueAtual` when item is saved (on "Salvar Alterações" click)
- **If `produto.controlaEstoque === false`:** No stock change (follows existing flow)

**Implementation:** On save, check `controlaEstoque` flag for each item, call existing `darBaixaEstoque()` logic from `orderService.js`.

---

## Edge Cases

- **Empty cart:** Mini-cart hidden, "Salvar" disabled
- **Same item clicked twice:** Quantity increments, no toast
- **Combo added:** Opens flavor selector immediately, mini-cart shows "Editar"
- **User closes iframe without saving:** No changes applied (existing behavior)
- **Stock insufficient:** Prevent adding if `estoqueAtual < quantidade` (existing behavior)

---

## Visual Mockup

### Iframe Mini-Cart
```
┌─────────────────────────────────────────────────────────────┐
│ 🛒 2x coxinha         [−] [2] [+]    R$ 2,00     ✕        │
│    1x Pepsi            [−] [1] [+]    R$ 10,00    ✕        │
├─────────────────────────────────────────────────────────────┤
│ Total: R$ 12,00                              [Fechar Pedido]│
└─────────────────────────────────────────────────────────────┘
```

### Admin Footer
```
┌─────────────────────────────────────────────────────────────┐
│  2x coxinha         [−] [2] [+]    R$ 2,00                │
│  1x Pepsi           [−] [1] [+]    R$ 10,00               │
│  Total: R$ 12,00                                            │
├─────────────────────────────────────────────────────────────┤
│                                    [Cancelar] [Salvar]      │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

1. Click product in iframe → toast appears, mini-cart shows item
2. Click same product again → no toast, quantity increments
3. Click − button → quantity decrements
4. Click + button → quantity increments
5. Click ✕ button → item removed
6. Click "Fechar Pedido" → items sent to admin overlay
7. Admin footer mirrors iframe mini-cart
8. Click "Salvar" → PATCH sent, overlay closes
9. Combo: "Editar" opens flavor selector
10. Congelado: "Editar" opens flavor selector
11. Empty cart: Mini-cart hidden, "Salvar" disabled
12. Stock: `controlaEstoque` products decrement on save
