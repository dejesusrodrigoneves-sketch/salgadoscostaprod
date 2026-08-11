# Adicionar Itens via Overlay do Balcão — Design

> **Status:** APROVADO — 08/08/2026
> **Sem commit** ao final da implementação (preferência do usuário)

## Goal

Permitir que o lojista adicione itens a um pedido existente (em produção) abrindo um overlay que exibe o catálogo do `balcao.html` dentro de um iframe, agrupando itens idênticos e mantendo combos como linhas separadas.

## Architecture

Overlay Bootstrap 5 + Tailwind CSS no `admin.html` contém um `<iframe src="balcao.html?embedded=1">`. O iframe mostra apenas o grid de produtos + filtros + seletor de sabores (tudo abaixo de retirada/delivery é oculto). O usuário seleciona produtos no iframe; ao clicar "Salvar Alterações" no overlay, o iframe envia os itens via `postMessage` ao documento pai, que os agrupa com os itens atuais do pedido (combos sempre separados), e envia `PATCH /api/pedidos/:id`.

**Comunicação:** `postMessage` bidirecional, same-origin. Validado por `e.origin !== window.location.origin`.

**Identificação de combo:** `produto.type === 3 || produto.type === 6`.

## Tech Stack

- Bootstrap 5 (CDN: `cdn.jsdelivr.net/npm/bootstrap@5.3.2`)
- Tailwind CSS (CDN Play/JIT: `cdn.tailwindcss.com`)
- Font Awesome + Bootstrap Icons (já no admin.html)
- Express + Prisma (backend existente, sem mudança)
- `postMessage` API (nativo do navegador)

## Global Constraints

- **Sem commit** ao final da implementação.
- Não alterar APIs, regras de negócio, fluxos de carrinho, ou IDs de DOM usados por outras páginas.
- Reutilizar padrões visuais existentes no admin.html (paleta laranja `--primary: #F26D3D`).
- Overlay só visível e funcional quando `p.status === 'producao'`.
- Combos (`type 3 ou 6`) sempre linhas separadas, mesmo que sabores coincidam.
- Seletor de sabores do combo fica **dentro do iframe** (não promovido ao pai).

---

## 1. Modificações no `balcao.html`

### 1.1 Detecção de modo embedded

Na inicialização do JS do balcao (após `carregarProdutos()` / `criarFiltros()` / `renderizarProdutos()`), adicionar:

```js
var isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1';
if (isEmbedded) {
  // Esconde todo o checkout (retirada/delivery, formulário, total, finalizar)
  var checkout = document.querySelector('.checkout');
  if (checkout) checkout.style.display = 'none';
  // Remove redirect para admin.html e POST /api/pedidos (não aplica aqui)
  // — o fluxo de finalizarPedido() nunca é chamado (botão removido)
}
```

### 1.2 Listener `postMessage`

Adicionar no JS do balcao, dentro do bloco `isEmbedded`:

```js
window.addEventListener('message', function(e) {
  if (e.origin !== window.location.origin) return;
  if (e.data && e.data.type === 'SOLICITAR_ITENS') {
    // Transforma carrinho interno no formato esperado pelo admin
    var itens = carrinho.map(function(item) {
      return {
        produtoId: item.id,
        quantidade: item.qtd,
        sabores: item.sabores ? formatarSabores(item.sabores) : null,
        // precoUnitario será buscado pelo admin em window.products (fonte confiável)
      };
    });
    e.source.postMessage({ type: 'ITENS', itens: itens }, e.origin);
  }
});
```

> `formatarSabores` já existe no balcão (linha 703). `carrinho` é a variável global do balcão.

### 1.3 Sem alterações de CSS

Não modificar `balcao.css`. Apenas `display:none` inline em `.checkout` quando embedded.

**Arquivo:** `balcao.html` (modificar o bloco `<script>` principal)

---

## 2. Modificações no `admin.html`

### 2.1 Preload de Bootstrap 5 + Tailwind no `<head>`

Adicionar no `<head>` do admin.html (após os `<link>` existentes, linha ~13):

```html
<!-- Bootstrap 5 (overlay de adicionar itens) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" defer></script>
<!-- Tailwind (overlay de adicionar itens) -->
<script src="https://cdn.tailwindcss.com"></script>
```

> Tailwind Play CDN auto-injeta classes sob demanda. Não afeta tokens existentes (`tokens.css`, `admin-page.css`).

### 2.2 Botão "Adicionar Item" no card (`renderCard`, linha ~340-352)

Adicionar variável antes do `card.innerHTML`:
```js
const podeAdicionarItem = (p.status === 'producao');
```

No ramo `else` (não-pendente, linha 344-351), inserir botão **após** "Excluir":
```js
${podeAdicionarItem ? `<button class="btn btn-add-item" data-action="add-item"><i class="fas fa-plus"></i> Adicionar Item</button>` : ''}
```

### 2.3 Handler do botão `data-action="add-item"`

No bloco de associação de handlers (após `card.querySelector('[data-action="delete"]')`, linha ~421), adicionar condicional:

```js
var btnAddItem = card.querySelector('[data-action="add-item"]');
if (btnAddItem) {
  btnAddItem.onclick = function() { abrirOverlayAdicionarItens(p, docId); };
}
```

### 2.4 Função `abrirOverlayAdicionarItens(p, docId)`

Nova função. Cria o modal Bootstrap, injeta iframe, gerencia comunicação:

```js
function abrirOverlayAdicionarItens(p, docId) {
  // Remove modal anterior se existir
  var existing = document.getElementById('modalAdicionarItens');
  if (existing) existing.remove();

  var modalHtml = `
    <div class="modal fade" id="modalAdicionarItens" tabindex="-1">
      <div class="modal-dialog modal-fullscreen">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Adicionar Itens — Pedido #${docId.slice(-6)}</h5>
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
  var modal = new bootstrap.Modal(modalEl);

  var iframe = document.getElementById('iframeBalcao');
  var btnSalvar = document.getElementById('btnSalvarItens');
  var contador = document.getElementById('contadorNovosItens');
  var novosItens = [];

  // Handler de mensagens do iframe
  function onMessage(e) {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === 'ITENS' && Array.isArray(e.data.itens)) {
      novosItens = e.data.itens;
      // Busca precoUnitario em window.products (fonte confiável)
      novosItens.forEach(function(n) {
        var prod = (window.products || []).find(function(pr){ return pr.id === Number(n.produtoId); });
        n.precoUnitario = prod ? Number(prod.price) : 0;
      });
      btnSalvar.disabled = (novosItens.length === 0);
      contador.textContent = novosItens.length + (novosItens.length === 1 ? ' item selecionado' : ' itens selecionados');
    }
  }
  window.addEventListener('message', onMessage);

  // Polling: a cada 800ms pede itens ao iframe (para manter contador sincronizado)
  var pollTimer = setInterval(function() {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'SOLICITAR_ITENS' }, window.location.origin);
    }
  }, 800);

  // Salvar
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

    // Recalcula total (reusa função existente recalcularTotais — admin.html:525)
    var estado = {
      itens: consolidados,
      formaPagamento: p.formaPagamento || 'dinheiro',
      tipoEntrega: p.tipoEntrega || 'retirada',
      bairro: p.bairro || p.cliente?.bairro || '',
      desconto: Number(p.desconto || 0),
      troco: Number(p.troco || 0),
    };
    var totais = recalcularTotais(estado);
    estado.taxaEntrega = totais.taxaEntrega;
    estado.taxaCartao = totais.taxaCartao;
    estado.total = String(totais.total);

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

  // Limpeza ao fechar (X, Esc, Cancelar)
  modalEl.addEventListener('hidden.bs.modal', function() {
    clearInterval(pollTimer);
    window.removeEventListener('message', onMessage);
    modalEl.remove();
  });

  modal.show();
}
```

### 2.5 Função `agruparItensComNovos`

Nova função (estende lógica de `agruparItensAdmin`, admin.html:135). Combos sempre linhas separadas:

```js
function agruparItensComNovos(existentes, novos) {
  var produtos = window.products || [];
  var resultado = existentes.map(function(i) { return Object.assign({}, i); });
  for (var idx = 0; idx < novos.length; idx++) {
    var n = novos[idx];
    var prod = produtos.find(function(pr) { return pr.id === Number(n.produtoId); });
    var isCombo = prod && (prod.type === 3 || prod.type === 6);
    if (isCombo) {
      // Combo → sempre nova linha, mesmo que produtoId já exista
      resultado.push(Object.assign({}, n));
    } else {
      var existente = resultado.find(function(i) {
        return Number(i.produtoId) === Number(n.produtoId) && !i.sabores && !n.sabores;
      });
      if (existente) {
        existente.quantidade += Number(n.quantidade);
      } else {
        resultado.push(Object.assign({}, n));
      }
    }
  }
  return resultado;
}
```

> **Sem sabores agrupa por produtoId. Com sabores (combo/avulso) → nova linha.** Coincide com a regra do usuário: "combos de forma separada mesmo".

### 2.6 Backend — `orderService.agruparItens` (mudança necessária)

**Problema:** `orderService.agruparItens` (orderService.js:142-158) agrupa por `produtoId` somente, ignorando `sabores`. Combos (`type 3 ou 6`) com sabores distintos seriam fundidos em 1 linha quando chegam ao PATCH — contraria regra do usuário "combos de forma separada mesmo".

**Mudança:** agrupar por `produtoId` **apenas quando a linha não tem `sabores`**. Itens com `sabores` (combos/avulsos) permanecem linhas separadas.

```js
function agruparItens(lista) {
  const resultado = [];
  (lista || []).forEach(function(i) {
    const pid = Number(i.produtoId);
    const temSabores = !!(i.sabores && (typeof i.sabores === 'string' ? i.sabores.length > 0 : Object.keys(i.sabores).length > 0));
    if (temSabores) {
      // Combo/avulso: cada linha permanece separada (regra do usuário)
      resultado.push({
        produtoId: pid,
        quantidade: Number(i.quantidade),
        precoUnitario: String(i.precoUnitario ?? '0'),
        sabores: i.sabores ?? null,
      });
      return;
    }
    const existente = resultado.find((m) => Number(m.produtoId) === pid && !m.sabores);
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

**Efeito colateral aceito (usuário confirmou):** o Modal A (`modalEditarItens`) também envia itens do mesmo combo — a partir da muda, combos no Modal A também ficam separados em linhas quando têm sabores distintos. Comportamento desejado.

**Arquivo:** `backend/src/services/orderService.js:142-158`

### 2.7 Backend — endpoint PATCH

Usar **`PATCH /api/pedidos/:id/editar`** (orderRoutes.js:17, authorize admin/user/superadmin). Exige `{total, itens}` (orderController.js:64-65). Payload completo replicado do fluxo atual Modal B (admin.html:782-794):

```js
{ formaPagamento, tipoEntrega, bairro, taxasEntrega, taxasCartao, desconto, total: String, troco, itens: [{produtoId, quantidade, precoUnitario: String, sabores}] }
```

`total` recalculado via `recalcularTotais()` existente (admin.html:525-537) para refletir os itens consolidados. `orderService.editarPedido` valida e aplica.

---

## 3. Fluxo de uso

1. Lojista vê pedido em **produção** no admin.
2. Clica **"Adicionar Item"** no card.
3. Overlay full-screen abre com iframe do `balcao.html?embedded=1`.
4. Grid de produtos + filtros + seletor de sabores aparecem (checkout oculto).
5. Lojista clica em produtos → balcão interno adiciona ao carrinho do iframe.
6. Contador no rodapé sincroniza ("3 itens selecionados"); botão "Salvar Alterações" habilita.
7. Lojista clica **Salvar** → iframe envia itens → admin agrupa → `PATCH /api/pedidos/:id/editar` → fecha → recarrega.
8. Ou: lojista clica **X / Esc / Cancelar** → fecha sem alteração, sem PATCH, sem toast.

---

## 4. Regras consolidadas

| Regra | Valor |
|---|---|
| Botão visível quando | `p.status === 'producao'` |
| Overlay stack | Bootstrap 5 + Tailwind (CDN) |
| Iframe mostra | `.produtos-area` (grid + filtros + seletor sabores) |
| Iframe esconde | `.checkout` inteiro |
| Seletor de sabores | Dentro do iframe |
| Combos (`type 3 ou 6`) | Sempre linhas separadas |
| Itens sem sabores | Agrupados por `produtoId` |
| Botão "Salvar" | Desabilitado se carrinho vazio |
| Fechar (X/Esc/Cancelar) | Sem PATCH, sem toast |
| Salvar com sucesso | `PATCH /api/pedidos/:id/editar` + toast + recarregar |
| Backend | `orderService.agruparItens` preserva linhas com sabores (combos separados) + reutiliza `PATCH /api/pedidos/:id/editar` |
| Commit ao final | **Não** |

---

## 5. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `admin.html` | `<head>` preload Bootstrap+Tailwind; `renderCard` botão "Adicionar Item"; função `abrirOverlayAdicionarItens`; função `agruparItensComNovos` |
| `balcao.html` | Detecção `?embedded=1`; hide `.checkout`; listener `postMessage` |
| `backend/src/services/orderService.js` | `agruparItens` preserva linhas com sabores (combos separados) |
| `backend/src/services/orderService.test.js` | Casos novos: combos com sabores distintos ficam separados |

---

## 6. Riscos

1. **Iframe altura**: `calc(100vh - 140px)` deixa espaço p/ header+footer do Bootstrap. Em mobile pequeno, seletor de sabores pode precisar scroll — aceitável (dentro do iframe).
2. **Tailwind CDN weight**: ~300KB de JS. Aceitável para feature admin.
3. **Polling 800ms**: levemente reativo. Alternativa seria evento `postMessage` só ao mudar carrinho — mas requer hook em `adicionarAoCarrinho` do balcão. Polling é mais desacoplado e robusto.
4. **Conflito de CSS Bootstrap × admin.html** — decisão explícita:
   - Bootstrap 5 define `.btn`, `.modal`, `.container` globalmente. `admin.html` já usa `.btn` custom em `admin-page.css`.
   - **Risco real**: prearregar Bootstrap CSS no `<head>` global pode **reestilizar TODOS os botões admin** (não só o overlay).
   - **Decisão**: carregar Bootstrap CSS **no `<head>`**, mas **depois** de `admin-page.css` para que este último prevaleça por ordem de cascata quando houver selectors de mesma especificidade. Exceção: classes do overlay (`.modal-*`, `.btn-close`, `.btn-primary` do Bootstrap) sobrescrevem apenas elementos dentro do overlay (que usam classes Bootstrap exclusivas).
   - **Fallback se houver regressão visual**: encapsular estilos Bootstrap só no overlay injetando o `<link>` **dentro do `modalHtml`** via `<style>` import ou `bootstrap.rtl.min.css` scoped — ou, alternativa mais simples, testar manualmente e adicionar regras de override em `<style>` inline no `modalHtml` para neutralizar conflitos específicos.
   - **Ação recomendada**: testar manualmente após implementação; se quebrar, mitigar antes de concluir.

---

## 7. Fora de escopo

- Editar itens pelo overlay (só adicionar; editar continua pelo fluxo atual Modal A).
- Alterar outras regras do backend (a mudança em `agruparItens` é mínima e específica a sabores).
- Redirecionar balcão autônomo (continua criando pedidos novos quando aberto diretamente).
- Promover seletor de sabores para fora do iframe.
- Commit.
