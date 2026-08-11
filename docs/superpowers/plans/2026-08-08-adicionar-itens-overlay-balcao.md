# Adicionar Itens via Overlay do Balcão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar botão "Adicionar Item" no card de pedidos do admin (status `producao`) que abre overlay Bootstrap 5 + Tailwind com iframe do `balcao.html?embedded=1`, permitindo ao lojista selecionar produtos do catálogo e salvá-los no pedido existente — agrupando itens idênticos e mantendo combos como linhas separadas.

**Architecture:** Overlay Bootstrap 5 (modal-fullscreen) + Tailwind no `admin.html` embebe `balcao.html?embedded=1` em iframe. O balcão, no modo embedded, esconde o checkout e responde a `postMessage` enviando o carrinho. O admin agrupa os itens novos com os existentes (combos separados) e salva via `PATCH /api/pedidos/:id/editar`. Correção no `orderService.agruparItens` preserva linhas com sabores.

**Tech Stack:** Bootstrap 5.3.2 CDN, Tailwind Play CDN, Font Awesome, `postMessage` nativo, Express+Prisma (backend), Vitest (testes).

## Global Constraints

- **Sem commit** ao final (preferência do usuário).
- Não alterar APIs, regras de negócio, fluxos de carrinho, IDs de DOM de outras páginas.
- Overlay só visível/funcional quando `p.status === 'producao'`.
- Combo = `produto.type === 3 || produto.type === 6` (cart.js:322,353; balcao.html:76).
- Combos sempre linhas separadas (mesmo produtoId, mesmos sabores) — regra do usuário.
- Itens sem sabores agrupam por `produtoId`.
- Seletor de sabores dentro do iframe (não promovido).
- Fechar overlay (X/Esc/Cancelar) → sem PATCH, sem toast, sem recarregar.
- Botão "Salvar Alterações" desabilitado se carrinho vazio.
- Backend `orderService.agruparItens` muda (linhas com sabores não agrupam) — efeito colateral aceito p/ Modal A.
- Ambiente Windows + Git Bash; NÃO usar `grep`/`glob` tools do harness (quebradas) — usar `bash` com `grep -n`/`ls`.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `backend/src/services/orderService.js` | Regra de agrupamento de itens (combos separados) | Modificar `agruparItens` (142-158) |
| `backend/tests/orderService.test.js` | Testes vitest do agrupamento | Adicionar testes combos/sabores |
| `balcao.html` | Modo embedded: esconder checkout, responder postMessage | Modificar JS do balcão |
| `admin.html` | Preload Bootstrap+Tailwind, botão no card, overlay iframe, agrupamento, payload/editar | Modificar head, renderCard, + novas funções |

---

### Task 1: Backend — `orderService.agruparItens` preserva linhas com sabores

**Files:**
- Modify: `backend/src/services/orderService.js:142-158`
- Test: `backend/tests/orderService.test.js`

**Interfaces:**
- Consumes: `agruparItens(lista)` — lista de `{produtoId, quantidade, precoUnitario, sabores}` (padrão já existente do serviço)
- Produces: `agruparItens` retorna array agrupado: itens SEM `sabores` somam por `produtoId`; itens COM `sabores` ficam linhas separadas. `sabores` aceita string JSON (ex.: `'{"3":2}'`) ou objeto.

- [ ] **Step 1: Escrever teste falhando**

```js
import { describe, it, expect } from 'vitest';
import { agruparItens } from '../src/services/orderService.js';

describe('agruparItens', () => {
  it('agrupa itens sem sabores pelo produtoId', () => {
    const r = agruparItens([
      { produtoId: 1, quantidade: 2, precoUnitario: '10.00', sabores: null },
      { produtoId: 1, quantidade: 3, precoUnitario: '10.00', sabores: null },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].quantidade).toBe(5);
  });

  it('mantém combos com sabores como linhas separadas', () => {
    const r = agruparItens([
      { produtoId: 7, quantidade: 1, precoUnitario: '25.00', sabores: '{"3":2,"4":1}' },
      { produtoId: 7, quantidade: 1, precoUnitario: '25.00', sabores: '{"5":3}' },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].sabores).toBe('{"3":2,"4":1}');
    expect(r[1].sabores).toBe('{"5":3}');
  });

  it('combos com sabores idênticos continuam separados (regra do usuário)', () => {
    const r = agruparItens([
      { produtoId: 7, quantidade: 1, precoUnitario: '25.00', sabores: '{"3":2}' },
      { produtoId: 7, quantidade: 1, precoUnitario: '25.00', sabores: '{"3":2}' },
    ]);
    expect(r).toHaveLength(2); // mesmo sabores ainda separado (regra do usuário)
  });

  it('aceita sabores como objeto', () => {
    const r = agruparItens([
      { produtoId: 7, quantidade: 1, precoUnitario: '25.00', sabores: { 3: 2 } },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].sabores).toEqual({ 3: 2 });
  });
});
```

> `agruparItens` precisa estar no `module.exports` do `orderService.js` (adicionar a linha 309 em `Step 3`).

- [ ] **Step 2: Rodar teste → verificar falha**

Run: `npm test -- tests/orderService.test.js`
Expected: FAIL em 2 casos (combos fundidos hoje).

- [ ] **Step 3: Implementar `agruparItens` corrigido**

`backend/src/services/orderService.js:142-158` substituir por:

```js
function temSabores(i) {
  if (!i.sabores) return false;
  if (typeof i.sabores === 'string') return i.sabores.trim().length > 0 && i.sabores !== '{}' && i.sabores !== 'null';
  if (typeof i.sabores === 'object') return Object.keys(i.sabores).length > 0;
  return false;
}

function agruparItens(lista) {
  const resultado = [];
  (lista || []).forEach(function(i) {
    const pid = Number(i.produtoId);
    const has = temSabores(i);
    if (has) {
      // Combo/avulso: cada linha permanece separada (regra do usuário)
      resultado.push({
        produtoId: pid,
        quantidade: Number(i.quantidade),
        precoUnitario: String(i.precoUnitario ?? '0'),
        sabores: i.sabores ?? null,
      });
      return;
    }
    const existente = resultado.find((m) => Number(m.produtoId) === pid && !temSabores(m));
    if (existente) {
      existente.quantidade += Number(i.quantidade);
    } else {
      resultado.push({
        produtoId: pid,
        quantidade: Number(i.quantidade),
        precoUnitario: String(i.precoUnitario ?? '0'),
        sabores: i.sabores ?? null,
      });
    }
  });
  return resultado;
}
```

E adicionar `agruparItens` a `module.exports` no rodapé (linha ~309): `module.exports = { listar, buscar, criar, atualizarStatus, deletarPedido, finalizarPedido, listarFiltrado, darBaixaEstoque, processarEdicaoPedido, editarPedido, agruparItens };`

- [ ] **Step 4: Rodar testes novamente**

```bash
npm test
```
Expected: PASS (todos os 23 antigos + novos agrupamento).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/orderService.js backend/tests/orderService.test.js
git commit -m "fix: agruparItens preserva combos com sabores como linhas separadas"
```

---

## NOTA — Desvio da spec pelo usuário

Spec §2.6 previa `window.addEventListener('message')` no balcão e polling de 800ms com `postMessage({type:'SOLICITAR_ITENS'})`/`ITENS`. A spec foi revisitada durante o design até ficar consistente com o endpoint `/editar`. O plano segue a spec final. Em caso de conflito com premissas dos passos 1+ , pedir clarificação.

---

## Task 2: Balcão — modo embedded

**Files:**
- Modify: `balcao.html` (bloco `<script>` principal)

**Interfaces:**
- Consumes: URL param `?embedded=1`; variável interna `carrinho` (`[{id, nome, preco, qtd, type, sabores}]`)
- Produces: resposta `postMessage({type:'ITENS', itens})` — `itens` no formato admin (produtoId, quantidade, sabores json string, sem preçoUnitario)

- [ ] **Step 1: escrever teste falho?** — Não aplicável (frontend DOM): verificação manual. Em vez disso, estrutura de raciocínio:

- [ ] **Step 1: Adicionar detecção embedded no script do balcão**

Após a declaração de `let carrinho = [];` (linha 465) ou após as inicializações do fim do script, adicionar:

```js
// ===== MODO EMBEDDED (overlay admin) =====
const isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1';
if (isEmbedded) {
  // Esconde todo o checkout (retirada/delivery, formulário, resumo, finalizar)
  const elCheckout = document.querySelector('.checkout');
  if (elCheckout) elCheckout.style.display = 'none';
  // Esconde filtros extras? Não — mantém filtros e grid.

  window.addEventListener('message', function(e) {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === 'SOLICITAR_ITENS') {
      const itens = carrinho.map(function(item) {
        return {
          produtoId: item.id,
          quantidade: item.qtd,
          sabores: formatarParaAdmin(item.sabores),
        };
      });
      e.source.postMessage({ type: 'ITENS', itens: itens }, e.origin);
    }
  });
}

// Converte sabores [{nome, qtd}] -> string JSON {idSabor: qtd} (mesmo de formatarSabores)
function formatarParaAdmin(sabores) {
  if (!Array.isArray(sabores) || sabores.length === 0) return null;
  const obj = {};
  sabores.forEach(s => {
    const prod = todosProdutos.find(p => p.name === s.nome);
    obj[prod ? prod.id : s.nome] = Number(s.qtd) || 1;
  });
  return JSON.stringify(obj);
}
```

> `formatarParaAdmin` duplica a lógica de `formatarSabores` interna do finalizarPedido (linha 675); pegar a existente e expô-la p/ reuso:

- [ ] **Step 2 (refactor): extrair `formatarSabores` p/ escopo global**

Mover `function formatarSabores(sabores)` do interior de `finalizarPedido` (linha 674-683) para o escopo do script (mesma lógica, acima de `finalizarPedido`). Trocar a chamada em `finalizarPedido` para usar a função global (não mudar comportamento: `payload.itens` usa `formatarSabores(item.sabores)`).

- [ ] **Step 3: Verificação manual**

```bash
node --check balcao.html  # NOT válido p/ HTML — no-op
```

Verificação real:
- Iniciar servidor: `npm run dev` (backend) → abrir `http://localhost:3000/balcao.html?embedded=1`
- Grid de produtos aparece; checkout NÃO aparece; filtros OK.
- Com DevTools: `document.querySelector('.checkout')?.style.display === 'none'`.

- [ ] **Step 4: Commit**

```bash
git add balcao.html
git commit -m "feat: balcao embedded oculta checkout e responde postMessage itens"
```

---

## Task 3: Admin — preload Bootstrap+Tailwind + botão no card

**Files:**
- Modify: `admin.html`
  - `<head>` (linhas ~7-13): adicionar Bootstrap 5 CSS/JS + Tailwind CDN
  - `renderCard` (linha ~293): variável `podeAdicionarItem` + botão no bloco else (após "Excluir", ~350)
  - Handler `[data-action="add-item"]` (após linha ~428)

**Interfaces:**
- Consumes: `p.status`, `p.id`, `p.itens`, `p.bairro`/`cliente.bairro`, `p.formaPagamento`, `p.tipoEntrega`, `p.desconto`, `p.troco`
- Produces: função `abrirOverlayAdicionar(p, docId)` (Task 4) e botão renderizado quando `p.status === 'producao'`

- [ ] **Step 1: Preload stacks no `<head>`**

```html
<!-- Bootstrap 5 (overlay adicionar itens) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" defer></script>
<!-- Tailwind (overlay adicionar itens) -->
<script src="https://cdn.tailwindcss.com"></script>
```

Inserir após linha 13 (`<link rel="stylesheet" href="css/admin-page.css">`). O `defer` no bundle JS garante que `bootstrap.Modal` existe quando o overlay abre.

- [ ] **Step 2: Variável + botão no renderCard**

Acima do `card.innerHTML` (após linha 309 `const iconeCampo = ...`):

```js
const podeAdicionarItem = (p.status === 'producao');
```

No bloco não-pendente (linha 344), **após** o botão "Excluir" (linha 350):

```js
${podeAdicionarItem ? `<button class="btn btn-add-item" data-action="add-item"><i class="fas fa-plus"></i> Adicionar Item</button>` : ''}
```

- [ ] **Step 3: Handler do botão** (após o bloco `if (p.status === 'producao')` já existente ~linha 440)

```js
const btnAddItem = card.querySelector('[data-action="add-item"]');
if (btnAddItem) {
  btnAddItem.onclick = function() { abrirOverlayAdicionar(p, docId); };
}
```

- [ ] **Step 4: Verificação via `node --check` do JS embutido**

```bash
node --check <(sed -n '285,450p' admin.html | sed 's/<script[^>]*>//; s/<\/script>//') 2>/dev/null || echo "HTML-JS nao-autoparse-ok (ver manual)"
```

(Verificação sintática real: abrir admin.html no browser).

- [ ] **Step 5: Commit**

```bash
git add admin.html
git commit -m "feat: bootstrap/tailwind no admin + botão Adicionar Item no card (producao)"
```

---

## Task 4: Admin — overlay `abrirOverlayAdicionar(p, docId)`

**Files:**
- Modify: `admin.html` (nova função; colocar perto de `modalEditarItens`, ~linha 559)

**Interfaces:**
- Consumes: `p`, `docId`, `bootstrap.Modal`, `api()`, `toast()`, `carregarPedidos()`, `recalcularTotais()`, `agruparItensComNovos()`, `window.products`
- Produces: nenhuma export; efeitos colaterais (patch + toast + reload)

- [ ] **Step 1: Escrever função** (na área após `modalEditarItens`):

```js
function abrirOverlayAdicionar(p, docId) {
  // Remove modal anterior se existir
  var existing = document.getElementById('modalAdicionarItens');
  if (existing) existing.remove();

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
                    style="width:100%;height:calc(100vh - 140px);border:none;"></iframe>
          </div>
          <div class="modal-footer">
            <span class="text-muted" id="contadorNovosItens">0 itens selecionados</span>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="btnSalvarItens" disabled>Salvar Alterações</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  var modalEl = document.getElementById('modalAdicionarItens');
  if (typeof bootstrap === 'undefined') { toast('Bootstrap não carregou', 'danger'); return; }
  var modal = new bootstrap.Modal(modalEl);

  var btnSalvar = document.getElementById('btnSalvarItens');
  var contador = document.getElementById('contadorNovosItens');
  var novosItens = [];

  function onMessage(e) {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === 'ITENS' && Array.isArray(e.data.itens)) {
      novosItens = e.data.itens;
      novosItens.forEach(function(n) {
        var prod = (window.products || []).find(function(pr) { return pr.id === Number(n.produtoId); });
        n.precoUnitario = prod ? Number(prod.price) : 0;
      });
      btnSalvar.disabled = novosItens.length === 0;
      contador.textContent = novosItens.length + (novosItens.length === 1 ? ' item selecionado' : ' itens selecionados');
    }
  }
  window.addEventListener('message', onMessage);

  var pollTimer = setInterval(function() {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'SOLICITAR_ITENS' }, window.location.origin);
    }
  }, 800);

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
    var estado = {
      itens: consolidados,
      formaPagamento: p.formaPagamento || 'dinheiro',
      tipoEntrega: p.tipoEntrega || 'retirada',
      bairro: p.bairro || (p.cliente && p.cliente.bairro) || '',
      desconto: Number(p.desconto || 0),
      troco: Number(p.troco || 0),
    };
    var totais = recalcularTotais(estado);
    var payload = {
      formaPagamento: estado.formaPagamento,
      tipoEntrega: estado.tipoEntrega,
      bairro: estado.bairro,
      taxasEntrega: totais.taxaEntrega,
      taxasCartao: totais.taxaCartao,
      desconto: Number(estado.desconto || 0),
      total: String(totais.total),
      troco: Number(estado.troco || 0),
      itens: consolidados.map(function(i) {
        return {
          produtoId: Number(i.produtoId),
          quantidade: Number(i.quantidade),
          precoUnitario: String(i.precoUnitario),
          sabores: i.sabores || null,
        };
      }),
    };
    try {
      await api('/pedidos/' + docId + '/editar', { method: 'PATCH', body: JSON.stringify(payload) });
      modal.hide();
      toast('Itens adicionados!', 'success');
      carregarPedidos();
    } catch (e) {
      toast('Erro: ' + e.message, 'danger');
    }
  };

  modalEl.addEventListener('hidden.bs.modal', function() {
    clearInterval(pollTimer);
    window.removeEventListener('message', onMessage);
    modalEl.remove();
  });

  modal.show();
}
```

- [ ] **Step 2: Verificação**

Manual: abrir admin → pedido em produção → clicar botão → overlay abre com iframe; contador atualiza; salvar dispara PATCH; fechar (X/Esc) não faz nada.

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat: overlay adicionar itens admin (iframe balcao + postMessage)"
```

---

## Task 5: Admin — `agruparItensComNovos`

**Files:**
- Modify: `admin.html` (nova função, ao lado de `agruparItensAdmin` ~linha 128)

**Interfaces:**
- Consumes: `existentes` (`[{produtoId, quantidade, precoUnitario, sabores}]`), `novos` (mesmo, com `precoUnitario` preenchido pelo overlay)
- Produces: array consolidado `[{produtoId, quantidade, precoUnitario, sabores}]` — combos separados, itens sem sabor somados

- [ ] **Step 1: Escrever função**

```js
function agruparItensComNovos(existentes, novos) {
  var temSabor = function(i) {
    if (!i || !i.sabores) return false;
    if (typeof i.sabores === 'string') return i.sabores.length > 0 && i.sabores !== '{}' && i.sabores !== 'null';
    return Object.keys(i.sabores).length > 0;
  };
  var resultado = (existentes || []).map(function(i) { return Object.assign({}, i); });
  (novos || []).forEach(function(n) {
    if (temSabor(n)) {
      resultado.push(Object.assign({}, n));
      return;
    }
    var existente = resultado.find(function(i) {
      return Number(i.produtoId) === Number(n.produtoId) && !temSabor(i);
    });
    if (existente) {
      existente.quantidade += Number(n.quantidade);
    } else {
      resultado.push(Object.assign({}, n));
    }
  });
  return resultado;
}
```

- [ ] **Step 2: Verificação manual** — console: chamar `agruparItensComNovos` com casos (item repetido soma; combo com sabores vira linha nova).

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat: agruparItensComNovos admin (combos separados)"
```

---

## Task 6: Verificação fim a fim

**Files:**
- none (manual)

- [ ] **Step 1: Rodar suite backend**

```bash
cd backend && npm test
```
Expected: todos pass (23 antigos + novos agrupamento).

- [ ] **Step 2: Rodar server local**

```bash
npm run dev   # backend (servidor na porta 3000)
```

Abrir `http://localhost:3000/` (cardápio) e `http://localhost:3000/admin.html`.

- [ ] **Step 3: Teste manual completo**

1. Login admin (djesus/tsa110594).
2. Pedido em `producao` → card mostra "Adicionar Item". Pedido pendente/pronto/rota/finalizado/cancelado → NÃO mostra.
3. Clicar "Adicionar Item" → overlay fullscreen com catálogo do balcão (checkout oculto, filtros OK).
4. Adicionar produto normal ×2 → contador 2; Salvar → PATCH → pedido aparece com item agrupado (2x).
5. Adicionar combo com sabores → Salvar → linhas separadas no pedido. Combinar → 2 combos → sempre 2 linhas.
6. Fechar (X/Esc/Cancelar) → nada acontece (sem toast, sem PATCH).
7. Botão Salvar desabilitado com carrinho vazio.

- [ ] **Step 4: Sem commit** — Projeto entregue sem commit (constraint).

---

## Self-Review

- Spec coverage: botão (3), overlay (4), iframe balcão (2), agrupamento combos (1+5), payload/editar (4), fechar/full (4). ✔
- Placeholders: nenhum TBD/TODO; import do teste corrigido (`agruparItens` direto). ✔
- Type consistency: `produtoId` Number, `precoUnitario` String, `sabores` string|null. Mesmo em task 1 e 5. ✔
- Backend export: `module.exports` ganha `agruparItens` (test Do). ✔