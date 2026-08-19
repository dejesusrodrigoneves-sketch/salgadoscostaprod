# Combo 25 no Cardápio + Reorganização Form Produto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o combo configurável (ex.: Combo 25 salgadinhos) abrir overlay de escolha de sabores no index.html com limite de unidades, mostrar/editar sabores no cart.html, e mover Status/Categoria do form de produto no painelLoja.html.

**Architecture:** Três mudanças frontend independentes em arquivos já existentes. (1) `js/menu.js` intercepta o clique de combo configurável e abre overlay antes de salvar no localStorage. (2) `js/cart.js` valida o máximo de unidades (`config.unidades`) no overlay de sabores e adiciona botão "Editar combo" nos itens do carrinho. (3) `painelLoja.html` move os campos Status e Categoria para dentro da seção "Tipo de Produto". Nenhuma mudança de backend — o formato de `sabores` (`{produtoId: quantidade}` serializado como JSON) já é o que o backend aceita.

**Tech Stack:** HTML5, CSS3, JavaScript (frontend, sem framework), localStorage para carrinho. `ComboConfig` global (js/comboConfig.js) já existe no frontend.

## Global Constraints

- Não mudar backend (nenhum endpoint, schema, ou query).
- Formato de sabores salvo no carrinho: objeto `{<produtoId>: <quantidade>}` — chaves são IDs dos produtos-sabor, valores são inteiros ≥ 1.
- Regra de quantidade no overlay de combo: mínimo 1, máximo `config.unidades` (ex.: 25). Não permitir exceder.
- `config.unidades` e `config.sabores` vêm do produto retornado pela API pública (`/api/public/produtos`).
- Overlay de sabores usa SOMENTE `config.sabores` (não `products.filter(p => p.type === 1)`), filtrando `pausado !== true`.
- IDs de campos no form produto (`prodStatus`, `prodCategoryId`) permanecem os mesmos — JS usa `getElementById`, posição no DOM não importa.
- Combo identificado por `ComboConfig.tipoDe(produto.config) === 'combo_salgado'`.
- Escrever em pt-BR (mensagens de UI, nomes de variáveis seguem padrão do arquivo).

---

### Task 1: Overlay de sabores no index.html (js/menu.js)

**Files:**
- Modify: `js/menu.js:258-275` (função `addToCart`)
- Modify: `js/menu.js` (novas funções: `abrirOverlayCombo`, `confirmarOverlayCombo`, `fecharOverlayCombo`, `mudaQtdOverlayCombo`)
- Modify: `js/menu.js:73-95` (`addItemToArray` — botão do combo abre overlay em vez de addToCart direto)

**Interfaces:**
- Consumes: `ComboConfig.tipoDe(config)` → `'combo_salgado' | 'combo_acai' | null` (definido em `js/comboConfig.js`); `localStorage.cart` formato `[{id, qtd}]`; produto com `config.sabores: [{nome, pausado}]` e `config.unidades: number`.
- Produces: carrinho com item combo no formato `{id, qtd: 1, sabores: {<produtoId>: <qtd>}}`; funções globais `abrirOverlayCombo(produto)`, `confirmarOverlayCombo(produtoId)`, `fecharOverlayCombo()`, `mudaQtdOverlayCombo(produtoId, saborId, delta)`.

- [ ] **Step 1: Escrever o teste que falha (validação de limite)**

Criar `tests/menuCombo.test.js` (novo). O teste valida a função pura de contagem de sabores que será usada pelo overlay. Como `menu.js` roda no browser, isolar a lógica de limite em função exportável pura `js/comboLimite.js`:

```js
// js/comboLimite.js
(function (root) {
  function totalSelecionado(sabores) {
    return Object.values(sabores || {}).reduce(function (s, q) { return s + (Number(q) || 0); }, 0);
  }
  function podeIncrementar(sabores, unidades) {
    return totalSelecionado(sabores) < Number(unidades);
  }
  var api = { totalSelecionado: totalSelecionado, podeIncrementar: podeIncrementar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ComboLimite = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

```js
// tests/menuCombo.test.js
import { describe, it, expect } from 'vitest';
import { totalSelecionado, podeIncrementar } from '../js/comboLimite.js';

describe('comboLimite', () => {
  it('soma quantidades selecionadas', () => {
    expect(totalSelecionado({ 1: 2, 2: 3 })).toBe(5);
    expect(totalSelecionado({})).toBe(0);
  });
  it('permite incrementar enquanto total < unidades', () => {
    expect(podeIncrementar({ 1: 24 }, 25)).toBe(true);
    expect(podeIncrementar({ 1: 25 }, 25)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

Run: `cd backend && npx vitest run tests/menuCombo.test.js` — o teste referencia `js/comboLimite.js` (inexistente), falha com "Cannot find module".

- [ ] **Step 3: Criar `js/comboLimite.js`**

Criar arquivo com o conteúdo exato do Step 1 (o bloco `js/comboLimite.js`).

- [ ] **Step 4: Rodar teste para confirmar que passa**

Run: `cd backend && npx vitest run tests/menuCombo.test.js`
Expected: 2 passed.

- [ ] **Step 5: Incluir `comboLimite.js` e `comboConfig.js` no index.html**

Adicionar antes de `js/menu.js` no `index.html`:
```html
<script src="js/comboConfig.js"></script>
<script src="js/comboLimite.js"></script>
```

- [ ] **Step 6: Alterar `addItemToArray` para detectar combo**

Em `js/menu.js`, função `addItemToArray` (linha ~73), trocar o `btnHTML` para abrir overlay quando o produto for combo:

```js
const isComboSalgado = ComboConfig && ComboConfig.tipoDe(prod.config) === 'combo_salgado';
const btnHTML = qtd > 0 && !isComboSalgado
  ? '<button class="btn btn-minus" onclick="removeFromCart(' + prod.id + ',event)">...</button><span class="cart-qty">' + qtd + '</span><button class="btn btn-plus" onclick="addToCart(' + prod.id + ',event)">...</button>'
  : '<button class="btn btn-add" onclick="' + (isComboSalgado ? 'abrirOverlayCombo(' + prod.id + ')' : 'addToCart(' + prod.id + ',event)') + '">...</button>';
```

- [ ] **Step 7: Adicionar funções do overlay no `js/menu.js`**

Adicionar no final de `js/menu.js`:

```js
let comboSelecao = {};
let comboProdutoAtual = null;

function abrirOverlayCombo(produtoId) {
  if (typeof ComboConfig === 'undefined' || typeof ComboLimite === 'undefined') return;
  const produto = products.find(p => p.id === produtoId);
  if (!produto || ComboConfig.tipoDe(produto.config) !== 'combo_salgado') return;
  const statusBar = document.getElementById('statusBar');
  const isOpen = statusBar && statusBar.style.backgroundColor === 'green';
  if (!isOpen) { toast('Loja fechada!', 'danger'); return; }

  comboProdutoAtual = produto;
  comboSelecao = {};
  const cfg = produto.config;
  const saboresAtivos = (cfg.sabores || []).filter(s => !s.pausado);

  const overlay = document.createElement('div');
  overlay.id = 'overlayComboSabores';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;padding:20px;">
      <h3 style="margin:0 0 4px;color:#333;">${escapeHtml(produto.name)}</h3>
      <p style="font-size:13px;color:#666;margin-bottom:14px;">Escolha até ${cfg.unidades} unidades — combinação livre.</p>
      ${saboresAtivos.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eee;">
          <span style="color:#333;font-weight:500;">${escapeHtml(s.nome)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" onclick="mudaQtdOverlayCombo(${produto.id},'${escapeHtml(s.nome)}',-1)" style="width:32px;height:32px;border:none;border-radius:8px;background:#1FA58D;color:#fff;font-weight:bold;cursor:pointer;">-</button>
            <span id="qtd-overlay-${produto.id}-${s.nome}">0</span>
            <button type="button" onclick="mudaQtdOverlayCombo(${produto.id},'${escapeHtml(s.nome)}',1)" style="width:32px;height:32px;border:none;border-radius:8px;background:#1FA58D;color:#fff;font-weight:bold;cursor:pointer;">+</button>
          </div>
        </div>`).join('')}
      <p style="margin:14px 0;font-weight:600;color:#333;">Total: <span id="total-overlay-combo">0</span> / ${cfg.unidades}</p>
      <div style="display:flex;gap:8px;">
        <button onclick="confirmarOverlayCombo(${produto.id})" style="flex:1;padding:12px;border:none;border-radius:10px;background:#1FA58D;color:#fff;font-weight:600;cursor:pointer;">Adicionar</button>
        <button onclick="fecharOverlayCombo()" style="padding:12px 20px;border:1px solid #ccc;border-radius:10px;background:#fff;color:#666;font-weight:600;cursor:pointer;">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function mudaQtdOverlayCombo(produtoId, saborNome, delta) {
  const produto = products.find(p => p.id === produtoId);
  if (!produto || !ComboLimite) return;
  const unidades = Number(produto.config.unidades) || 0;
  const atual = comboSelecao[saborNome] || 0;
  const novo = Math.max(0, atual + delta);
  if (novo > atual && !ComboLimite.podeIncrementar(comboSelecao, unidades)) {
    toast('Limite de ' + unidades + ' unidades atingido.', 'warning');
    return;
  }
  comboSelecao[saborNome] = novo;
  const el = document.getElementById('qtd-overlay-' + produtoId + '-' + saborNome);
  if (el) el.textContent = novo;
  const total = ComboLimite.totalSelecionado(comboSelecao);
  const totalEl = document.getElementById('total-overlay-combo');
  if (totalEl) totalEl.textContent = total;
}

function confirmarOverlayCombo(produtoId) {
  const total = ComboLimite.totalSelecionado(comboSelecao);
  if (total <= 0) { toast('Escolha pelo menos 1 unidade.', 'warning'); return; }

  // Mapear nome do sabor -> produtoId (type===1)
  const saboresObj = {};
  Object.entries(comboSelecao).forEach(([nome, qtd]) => {
    const sabor = products.find(p => p.name === nome && p.type === 1);
    if (sabor) saboresObj[sabor.id] = qtd;
  });

  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const existing = cart.find(i => i.id === produtoId);
  if (existing) {
    existing.sabores = saboresObj;
    existing.qtd = total;
  } else {
    cart.push({ id: produtoId, qtd: total, sabores: saboresObj });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  fecharOverlayCombo();
  refreshProductCards();
  toast('Combo adicionado!', 'success');
}

function fecharOverlayCombo() {
  const overlay = document.getElementById('overlayComboSabores');
  if (overlay) overlay.remove();
  comboProdutoAtual = null;
}
```

- [ ] **Step 8: Verificar manualmente no browser**

Run: `cd backend && node server.js` (se não estiver rodando). Abrir `http://localhost:3000/index.html`, clicar no "Combo 25 salgadinhos". Expected: overlay abre com sabores, "+" bloqueia aos 25, "Adicionar" salva `{id:20, qtd:N, sabores:{...}}` no localStorage.

- [ ] **Step 9: Commit**

```bash
git add js/comboLimite.js tests/menuCombo.test.js index.html js/menu.js
git commit -m "feat: overlay de sabores para combo salgado no cardápio"
```

---

### Task 2: Limite + botão "Editar combo" no cart.html (js/cart.js)

**Files:**
- Modify: `js/cart.js:399-432` (`abrirModalSabores` — limitar a `config.unidades`)
- Modify: `js/cart.js:434-444` (`mudaQtdSabor` — bloquear acima do limite)
- Modify: `js/cart.js:464-483` (`confirmarSabores` — validar total ≤ unidades)
- Modify: `js/cart.js:222-257` (`renderizaItens` — mostrar sabores por linha + botão "Editar combo")

**Interfaces:**
- Consumes: `ComboConfig.tipoDe(config)`; `ComboLimite.totalSelecionado` / `ComboLimite.podeIncrementar` (do Task 1); carrinho com `sabores: {<produtoId>: <qtd>}`; `window.products`.
- Produces: overlay editável com botão "Editar combo" por item combo no carrinho; validação de limite aplicada.

- [ ] **Step 1: Incluir `comboLimite.js` no cart.html**

Em `view/cart.html`, antes de `../js/cart.js`:
```html
<script src="../js/comboConfig.js"></script>
<script src="../js/comboLimite.js"></script>
```

- [ ] **Step 2: Bloquear "+" quando atingir o limite em `mudaQtdSabor`**

Em `js/cart.js`, substituir `mudaQtdSabor` (linhas 434-444):

```js
function mudaQtdSabor(pacoteId, saborId, delta){
  if(!modaisState[pacoteId]) modaisState[pacoteId] = {open:true, sabores:{}, qtd:1};
  const atual = modaisState[pacoteId].sabores[saborId] || 0;
  const novo = Math.max(0, atual + delta);
  if (novo > atual) {
    const pacote = window.products.find(p => p.id === pacoteId);
    const unidades = pacote && pacote.config ? Number(pacote.config.unidades) || 0 : 0;
    if (unidades > 0 && typeof ComboLimite !== 'undefined' && !ComboLimite.podeIncrementar(modaisState[pacoteId].sabores, unidades)) {
      toast('Limite de ' + unidades + ' unidades atingido.', 'warning');
      return;
    }
  }
  modaisState[pacoteId].sabores[saborId] = novo;
  document.getElementById(`qtd-sabor-${pacoteId}-${saborId}`).textContent = novo;

  const total = Object.values(modaisState[pacoteId].sabores).reduce((a,b)=>a+b,0);
  const el = document.getElementById(`totalEscolhido-${pacoteId}`);
  if(el) el.textContent = total;
}
```

- [ ] **Step 3: Validar total ≤ unidades em `confirmarSabores`**

Em `js/cart.js`, substituir `confirmarSabores` (linhas 464-483):

```js
function confirmarSabores(pacoteId){
  const state = modaisState[pacoteId];
  const totalEscolhido = Object.values(state.sabores).reduce((a,b)=>a+b,0);

  if(totalEscolhido <= 0){ 
    toast("Escolha pelo menos 1 salgado.", 'warning');
    return;
  }

  const pacote = window.products.find(p => p.id === pacoteId);
  const unidades = pacote && pacote.config ? Number(pacote.config.unidades) || 0 : 0;
  if (unidades > 0 && totalEscolhido > unidades) {
    toast('Máximo de ' + unidades + ' unidades.', 'warning');
    return;
  }

  let cart = getCart();
  const index = cart.findIndex(i=>i.id===pacoteId);
  if(index!==-1){
    cart[index].qtd = totalEscolhido;
    cart[index].sabores = {...state.sabores};
    setCart(cart);
  }

  fecharSabores(pacoteId);
  renderizaItens();
}
```

- [ ] **Step 4: Renderizar sabores por linha + botão "Editar combo" em `renderizaItens`**

Em `js/cart.js`, no loop de itens (após a linha 256), substituir o bloco que mostra sabores:

```js
if (prod.sabores && Object.keys(prod.sabores).length > 0) {
  const ehCombo = item && item.config && ComboConfig && ComboConfig.tipoDe(item.config) === 'combo_salgado';
  if (ehCombo) {
    const linhas = Object.entries(prod.sabores)
      .filter(([,qtd]) => Number(qtd) > 0)
      .map(([idSabor,qtd]) => {
        const s = window.products.find(p => p.id == idSabor);
        return `<div class="sabor-linha"><span>${s ? escapeHtml(s.name) : 'Sabor #' + idSabor}</span><span>${qtd}</span></div>`;
      }).join('');
    html += `<div class="combo-sabores">${linhas}
      <button onclick="abrirModalSaboresEdicao(${prod.id})" class="btn-editar-combo">✏️ Editar combo</button>
    </div>`;
  } else {
    const saboresArray = Object.entries(prod.sabores)
      .filter(([idSabor,qtd]) => qtd>0)
      .map(([idSabor,qtd]) => {
        const s = window.products.find(p => p.id == idSabor);
        return `${qtd}x ${escapeHtml(s.name)}`;
      });
    html += `<p class="caixaItem">${saboresArray.join(', <br />')}</p>`;
  }
}
```

- [ ] **Step 5: Adicionar função de edição `abrirModalSaboresEdicao`**

Em `js/cart.js`, adicionar após `confirmarSabores`:

```js
function abrirModalSaboresEdicao(pacoteId) {
  const cart = getCart();
  const item = cart.find(i => i.id === pacoteId);
  const pacote = window.products.find(p => p.id === pacoteId);
  if (!pacote || !item) return;
  modaisState[pacoteId] = { open: true, sabores: item.sabores || {}, qtd: item.qtd || 1 };
  abrirModalSabores(pacote);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

- [ ] **Step 6: CSS para sabores por linha + botão editar**

Adicionar ao final de `css/cart.css`:

```css
.combo-sabores {
  background: #f7f7f7;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 8px;
}
.combo-sabores .sabor-linha {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #333;
  padding: 3px 0;
}
.combo-sabores .btn-editar-combo {
  margin-top: 8px;
  width: 100%;
  padding: 8px;
  border: 1px solid #1FA58D;
  border-radius: 8px;
  background: #fff;
  color: #1FA58D;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.combo-sabores .btn-editar-combo:hover {
  background: #1FA58D;
  color: #fff;
}
```

- [ ] **Step 7: Verificar manualmente no browser**

Abrir `http://localhost:3000/index.html`, adicionar combo 25 com sabores. Ir a `http://localhost:3000/view/cart.html`. Expected: combo mostra "Coxinha 1", "Queijo 20", etc. em linhas, botão "Editar combo" reabre overlay, "+" bloqueia aos 25, total recalcula.

- [ ] **Step 8: Commit**

```bash
git add view/cart.html js/cart.js css/cart.css
git commit -m "feat: editar sabores do combo no carrinho com limite de unidades"
```

---

### Task 3: Mover Status e Categoria no form de produto (painelLoja.html)

**Files:**
- Modify: `painelLoja.html:144-180` (seção "Tipo de Produto")
- Modify: `painelLoja.html:182-221` (details "Avançado")

**Interfaces:**
- Consumes: HTML existente com `id="prodStatus"`, `id="prodCategoryId"`, `id="prodCongelado"`, `id="prodControlaEstoque"`.
- Produces: mesmos IDs em posições novas; nenhuma mudança de JS.

- [ ] **Step 1: Mover Status e Categoria para "Tipo de Produto"**

Em `painelLoja.html`, dentro da seção "Tipo de Produto" (após o `<select id="prodTipo">` na linha 153, antes de `camposComboSalgado`), inserir:

```html
<div class="row">
  <div class="lbl">Status</div>
  <select id="prodStatus">
    <option value="active">Ativo</option>
    <option value="paused">Pausado</option>
  </select>
</div>
<div class="row">
  <div class="lbl">Categoria</div>
  <select id="prodCategoryId">
    <option value="">Sem categoria</option>
  </select>
</div>
```

- [ ] **Step 2: Remover Status e Categoria do "Avançado"**

Em `painelLoja.html`, dentro do `<details>` "Avançado", remover os blocos de Status (linhas 187-193) e Categoria (linhas 198-203). O `<details>` fica apenas com: Congelado, Controlar Estoque, Estoque Atual, Avisar, Qdo estoque=0.

- [ ] **Step 3: Verificar manualmente**

Abrir `http://localhost:3000/painelLoja.html`, aba Produtos, form produto. Expected: Status e Categoria aparecem sob "Tipo de Produto"; "Avançado (opcional)" contém apenas Congelado e campos de estoque. Salvar um produto com status "pausado" e categoria — valores persistem (IDs iguais).

- [ ] **Step 4: Commit**

```bash
git add painelLoja.html
git commit -m "feat: mover Status e Categoria para Tipo de Produto no form"
```

---

## Self-Review

- **Spec coverage:** Problema 1A (overlay no index) → Task 1. Problema 1B (limite 25 + edição no cart) → Task 2. Problema 2 (mover Status/Categoria) → Task 3. Cobertura completa.
- **Placeholders:** nenhum — todo código incluído.
- **Type consistency:** `ComboConfig.tipoDe`, `ComboLimite.totalSelecionado`, `ComboLimite.podeIncrementar` definidos na Task 1 e reutilizados na Task 2 com mesmos nomes. `sabores` formato `{<produtoId>: <qtd>}` consistente entre Tasks 1 e 2.
