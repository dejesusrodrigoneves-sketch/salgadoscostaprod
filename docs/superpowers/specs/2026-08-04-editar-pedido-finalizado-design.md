# Edição de Pedido Finalizado — Design + Implementation Plan

**Data:** 2026-08-04
**Status:** Aprovado

## Goal

Permitir que admin, superadmin ou user editarem pedidos já finalizados — alterar forma de pagamento (com recálculo de juros de cartão), tipo de entrega (retirada ↔ delivery com taxa por bairro), e adicionar/editar/remover itens do pedido. Sem notificações automáticas ao cliente. Estoque é revertido ao remover itens (se o produto tem controle de estoque ativo).

## Contexto

Hoje `admin.html` mostra tabs para pedidos pendente/producao/pronto/emRota. Pedidos com status `finalizado` não têm tab própria e não aparecem mais. O sistema não tem `PATCH` para editar pedidos completos — só `PATCH /api/pedidos/:id/status` que muda o status e `POST /api/pedidos/:id/finalizar` que marca como finalizado. Toda edição pós-finalização hoje é impossível.

Decisões confirmadas com o usuário:
- Edição via **modal overlay** (padrão `selecionarEntregadorModal`) — não form inline.
- **Dois modais**: Modal A — itens (quantidade editável + remover item + adicionar novo via catálogo de produtos). Modal B — ajustar valores (forma pagamento, tipo entrega, bairro).
- Backend: nova rota `PATCH /api/pedidos/:id/editar` (authenticate, authorize superadmin/admin/user).
- Reverter estoque ao remover item (se o produto tem `controlaEstoque`, soma quantidade). Fazer baixa de estoque ao adicionar item (se o produto tem `controlaEstoque`, subtrai quantidade).
- Sem notificações automáticas — via clique admin manual.

### Regras de Juros e Taxa de Entrega

- **Crédito**: +6% sobre subtotal (itens + entrega)
- **Débito**: +3% sobre subtotal
- **Entrega (delivery)**: taxa do bairro via `GET /api/loja/settings-admin` (`bairrosAtendidos[].taxa`)
- **Retirada**: taxa de entrega = 0
- Fórmula: `subtotal = totalItens`, `total = subtotal + taxaEntrega + taxaCartao`
- `taxaCartao` = `percentual * subtotal` (não sobre total itens descontado)

## Arquitetura

Três camadas com padrão existente (controller/service/repository + page HTML standalone).

1. **Backend** — nova rota + controller + service para `PATCH /api/pedidos/:id/editar`. Recebe pedido completo recalculado e faz insert/delete de itens + reversão de estoque. Auditoria.
2. **Frontend** — nova tab "Finalizados" no `admin.html`, card com botão "Editar", dois modais sequenciais com os cálculos no client-side (replicando as funções de `cart.js` e `balcao.html` para taxa cartão e taxa entrega).
3. **Menu** — sem alvo (admin.html já existe).

## Data Flow

```
admin.html (tab finalizados)
  → fetch GET /api/pedidos?status=finalizado
  → render card "finalizado" com botão Editar
  → clica "Editar" → Modal A (itens):
      - lista itens + adiciona/remove
      - busca produtos: GET /api/produtos
      - salva → atualiza p.itens no state JS + recalcula subtotal
      - abre Modal B (valores):
        - select formaPagamento, radio tipoEntrega, select bairro
        - busca taxas bairro: GET /api/loja/settings-admin (bairrosAtendidos)
        - recalcula taxas + total
  → clica Salvar Alterações
  → PATCH /api/pedidos/:id/editar { formaPagamento, tipoEntrega, bairro, taxasEntrega, taxasCartao, desconto, total, troco, itens: [...], itensRemovidos: [{produtoId, quantidade}] }
  → backend edita pedido + itens + estoque se necessário
  → recarrega lista
```

## Componentes

### Backend

**`backend/src/routes/orderRoutes.js`** — add:
```js
router.patch('/:id/editar', authenticate, authorize('superadmin', 'admin', 'user'), controller.editarPedido);
```

**`backend/src/controllers/orderController.js`** — novo `exports.editarPedido`:
- recebe `req.body` (`formaPagamento`, `tipoEntrega`, `bairro`, `taxasEntrega`, `taxasCartao`, `desconto`, `total`, `troco`, `itens`, `itensRemovidos`)
- campos obrigatórios: `total`, `itens` (array)
- chama `orderService.editarPedido(id, body, getCtx(req))`
- retorna `res.json(resultado)`

**`backend/src/services/orderService.js`** — nova `async function editarPedido(id, data, ctx)`:
1. `const pedido = await sql.buscarPedido(id)` (se não existe → 404)
2. Atualiza pedido: `sql.atualizarPedido(id, { formaPagamento, troco, tipoEntrega, taxasEntrega, taxasCartao, desconto, total })`
3. **Estoque**:
   - **Itens removidos** (`data.itensRemovidos`): para cada `{produtoId, quantidade}`, se `produto.controlaEstoque`, soma `estoqueAtual += quantidade` (reversão).
   - **Itens novos** (presentes no novo array `data.itens` mas NÃO no pedido original): para cada novo item, se `produto.controlaEstoque`, subtrai `estoqueAtual -= quantidade` (baixa).
   - Usar `sql.buscarProduto` para verificar `controlaEstoque` + preço. `sql.atualizarProduto` para aplicar.
4. **Itens**: `prisma.itensPedido.deleteMany({ where: { pedidoId: id } })` + recriar itens com `prisma.itensPedido.createMany({ data: itens.map(...) })`
5. Auditoria `auditService.audit({ action: 'pasado.edit', ...})`

### Frontend — admin.html

**Nova tab:**
```html
<div class="tab" data-tab="finalizado"><i class="fas fa-check-double"></i> Finalizados <span class="tab-count" id="tabCountFinalizado">0</span></div>
```
Inserir após `#tabRota`.

**Card para status `finalizado`:**
- `order-actions` renderiza: **botão "Editar"** (`data-action="editar"`) + botão "Imprimir"

**Modal A — "Ajustar Itens do Pedido":**
- Função `abrirModalEditarItens(p)` (assíncrona)
  - overlay `.modal-overlay` > `.modal-box` (larga, 600px)
  - Lista itens atuais:
    - `itens.forEach` → exibe `produto.name`, input `qtd` (número), `precoUnitario` readonly, botão `❌` remove
    - subtotal itens recalculado em tempo rea
  - Seção "Adicionar": select produtos (fetch `GET /api/produtos`), input quantidade, botão "Adicionar"
  - Preview: novo total itens + valor total itens
  - Botões: Cancelar / Salvar Itens (fecha modal, atualiza `p.itens` no state)

**Modal B Editar Valores:**
- Função `modalEditarValores(p)`
- Pronto pós Modal A saved
  - `formaPagamento select` (dinheiro, pix, débito, crédito)
  - `tipoEntrega radio` (retirada, delivery)
  - `bairro select` (fetch bairrosAtendidos if delivery) — exclusivo ordenacao from API
  - Função `recalcularTotais()` → calcula taxas e mostra total
  - Botão "Salvar" → constrói payload → `api('/pedidos/' + docId + '/editar', { method: 'PATCH', body: JSON.stringify(payload) })`

**Funções auxiliares replicadas do cart**:**
- `calcularTaxaCartao(formaPagamento, subtotal) -> taxaCartao`
- `calcularTaxaEntrega(delivery, bairro, bairrosAtendidos) -> taxaEntrega`

### Testes

**`backend/tests/orderService.test.js`** (novo, Vitest):
- Foca em `editarPedido` com mock de prisma (mesmo padrão de `vi.mock` + helper puro). Como `entregaService.test.js` encontrou dificuldade com mock de prisma em CJS, o helper puro injetar se aproximará de algo: nova função `processarEdicaoPedido(pedido, data, buscarProdutoFn)` que aplica as alterações de valores e estoque, testável puramente. `editarPedido` no service vira thin wrapper.

## Erros / Edge Cases

- **Pedido já finalizado** → única validação requerida. Não restritivo.
- **Item removido de pedido que tem controle de estoque** → `estoqueAtual += quantidade` (não vira negativo por segurança, mas Prisma trata `>=0`).
- **Item adicionado com produto inexistente** → 404 via Prisma FK constraint.
- **Bairro selecionado que não existe mais na lista** → taxaEntrega = 0 (bairro removido da API ou não configurado).
- **Quantidade negativo/zero** → validação no frontend (ignorar no servidor se zero).

## Fora de Escopo

- Não alterar status finalizado (permanece `finalizado`).
- Não reenviar WhatsApp ao cliente ao editar (só via botão explícito no admin).
- Fazer baixa de estoque ao adicionar novos itens (se controle ativo).
- Não criar nova tab/página separada — fica dentro do admin.html.
- Sem commit — usuário valida e commita manualmente.

## Implementation Plan

### Task 1: Service Backend `editarPedido` com helper puro (TD4 passos)

**Files:**
- Create: `backend/tests/orderService.test.js`
- Modify: `backend/src/services/orderService.js` (add `editarPedido` + helper), `backend/src/controllers/orderController.js` (add `editarPedido`), `backend/src/routes/orderRoutes.js` (add `PATCH /:id/editar`)

**Steps:** Escreva os testes primeiro (provider pattern helper) → implement helper → wrap service → add de controller → add rota → validação sintaxe + teste – igual ao capítulo anterior, mas estruturalmente co-locado.

### Task 2: Modais e aba Finalizados no admin.html

**Modify:** `admin.html`

- [ ] Step 1: add tab "Finalizados" + `#finalizado` tab-content
- [ ] Step 2: alterar `carregarPedidos` para exibir status finalizado
- [ ] Step 3: implementar `modalEditarItens(p)` + `modalEditarValores(p)`
- [ ] Step 4: funções auxiliares `calcularTaxaCartao` + `calcularTaxaEntrega` internas
- [ ] Step 5: handler `[data-action="editar"]` que abre sequência

### 3: Teste manual E2E + build dist