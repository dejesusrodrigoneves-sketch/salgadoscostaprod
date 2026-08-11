# Admin Overlay Mini-Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent mini-cart bar with full controls inside the "Adicionar Item" iframe overlay, plus toast notification on first item add, and update admin overlay footer to mirror item list.

**Architecture:** The iframe (`balcao.html?embedded=1`) communicates with parent admin page via `postMessage`. Currently, iframe hides all cart UI in embedded mode and only sends item data on poll. This plan adds mini-cart bar inside iframe, toast notification, and admin footer item list.

**Tech Stack:** Vanilla JS (existing patterns), Bootstrap 5 (admin overlay footer styling), no new dependencies.

## Global Constraints

- No commits until explicit approval
- All changes must be backward compatible
- Preserve existing API contracts
- Follow existing code patterns (vanilla JS, CommonJS backend)
- Test with existing data (no migrations required)

---

### Task 1: Add Mini-Cart Bar in balcao.html

**Files:**
- Modify: `balcao.html:478-499` (embedded mode section)
- Modify: `balcao.html:501-531` (`adicionarAoCarrinho` function)
- Modify: `balcao.html:368-439` (`renderizarCarrinho` function)

**Interfaces:**
- Consumes: `carrinho` array, `isEmbedded` flag
- Produces: `<div id="mini-cart">` DOM element, `renderMiniCart()` function

- [ ] **Step 1: Add mini-cart container in embedded mode**

```javascript
// balcao.html - replace embedded mode section (lines 478-499)
// ===== MODO EMBEDDED (overlay admin) =====
const isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1';
if (isEmbedded) {
  // Esconde todo o checkout (retirada/delivery, formulário, resumo, finalizar)
  const elCheckout = document.querySelector('.checkout');
  if (elCheckout) elCheckout.style.display = 'none';

  // Cria mini-cart container
  const miniCart = document.createElement('div');
  miniCart.id = 'mini-cart';
  miniCart.style.display = 'none';
  document.body.appendChild(miniCart);

  // Toast notification tracking
  const itensNotificados = new Set();

  window.addEventListener('message', function(e) {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === 'SOLICITAR_ITENS') {
      const itens = carrinho.map(function(item) {
        return {
          produtoId: item.id,
          quantidade: item.qtd,
          nome: item.nome,
          preco: item.preco,
          sabores: formatarSabores(item.sabores),
        };
      });
      e.source.postMessage({ type: 'ITENS', itens: itens }, e.origin);
    }
  });
}
```

- [ ] **Step 2: Add renderMiniCart function**

```javascript
// balcao.html - add after embedded mode section
function renderMiniCart() {
  if (!isEmbedded) return;
  const miniCart = document.getElementById('mini-cart');
  if (!miniCart) return;

  if (carrinho.length === 0) {
    miniCart.style.display = 'none';
    return;
  }

  miniCart.style.display = 'block';
  let total = 0;

  let html = '<div class="mini-cart-items">';
  carrinho.forEach((item, index) => {
    total += item.preco * item.qtd;

    if (item.type === 3 || item.type === 6) {
      // Combo/Congelado: fixed quantity, Editar/Excluir
      const saboresText = item.sabores && item.sabores.length > 0
        ? item.sabores.map(s => typeof s === 'string' ? s : `${s.nome} (${s.qtd})`).join(', ')
        : '';
      html += `
        <div class="mini-cart-item">
          <div class="nome">
            ${item.nome}
            ${saboresText ? `<div class="sabores">${saboresText}</div>` : ''}
          </div>
          <div class="controles">
            <span class="qtd">1</span>
            <button class="btn-mini" onclick="editarSabores(${index})">Editar</button>
            <button class="btn-mini btn-remove" onclick="removerItemMini(${index})">Excluir</button>
          </div>
          <div class="preco">R$ ${(item.preco * item.qtd).toFixed(2)}</div>
        </div>`;
    } else {
      // Regular: −/+ buttons, remove
      html += `
        <div class="mini-cart-item">
          <div class="nome">${item.nome}</div>
          <div class="controles">
            <button class="btn-mini" onclick="diminuirQtdMini(${index})">−</button>
            <span class="qtd">${item.qtd}</span>
            <button class="btn-mini" onclick="aumentarQtdMini(${index})">+</button>
          </div>
          <div class="preco">R$ ${(item.preco * item.qtd).toFixed(2)}</div>
          <button class="btn-mini btn-remove" onclick="removerItemMini(${index})">✕</button>
        </div>`;
    }
  });
  html += '</div>';

  html += `
    <div class="mini-cart-total">
      <span>Total: R$ ${total.toFixed(2)}</span>
      <button class="btn-fechar" onclick="fecharPedido()">Fechar Pedido</button>
    </div>`;

  miniCart.innerHTML = html;
}
```

- [ ] **Step 3: Add mini-cart control functions**

```javascript
// balcao.html - add after renderMiniCart function
function aumentarQtdMini(index) {
  carrinho[index].qtd++;
  renderMiniCart();
}

function diminuirQtdMini(index) {
  carrinho[index].qtd--;
  if (carrinho[index].qtd <= 0) {
    carrinho.splice(index, 1);
  }
  renderMiniCart();
}

function removerItemMini(index) {
  carrinho.splice(index, 1);
  renderMiniCart();
}

function fecharPedido() {
  // Send final items to parent
  const itens = carrinho.map(function(item) {
    return {
      produtoId: item.id,
      quantidade: item.qtd,
      nome: item.nome,
      preco: item.preco,
      sabores: formatarSabores(item.sabores),
    };
  });
  window.parent.postMessage({ type: 'ITENS', itens: itens }, window.location.origin);
}
```

- [ ] **Step 4: Update adicionarAoCarrinho to call renderMiniCart and toast**

```javascript
// balcao.html - update adicionarAoCarrinho function (lines 501-531)
function adicionarAoCarrinho(produto) {
  // Caso avulso
  if (produto.id == 209) {
    abrirSeletorAvulso(produto);
    return;
  }

  const existente = carrinho.find(p => p.id === produto.id);
  if (existente) {
    existente.qtd++;
    renderizarCarrinho();
    renderMiniCart();
    return;
  }

  carrinho.push({
    id: produto.id,
    nome: produto.name || produto.nome || "Produto",
    preco: Number(produto.price),
    qtd: produto.type === 3 ? 1 : produto.type === 6 ? 0 : produto.quantidadeTotal || 1,
    type: produto.type,
    sabores: []
  });

  const index = carrinho.length - 1;
  renderizarCarrinho();
  renderMiniCart();

  // Toast notification (only first time)
  if (isEmbedded && !itensNotificados.has(produto.id)) {
    itensNotificados.add(produto.id);
    toast('✓ ' + (produto.name || produto.nome) + ' adicionado ao carrinho', 'success');
  }

  // Se for combo ou congelado → abre seletor normal
  if (produto.type === 3 || produto.type === 6) {
    abrirSeletorSabores(index);
  }
}
```

- [ ] **Step 5: Update renderizarCarrinho to call renderMiniCart**

```javascript
// balcao.html - update renderizarCarrinho function (line 361 and 438)
// Add renderMiniCart() call at end of renderizarCarrinho function
function renderizarCarrinho() {
  // ... existing code ...
  calcularTotalFinal();
  renderMiniCart(); // Add this line
}
```

- [ ] **Step 6: Add mini-cart CSS**

```html
<!-- balcao.html - add in <head> section -->
<style>
/* Mini-Cart (embedded mode) */
#mini-cart {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1a1a2e;
  color: #fff;
  padding: 12px 16px;
  z-index: 1000;
  border-top: 2px solid #f26d3d;
  max-height: 40vh;
  overflow-y: auto;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.mini-cart-items {
  max-height: 30vh;
  overflow-y: auto;
}
.mini-cart-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  gap: 12px;
}
.mini-cart-item .nome {
  flex: 1;
  font-size: 14px;
  min-width: 0;
}
.mini-cart-item .nome .sabores {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}
.mini-cart-item .controles {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mini-cart-item .qtd {
  font-weight: 600;
  min-width: 24px;
  text-align: center;
}
.mini-cart-item .preco {
  font-weight: 600;
  min-width: 80px;
  text-align: right;
}
.btn-mini {
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}
.btn-mini:hover {
  background: rgba(255,255,255,0.2);
}
.btn-mini.btn-remove {
  color: #ef4444;
}
.mini-cart-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0 0;
  font-weight: 700;
  font-size: 16px;
  border-top: 1px solid rgba(255,255,255,0.2);
  margin-top: 8px;
}
.btn-fechar {
  background: #16a34a;
  border: none;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}
.btn-fechar:hover {
  background: #15803d;
}
</style>
```

- [ ] **Step 7: Run test to verify mini-cart works**

```bash
# Start server and open admin.html
node backend/server.js
# Open http://localhost:3000/admin.html
# Click "Adicionar Item" on a production card
# Click a product in iframe
# Verify: toast appears, mini-cart shows item with +/- buttons
```

---

### Task 2: Update Admin Overlay Footer

**Files:**
- Modify: `admin.html:755-875` (`abrirOverlayAdicionar` function)

**Interfaces:**
- Consumes: `novosItens` array from `postMessage`
- Produces: Updated `modal-footer` with item list

- [ ] **Step 1: Update onMessage to use nome/preco**

```javascript
// admin.html - update onMessage function (lines 792-803)
function onMessage(e) {
  if (e.origin !== window.location.origin) return;
  if (e.data && e.data.type === 'ITENS' && Array.isArray(e.data.itens)) {
    novosItens = e.data.itens;
    novosItens.forEach(function(n) {
      var prod = (window.products || []).find(function(pr) { return pr.id === Number(n.produtoId); });
      n.precoUnitario = prod ? Number(prod.price) : 0;
      n.nome = prod ? prod.name : 'Produto #' + n.produtoId;
    });
    btnSalvar.disabled = novosItens.length === 0;
    renderFooterItens();
  }
}
```

- [ ] **Step 2: Add renderFooterItens function**

```javascript
// admin.html - add after onMessage function
function renderFooterItens() {
  var footerItens = document.getElementById('footerItens');
  if (!footerItens) return;

  if (novosItens.length === 0) {
    footerItens.innerHTML = '<div class="text-muted text-center py-2">Nenhum item selecionado</div>';
    return;
  }

  var total = 0;
  var html = '<div class="list-group list-group-flush">';
  novosItens.forEach(function(item, index) {
    var subtotal = (item.quantidade || 1) * (item.precoUnitario || 0);
    total += subtotal;
    html += `
      <div class="list-group-item d-flex justify-content-between align-items-center py-2">
        <div class="d-flex align-items-center gap-2">
          <span class="fw-semibold">${item.quantidade || 1}x</span>
          <span>${item.nome || 'Produto'}</span>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="text-muted">R$ ${subtotal.toFixed(2)}</span>
        </div>
      </div>`;
  });
  html += '</div>';
  html += `<div class="d-flex justify-content-between align-items-center py-2 px-3 border-top">
    <span class="fw-bold">Total: R$ ${total.toFixed(2)}</span>
  </div>`;
  footerItens.innerHTML = html;
}
```

- [ ] **Step 3: Update modal HTML to include footerItens div**

```javascript
// admin.html - update modalHtml (lines 761-780)
var modalHtml = `
  <div class="modal fade" id="modalAdicionarItens" tabindex="-1">
    <div class="modal-dialog modal-fullscreen">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Adicionar Itens — Pedido #${String(docId).slice(-6)}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body p-0">
          <iframe src="balcao.html?embedded=1" id="iframeBalcao"
                  style="width:100%;height:calc(100vh - 200px);border:none;"></iframe>
        </div>
        <div class="modal-footer flex-column p-0">
          <div id="footerItens" style="max-height:200px;overflow-y:auto;width:100%;">
            <div class="text-muted text-center py-2">Nenhum item selecionado</div>
          </div>
          <div class="d-flex justify-content-end gap-2 p-3 w-100 border-top">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="btnSalvarItens" disabled>Salvar Alterações</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
```

- [ ] **Step 4: Run test to verify admin footer works**

```bash
# Start server and open admin.html
# Click "Adicionar Item" on a production card
# Click products in iframe
# Verify: admin footer shows item list with names, quantities, prices
```

---

### Task 3: Add Stock Management

**Files:**
- Modify: `admin.html:812-866` (`btnSalvar.onclick` function)

**Interfaces:**
- Consumes: `novosItens` array, `p.itens` (current order items)
- Produces: PATCH request with stock-aware payload

- [ ] **Step 1: Add stock check in save handler**

```javascript
// admin.html - update btnSalvar.onclick (lines 812-866)
btnSalvar.onclick = async function() {
  if (!novosItens.length) return;
  var itensAtuais = (p.itens || []).map(function(i) {
    return {
      produtoId: Number(i.produtoId),
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      sabores: i.sabores || null,
    };
  });
  var consolidados = agruparItensComNovos(itensAtuais, novosItens);
  
  // Check stock for items with controlaEstoque
  var estoqueInsuficiente = [];
  for (var item of novosItens) {
    var prod = (window.products || []).find(function(pr) { return pr.id === Number(item.produtoId); });
    if (prod && prod.controlaEstoque) {
      var qtdAdicionar = Number(item.quantidade) || 1;
      if (prod.estoqueAtual < qtdAdicionar) {
        estoqueInsuficiente.push(prod.name + ' (estoque: ' + prod.estoqueAtual + ')');
      }
    }
  }
  if (estoqueInsuficiente.length > 0) {
    toast('Estoque insuficiente: ' + estoqueInsuficiente.join(', '), 'danger');
    return;
  }
  
  // ... rest of existing save logic ...
};
```

- [ ] **Step 2: Run test to verify stock management works**

```bash
# Start server and open admin.html
# Click "Adicionar Item" on a production card
# Try to add more items than available stock
# Verify: toast shows "Estoque insuficiente" message
```

---

### Task 4: Integration Test

**Files:**
- Test: Manual browser test

**Interfaces:**
- Full flow: Iframe mini-cart → admin footer → save → PATCH

- [ ] **Step 1: Full regression test checklist**

```bash
# 1. Mini-Cart (iframe)
# - Open overlay, click product → toast appears, mini-cart shows item
# - Click same product again → no toast, quantity increments
# - Click − button → quantity decrements
# - Click + button → quantity increments
# - Click ✕ button → item removed
# - Combo: "Editar" opens flavor selector
# - Congelado: "Editar" opens flavor selector
# - Empty cart: Mini-cart hidden

# 2. Admin Footer
# - Footer mirrors iframe mini-cart
# - Shows item names, quantities, prices
# - Total updates correctly

# 3. Save Flow
# - Click "Salvar" → PATCH sent, overlay closes
# - Stock: controlaEstoque products decrement on save
# - Empty cart: "Salvar" disabled

# 4. Edge Cases
# - Close iframe without saving → no changes applied
# - Add multiple items → all appear in mini-cart
# - Add combo → flavor selector opens
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-09-admin-overlay-minicart.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**