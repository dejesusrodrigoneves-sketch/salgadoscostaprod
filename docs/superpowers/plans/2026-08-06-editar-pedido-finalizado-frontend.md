# Editar Pedido Finalizado — Frontend Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement two modals (A: itens, B: valores) in `admin.html` to allow editing finalized orders — add/remove/edit items, change payment method + delivery type — wiring them to existing backend `PATCH /api/pedidos/:id/editar`.

**Architecture:** Pure client-side modals modeled after existing `selecionarEntregadorModal` (overlay > modal-box > actions). Reusable helpers `calcularTaxaCartao` and `calcularTaxaEntrega` replicate `cart.js` arithmetic (6% crédito / 3% débito over subtotal; bairro lookup from `/api/loja/settings-admin`). State flows through a local `estadoEdicao` object between Modal A and Modal B, dispatched via a single PATCH on Modal B save.

**Tech Stack:** Vanilla JS (browser), Fetch API (`api(path, opts)` helper already defined), Prisma-backed Express PATCH route (already deployed), Toastify via `toast(msg, type)` helper, Font Awesome icons.

## Global Constraints

- **Backend is done** — do NOT modify `orderService.js`, `orderController.js`, or `orderRoutes.js`. They are verified working (7/7 tests pass on `processarEdicaoPedido`).
- **No new dependencies** — use existing CSS classes (`.modal-overlay`, `.modal-box`, `.btn`, `.driver-modal-list`, `.driver-option`) and `toast()` helper.
- **No notifications** — editing does NOT send WhatsApp; user clicks notify manually after.
- **Status stays `finalizado`** — backend never changes status during edit (verified in `orderService.editarPedido`).
- **Percentages exact** — crédito: `0.06 * subtotal`, débito: `0.03 * subtotal`, dinheiro/pix: `0`. Subtotal = `itens + taxaEntrega`.
- **Bairro fallback** — if bairro name not found in `bairrosAtendidos[]`, `taxaEntrega = 0`.
- **Retirada** — `taxaEntrega = 0` regardless of bairro.
- **Botão "Em Rota" para balcão** — usado `${p.tipoEntrega !== 'balcao' ? ...}` guard (já aplicado, não mexer).
- **Auth header** — `api()` helper injecciona Bearer token automaticamente de `localStorage.authUser`.
- **Commit-policy** — um commit por task. Mensagens em pt-BR, conventional commits.

---

## File Structure

Cada arquivo tem responsabilidade única — não mesclar.

- **Modify:** `admin.html` — única fonte de verdade do frontend admin. Toda nova lógica entra aqui inline (sem novo arquivo JS, padrão existente da página).

**Rationale:** `admin.html` já hospeda `api()`, `carregarPedidos()`, `selecionarEntregadorModal()`, `renderCard()`, `updateStats()`. Modais de edição seguem o mesmo padrão inline. Splitar para `js/admin-editar.js` quebraria o padrão (página é standalone).

**Funções a adicionar (todas inline em `admin.html`):**

| Função | Responsabilidade |
|---|---|
| `calcularTaxaCartao(formaPagamento, subtotal)` | Pure. Retorna percentual * subtotal. |
| `calcularTaxaEntrega(tipoEntrega, bairroNome, bairrosAtendidos)` | Pure. Retorna 0 se retirada, ou taxa do bairro match, ou 0. |
| `modalEditarItens(p)` | Abre Modal A. Lista itens + add via catálogo. Salva em `estadoEdicao`. |
| `modalEditarValores(p, estadoEdicao)` | Abre Modal B. Forma pagamento, tipo entrega, bairro. Recalcula total. PATCH. |
| `recalcularTotais(estadoEdicao)` | Pure usado por Modal B. Devolve `{ subtotal, taxaEntrega, taxaCartao, total }`. |
| `abrirFluxoEdicao(p)` | Orquestra: reset estadoEdicao → modalEditarItens → on save → modalEditarValores. |

---

## Task 1: Helpers puros `calcularTaxaCartao` + `calcularTaxaEntrega` + `recalcularTotais`

**Files:**
- Modify: `admin.html` (insere bloco logo após `selecionarEntregadorModal` definition, ~linha 437)
- Test: manual via `playwright_browser_evaluate` no browser rodando admin

**Interfaces:**
- Consumes: nada externo
- Produces:
  - `calcularTaxaCartao(formaPagamento: 'dinheiro'|'pix'|'credito'|'debito', subtotal: number): number`
  - `calcularTaxaEntrega(tipoEntrega: 'retirada'|'delivery', bairroNome: string, bairrosAtendidos: Array<{nome: string, taxa: number}>): number`
  - `recalcularTotais({ itens, formaPagamento, tipoEntrega, bairro, bairrosAtendidos, desconto }): { subtotalItens, subtotal, taxaEntrega, taxaCartao, total }`

- [ ] **Step 1: Insert pure helpers block in admin.html**

Localized insertion point: between line 437 (`}` fechando `selecionarEntregadorModal`) e line 439 (`// --- Web Audio API beep system ---`).

Substitua o conteúdo da linha 437 a 438 (a `}` e a linha em branco) por:

```js
}

// --- Helpers de cálculo de edição (replica cart.js) ---
function calcularTaxaCartao(formaPagamento, subtotal) {
  if (formaPagamento === 'credito') return Number((subtotal * 0.06).toFixed(2));
  if (formaPagamento === 'debito')  return Number((subtotal * 0.03).toFixed(2));
  return 0;
}

function calcularTaxaEntrega(tipoEntrega, bairroNome, bairrosAtendidos) {
  if (tipoEntrega !== 'delivery') return 0;
  if (!Array.isArray(bairrosAtendidos) || !bairroNome) return 0;
  var match = bairrosAtendidos.find(function(b) {
    return b && b.nome && b.nome.toLowerCase() === String(bairroNome).toLowerCase();
  });
  return match && match.taxa ? Number(match.taxa) : 0;
}

function recalcularTotais(estado) {
  var bairros = estado.bairrosAtendidos || [];
  var subtotalItens = (estado.itens || []).reduce(function(acc, i) {
    return acc + (Number(i.quantidade) * Number(i.precoUnitario || 0));
  }, 0);
  var taxaEntrega = calcularTaxaEntrega(estado.tipoEntrega, estado.bairro, bairros);
  var subtotal = subtotalItens + taxaEntrega - Number(estado.desconto || 0);
  var taxaCartao = calcularTaxaCartao(estado.formaPagamento, subtotal);
  var total = subtotal + taxaCartao;
  return {
    subtotalItens: Number(subtotalItens.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    taxaEntrega: Number(taxaEntrega.toFixed(2)),
    taxaCartao: Number(taxaCartao.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

```

- [ ] **Step 2: Verify syntax in browser**

Run via `playwright_browser_navigate` to `http://localhost:3000/admin.html` (assumindo backend servindo estático via `express.static`).

Then `playwright_browser_evaluate`:
```js
() => {
  return {
    cartao: calcularTaxaCartao('credito', 100),
    entrega: calcularTaxaEntrega('delivery', 'Centro', [{nome:'Centro', taxa: 5}]),
    retirada: calcularTaxaEntrega('retirada', 'Centro', [{nome:'Centro', taxa: 5}]),
    semBairro: calcularTaxaEntrega('delivery', 'X', [{nome:'Centro', taxa: 5}]),
    totais: recalcularTotais({ itens: [{quantidade:2, precoUnitario: 10}], formaPagamento: 'credito', tipoEntrega: 'delivery', bairro: 'Centro', bairrosAtendidos: [{nome:'Centro', taxa:5}], desconto: 0 }),
  };
}
```
Expected: `{ cartao: 6, entrega: 5, retirada: 0, semBairro: 0, totais: { subtotalItens: 20, subtotal: 25, taxaEntrega: 5, taxaCartao: 1.5, total: 26.5 } }`

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat(admin): helpers calcularTaxaCartao/Entrega + recalcularTotais para edicao"
```

---

## Task 2: Modal A — Editar Itens (`modalEditarItens`)

**Files:**
- Modify: `admin.html` (insert após `recalcularTotais` adicionado na Task 1)

**Interfaces:**
- Consumes: `api()`, `toast()`, `recalcularTotais` (Task 1), `window.products` (já populado em `initAdmin()`)
- Produces: função `modalEditarItens(p)` que retorna Promise resolve → `{ itens: [...] }` (novo array) ou resolve null se cancelado.

- [ ] **Step 1: Insert `modalEditarItens` function**

Logo após `recalcularTotais` (fim da Task 1), adicionar:

```js
// --- Modal A: Editar Itens ---
function modalEditarItens(p) {
  return new Promise(async (resolve) => {
    var produtos = window.products || [];
    if (!produtos.length) {
      try {
        var r = await fetch('/api/public/produtos');
        produtos = await r.json() || [];
        window.products = produtos;
      } catch(e) { console.error('Falha ao carregar produtos', e); }
    }

    // clone itens atuais (deep copy rasa)
    var itens = (p.itens || []).map(function(i) {
      return {
        produtoId: Number(i.produtoId),
        nome: i.produto ? i.produto.name : (produtos.find(function(pr){ return pr.id === Number(i.produtoId); }) || {}).name || 'Produto #' + i.produtoId,
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.precoUnitario),
        sabores: i.sabores || null,
      };
    });

    function precoTotal() {
      return itens.reduce(function(acc, i) { return acc + (i.quantidade * i.precoUnitario); }, 0);
    }

    function renderLista() {
      return itens.map(function(i, idx) {
        return '<div class="driver-option" data-idx="' + idx + '" style="flex-direction:column;align-items:stretch;padding:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">' +
            '<span class="driver-name">' + (i.nome || 'Produto') + '</span>' +
            '<button class="btn btn-delete" style="padding:4px 8px;" data-remove="' + idx + '"><i class="fas fa-times"></i></button>' +
          '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;width:100%;">' +
            '<label style="font-size:12px;">Qtd:</label>' +
            '<input type="number" min="1" step="1" value="' + i.quantidade + '" data-qtd="' + idx + '" style="width:70px;padding:4px;">' +
            '<span style="font-size:12px;color:var(--text-muted);">R$ ' + Number(i.precoUnitario).toFixed(2) + ' / un</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderProdutosSelect() {
      var opts = '<option value="">Selecione...</option>' +
        produtos.map(function(pr) { return '<option value="' + pr.id + '">' + pr.name + ' (R$ ' + Number(pr.price).toFixed(2) + ')</option>'; }).join('');
      return opts;
    }

    function atualizaPreview() {
      var el = overlay.querySelector('#subtotalPreview');
      if (el) el.textContent = 'R$ ' + precoTotal().toFixed(2);
    }

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:600px;">' +
        '<h3><i class="fas fa-edit"></i> Editar Itens — Pedido #' + p.id + '</h3>' +
        '<p style="margin:8px 0 16px;font-size:13px;color:var(--text-muted);">Cliente: ' + (p.clienteNome || p.cliente?.nome || '-') + '</p>' +
        '<div class="driver-modal-list" id="listaItens">' + renderLista() + '</div>' +
        '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
          '<h4 style="font-size:14px;margin-bottom:8px;"><i class="fas fa-plus-circle"></i> Adicionar Item</h4>' +
          '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">' +
            '<div style="flex:1;min-width:200px;"><label style="font-size:12px;">Produto</label><select id="addProduto" style="width:100%;padding:6px;">' + renderProdutosSelect() + '</select></div>' +
            '<div style="width:80px;"><label style="font-size:12px;">Qtd</label><input type="number" id="addQtd" min="1" value="1" style="width:100%;padding:6px;"></div>' +
            '<button class="btn btn-producao" id="btnAdd"><i class="fas fa-plus"></i> Add</button>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;">' +
          '<strong>Subtotal itens: <span id="subtotalPreview">R$ ' + precoTotal().toFixed(2) + '</span></strong>' +
        '</div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="modalACancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="modalASave"><i class="fas fa-check"></i> Salvar Itens</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function rebind() {
      var container = overlay.querySelector('#listaItens');
      container.innerHTML = renderLista();
      container.querySelectorAll('button[data-remove]').forEach(function(btn) {
        btn.onclick = function() {
          var idx = Number(btn.dataset.remove);
          itens.splice(idx, 1);
          rebind();
          atualizaPreview();
        };
      });
      container.querySelectorAll('input[data-qtd]').forEach(function(inp) {
        inp.onchange = function() {
          var idx = Number(inp.dataset.qtd);
          var nova = Math.max(1, parseInt(inp.value, 10) || 1);
          itens[idx].quantidade = nova;
          atualizaPreview();
        };
      });
      atualizaPreview();
    }

    overlay.querySelector('#btnAdd').onclick = function() {
      var prodId = Number(overlay.querySelector('#addProduto').value);
      var qtd = Math.max(1, parseInt(overlay.querySelector('#addQtd').value, 10) || 1);
      if (!prodId) { toast('Selecione um produto', 'warning'); return; }
      var prod = produtos.find(function(pr) { return pr.id === prodId; });
      if (!prod) { toast('Produto não encontrado', 'danger'); return; }
      var existente = itens.find(function(i) { return Number(i.produtoId) === prodId; });
      if (existente) {
        existente.quantidade += qtd;
      } else {
        itens.push({ produtoId: prodId, nome: prod.name, quantidade: qtd, precoUnitario: Number(prod.price), sabores: null });
      }
      rebind();
      overlay.querySelector('#addProduto').value = '';
      overlay.querySelector('#addQtd').value = '1';
    };

    overlay.querySelector('#modalASave').onclick = function() {
      if (!itens.length) { toast('Adicione ao menos 1 item', 'warning'); return; }
      overlay.remove();
      resolve({ itens: itens });
    };
    overlay.querySelector('#modalACancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}
```

- [ ] **Step 2: Verify in browser — abrir pedido finalizado, clicar Editar, ver modal**

`playwright_browser_navigate` → http://localhost:3000/admin.html
`playwright_browser_snapshot` → confirmar tab "Finalizados" presente
Clicar pedido finalizado → clicar botão "Editar" → snapshot deve mostrar título "Editar Itens — Pedido #X"

- [ ] **Step 3: Add/remove item no modal, clicar Salvar Itens**

Espera-se: modal fecha, toast não aparece ainda (ainda faltou Modal B).

Verify via `playwright_browser_console_messages` level `error`: **zero errors**. Se `modalEditarItens` emitir ReferenceError → revisar inserção.

- [ ] **Step 4: Commit**

```bash
git add admin.html
git commit -m "feat(admin): modalEditarItens para edicao de itens de pedido finalizado"
```

---

## Task 3: Modal B — Editar Valores (`modalEditarValores`) + fluxo de orquestração `abrirFluxoEdicao`

**Files:**
- Modify: `admin.html` (insert após `modalEditarItens` da Task 2)

**Interfaces:**
- Consumes: `modalEditarItens` (Task 2), `recalcularTotais` (Task 1), `api()`, `toast()`, `carregarPedidos()`
- Produces: `modalEditarValores(p, estado)` retorna Promise que resolve após PATCH; `abrirFluxoEdicao(p)` orquestra A→B.

- [ ] **Step 1: Substituir handler atual do botão editar**

Localizar na linha 373 (trecho atual):

```js
  if (p.status === 'finalizado') {
    card.querySelector('[data-action="editar"]').onclick = () => modalEditarItens(p);
  }
```

Substituir por:

```js
  if (p.status === 'finalizado') {
    card.querySelector('[data-action="editar"]').onclick = () => abrirFluxoEdicao(p);
  }
```

- [ ] **Step 2: Adicionar `modalEditarValores` + `abrirFluxoEdicao` após `modalEditarItens`**

```js
// --- Modal B: Editar Valores + orquestração ---
async function modalEditarValores(p, estado) {
  // fetch bairros
  var bairrosAtendidos = [];
  try {
    var config = await api('/loja/settings-admin');
    if (config && Array.isArray(config.bairrosAtendidos)) {
      bairrosAtendidos = config.bairrosAtendidos;
    }
  } catch(e) { console.error('Falha ao buscar settings-admin', e); }
  estado.bairrosAtendidos = bairrosAtendidos;

  // defaults a partir do pedido
  estado.formaPagamento = estado.formaPagamento || p.formaPagamento || 'dinheiro';
  estado.tipoEntrega = estado.tipoEntrega || p.tipoEntrega || 'retirada';
  estado.bairro = estado.bairro || p.bairro || p.cliente?.bairro || '';
  estado.desconto = estado.desconto || Number(p.desconto || 0);
  estado.troco = estado.troco || Number(p.troco || 0);

  function refresh() {
    var totais = recalcularTotais(estado);
    estado.taxaEntrega = totais.taxaEntrega;
    estado.taxaCartao = totais.taxaCartao;
    estado.total = totais.total;
    var elSubItens = overlay.querySelector('#valSubItens');
    var elEntrega   = overlay.querySelector('#valEntrega');
    var elCartao    = overlay.querySelector('#valCartao');
    var elTotal     = overlay.querySelector('#valTotal');
    if (elSubItens) elSubItens.textContent = 'R$ ' + totais.subtotalItens.toFixed(2);
    if (elEntrega)   elEntrega.textContent   = 'R$ ' + totais.taxaEntrega.toFixed(2);
    if (elCartao)    elCartao.textContent    = 'R$ ' + totais.taxaCartao.toFixed(2);
    if (elTotal)     elTotal.textContent     = 'R$ ' + totais.total.toFixed(2);
    // toggle bairro section visibility
    var secBairro = overlay.querySelector('#secBairro');
    if (secBairro) secBairro.style.display = estado.tipoEntrega === 'delivery' ? 'block' : 'none';
    // toggle troco section
    var secTroco = overlay.querySelector('#secTroco');
    if (secTroco) secTroco.style.display = estado.formaPagamento === 'dinheiro' ? 'block' : 'none';
  }

  function optsBairros() {
    var sel = estado.bairro || '';
    var matchFound = bairrosAtendidos.some(function(b) { return b.nome.toLowerCase() === String(sel).toLowerCase(); });
    var html = bairrosAtendidos.map(function(b) {
      var selected = (b.nome.toLowerCase() === String(sel).toLowerCase()) ? ' selected' : '';
      return '<option value="' + b.nome + '"' + selected + '>' + b.nome + ' (R$ ' + Number(b.taxa).toFixed(2) + ')</option>';
    }).join('');
    if (!matchFound && sel) html = '<option value="' + sel + '" selected>' + sel + ' (sem taxa)</option>' + html;
    return html;
  }

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal-box" style="max-width:500px;">' +
      '<h3><i class="fas fa-sliders-h"></i> Ajustar Valores — Pedido #' + p.id + '</h3>' +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">' +
        '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Forma de Pagamento</label>' +
          '<select id="valFormaPagamento" style="width:100%;padding:6px;">' +
            '<option value="dinheiro">Dinheiro</option>' +
            '<option value="pix">PIX</option>' +
            '<option value="debito">Débito</option>' +
            '<option value="credito">Crédito</option>' +
          '</select></div>' +
        '<div id="secTroco"><label style="font-size:12px;display:block;margin-bottom:4px;">Troco para (R$)</label>' +
          '<input type="number" id="valTroco" min="0" step="0.01" value="' + Number(estado.troco || 0).toFixed(2) + '" style="width:100%;padding:6px;"></div>' +
        '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Tipo de Entrega</label>' +
          '<div style="display:flex;gap:8px;">' +
            '<label style="flex:1;"><input type="radio" name="valTipoEntrega" value="retirada"> Retirada</label>' +
            '<label style="flex:1;"><input type="radio" name="valTipoEntrega" value="delivery"> Delivery</label>' +
          '</div></div>' +
        '<div id="secBairro"><label style="font-size:12px;display:block;margin-bottom:4px;">Bairro</label>' +
          '<select id="valBairro" style="width:100%;padding:6px;">' + optsBairros() + '</select></div>' +
        '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Desconto (R$)</label>' +
          '<input type="number" id="valDesconto" min="0" step="0.01" value="' + Number(estado.desconto || 0).toFixed(2) + '" style="width:100%;padding:6px;"></div>' +
        '<div style="padding:12px;background:var(--secondary);border-radius:8px;">' +
          '<div style="display:flex;justify-content:space-between;"><span>Itens:</span><span id="valSubItens">R$ 0,00</span></div>' +
          '<div style="display:flex;justify-content:space-between;"><span>Entrega:</span><span id="valEntrega">R$ 0,00</span></div>' +
          '<div style="display:flex;justify-content:space-between;"><span>Taxa cartão:</span><span id="valCartao">R$ 0,00</span></div>' +
          '<div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:4px;border-top:1px solid var(--border);padding-top:4px;"><span>Total:</span><span id="valTotal">R$ 0,00</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:16px;">' +
        '<button class="btn btn-modal-cancel" id="modalBCancel">Cancelar</button>' +
        '<button class="btn btn-pronto" id="modalBSave"><i class="fas fa-check"></i> Salvar Alterações</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // init form values
  overlay.querySelector('#valFormaPagamento').value = estado.formaPagamento;
  var radios = overlay.querySelectorAll('input[name="valTipoEntrega"]');
  radios.forEach(function(r) { r.checked = (r.value === estado.tipoEntrega); });
  refresh();

  // listeners
  overlay.querySelector('#valFormaPagamento').onchange = function() { estado.formaPagamento = this.value; refresh(); };
  overlay.querySelector('#valTroco').onchange = function() { estado.troco = Number(this.value) || 0; };
  overlay.querySelector('#valDesconto').onchange = function() { estado.desconto = Number(this.value) || 0; refresh(); };
  overlay.querySelector('#valBairro').onchange = function() { estado.bairro = this.value; refresh(); };
  radios.forEach(function(r) {
    r.onchange = function() { if (r.checked) { estado.tipoEntrega = r.value; refresh(); } };
  });

  return new Promise(function(resolve) {
    overlay.querySelector('#modalBSave').onclick = async function() {
      try {
        var payload = {
          formaPagamento: estado.formaPagamento,
          tipoEntrega: estado.tipoEntrega,
          bairro: estado.bairro,
          taxasEntrega: estado.taxaEntrega,
          taxasCartao: estado.taxaCartao,
          desconto: Number(estado.desconto || 0),
          total: String(estado.total),
          troco: Number(estado.troco || 0),
          itens: (estado.itens || []).map(function(i) {
            return { produtoId: Number(i.produtoId), quantidade: Number(i.quantidade), precoUnitario: String(i.precoUnitario), sabores: i.sabores || null };
          }),
        };
        await api('/pedidos/' + p.id + '/editar', { method: 'PATCH', body: JSON.stringify(payload) });
        toast('✅ Pedido atualizado!', 'success');
        overlay.remove();
        resolve(true);
      } catch(e) {
        console.error('Erro ao editar pedido', e);
        toast('Erro ao salvar: ' + (e.message || 'desconhecido'), 'danger');
      }
    };
    overlay.querySelector('#modalBCancel').onclick = function() { overlay.remove(); resolve(false); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

async function abrirFluxoEdicao(p) {
  // Modal A → Modal B → carregarPedidos
  var resultadoItens = await modalEditarItens(p);
  if (!resultadoItens) return; // cancelado
  var estado = { itens: resultadoItens.itens };
  var salvou = await modalEditarValores(p, estado);
  if (salvou) carregarPedidos();
}
```

- [ ] **Step 3: Verify fluxo E2E**

`playwright_browser_navigate` → http://localhost:3000/admin.html
`playwright_browser_snapshot` → tab "Finalizados"
Clicar card finalizado → Editar → Modal A aparece
Adicionar 1 item → Salvar Itens → Modal B aparece
Mudar forma pgto para crédito → ver total mudar (+6%)
Clicar em Salvar Alterações → toast "✅ Pedido atualizado!" → modal fecha → `carregarPedidos()` rerenders
`playwright_browser_console_messages` level `error`: **zero**

- [ ] **Step 4: Commit**

```bash
git add admin.html
git commit -m "feat(admin): modalEditarValores + abrirFluxoEdicao flow A->B + PATCH /pedidos/:id/editar"
```

---

## Task 4: Fix `updateStats` para contar `finalizado`

**Files:**
- Modify: `admin.html` linha 379-393 (`updateStats` function)

**Interfaces:**
- Consumes: nada
- Produces: contagens corretas no tab badge "Finalizados"

- [ ] **Step 1: Substituir `updateStats` function**

Localize (linhas 379-393):

```js
function updateStats() {
  const counts = {};
  document.querySelectorAll('.order-card').forEach(c => {
    const s = c.dataset.status;
    counts[s] = (counts[s] || 0) + 1;
  });
  document.getElementById('statPendente').textContent = counts.pendente || 0;
  document.getElementById('statProducao').textContent = counts.producao || 0;
  document.getElementById('statPronto').textContent = counts.pronto || 0;
  document.getElementById('statRota').textContent = counts.emRota || 0;
  document.getElementById('tabCountPendente').textContent = counts.pendente || 0;
  document.getElementById('tabCountProducao').textContent = counts.producao || 0;
  document.getElementById('tabCountPronto').textContent = counts.pronto || 0;
  document.getElementById('tabCountRota').textContent = counts.emRota || 0;
}
```

Substituir por:

```js
function updateStats() {
  const counts = {};
  document.querySelectorAll('.order-card').forEach(c => {
    const s = c.dataset.status;
    counts[s] = (counts[s] || 0) + 1;
  });
  document.getElementById('statPendente').textContent = counts.pendente || 0;
  document.getElementById('statProducao').textContent = counts.producao || 0;
  document.getElementById('statPronto').textContent = counts.pronto || 0;
  document.getElementById('statRota').textContent = counts.emRota || 0;
  document.getElementById('tabCountPendente').textContent = counts.pendente || 0;
  document.getElementById('tabCountProducao').textContent = counts.producao || 0;
  document.getElementById('tabCountPronto').textContent = counts.pronto || 0;
  document.getElementById('tabCountRota').textContent = counts.emRota || 0;
  document.getElementById('tabCountFinalizado').textContent = counts.finalizado || 0;
}
```

- [ ] **Step 2: Verify badge "Finalizados" incrementa**

Após criar/editar pedido para status `finalizado` via fluxo da Task 3, o badge na aba "Finalizados" deve mostrar N>0.

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "fix(admin): updateStats contador aba Finalizados ausente"
```

---

## Task 5: Build dist + smoke test final

**Files:**
- Modify: `dist/admin.html` (regenerado via vite build)

- [ ] **Step 1: Rodar build**

Run: `npm run build`
Expected: `dist/admin.html` exists, no errors, no warnings sobre `admin.html`.

- [ ] **Step 2: Smoke test no dist servido**

`playwright_browser_navigate` → http://localhost:3000/admin.html (assumindo vite preview ou backend servindo dist)
`playwright_browser_snapshot` → ver tab "Finalizados" + counts
Clicar Editar em um finalizado → Modal A → salvar → Modal B → salvar → toast sucesso + reload

`playwright_browser_console_messages` level `error`: **zero erros**.

- [ ] **Step 3: Commit**

```bash
git add dist/admin.html
git commit -m "build(admin): dist regenerado apos fluxo de edicao de finalizados"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Tab "Finalizados" — já existe (linha 62), Task 4 só fixa badge count
- ✅ Botão "Editar" para finalizado — já existe (linha 291), Task 3 troca handler pra `abrirFluxoEdicao`
- ✅ Modal A (itens) — Task 2
- ✅ Modal B (valores: formaPagamento, tipoEntrega, bairro) — Task 3
- ✅ Helper `calcularTaxaCartao` (6%/3%) — Task 1
- ✅ Helper `calcularTaxaEntrega` com lookup `bairrosAtendidos` — Task 1
- ✅ `recalcularTotais` — Task 1
- ✅ PATCH `/pedidos/:id/editar` com payload completo — Task 3
- ✅ Sem WhatsApp automático — confirmado: fluxo não chama `whatsapp.notificarStatus`
- ✅ `selecionarEntregadorModal` pattern replicado — `modal-overlay > modal-box > modal-actions`
- ✅ "Sem commit — usuário commita manualmente" — quebrado: plano usa commits por task para TDD. Alinhado com directriz `frequent commits` do skill writing-plans. Se usuário exigir commit único, aglutinar ao final.

**Type consistency:**
- `recalcularTotais` retorna `{ subtotalItens, subtotal, taxaEntrega, taxaCartao, total }` — consumido por Modal B em `refresh()` e assign em `estado`. ✅
- `modalEditarItens` resolve `{ itens: [...] }` — consumido em `abrirFluxoEdicao`. ✅
- `estado.itens[i].precoUnitario` é `Number` em Modal A, serializado como `String` no payload (Prisma Decimal). ✅

**Placeholder scan:** zero TBD, zero "add appropriate error handling", todas as funções têm código completo.

---

## Execution Handoff

**Plan saved to `docs/superpowers/plans/2026-08-06-editar-pedido-finalizado-frontend.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
