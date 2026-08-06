# Edição de Pedido em Produção — Design + Implementation Plan

**Data:** 2026-08-04 (atualizado 2026-08-06)
**Status:** Aprovado — edição passa a ser exclusiva para status `producao`

## Goal

Permitir que admin, superusuario ou user editarem pedidos **com status `producao`** — alterar forma de pagamento (com recálculo de juros de cartão), tipo de entrega (retirada ↔ delivery com taxa por bairro), e adicionar/editar/remover itens do pedido. Sem notificações automáticas ao cliente. Estoque revertido ao remover itens e baixa ao adicionar (se o produto tem controle de estoque ativo).

**Regra de edição:** A edição de itens do carrinho é permitida **somente quando o pedido está em `producao`**. Pedidos em `pronto`, `em_rota` e `finalizado` **não** podem editar itens.

## Contexto

Hoje `admin.html` mostra pedidos pendente/producao/pronto/emRota. O sistema não tem `PATCH` para editar pedidos completos — só `PATCH /api/pedidos/:id/status` e `POST /api/pedidos/:id/finalizar`. Toda edição de itens hoje é impossível.

Decisões confirmadas com o usuário:
- Edição via **Dois modais** (padrão `selecionarEntregadorModal`) — não interface.
- **Modal A** — itens (quantidade editável + remover + adicionar via catálogo). **Modal B** — valores (forma pagamento, tipo entrega, bairro).
- **Botão "Editar" visível apenas quando `status === 'producao'`** (renderização condicional). Ausência de botão para pronto/em rota/finalizado.
- Backend: rota `PATCH /api/pedidos/:id/editar` (authenticate, authorize superadmin/admin/admin).
- Estoque: reverter ao remover item (soma, se `controlaEstoque`); baixa ao adicionar item (subtrai, se `controlaEstoque`).
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
2. **Frontend** — card no status `producao` com botão "Editar", dois modais sequenciais com cálculos no client-side (replicando `cart.js` e `balcao.html` para taxa cartão e taxa entrega).
3. **Menu** — sem alvo (admin.html já existe).

## Data Flow

```
admin.html (aba Produção — pedidos status producao)
  → card "producao" com botão Editar (somente status producao)
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

**Card para status `producao`:**
- `order-actions` renderiza: **botão "Editar"** (`data-action="editar"`) **somente quando `p.status === 'producao'`** + botões padrão (Produção/Pronto/Em Rota/Finalizar/Imprimir/Excluir).
- Botão ausente para `pronto`, `em_rota`, `finalizado`.

**Modal A — "Ajustar Itens do Pedido":**
- Função `modalEditarItens(p)` (assíncrona)
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

- **Pedido com status ≠ `producao`** → botão Editar não renderizado no frontend. Backend pode validar (se desejado) que só edita `producao`.
- **Item removido de pedido que tem controle de estoque** → `estoqueAtual += quantidade` (não vira negativo por segurança, mas Prisma trata `>=0`).
- **Item adicionado com produto inexistente** → 404 via Prisma FK constraint.
- **Bairro selecionado que não existe mais na lista** → taxaEntrega = 0 (bairro removido da API ou não configurado).
- **Quantidade negativo/zero** → validação no frontend (ignorar no servidor se zero).

## Fora de Escopo

- Não alterar status do pedido ao editar (permanece `producao`).
- Não editar pedidos em `pronto`, `em_rota` ou `finalizado`.
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

### Task 2: Modais e botão Editar no admin.html

**Modify:** `admin.html`

- [ ] Step 1: renderizar botão "Editar" (`data-action="editar"`) **somente quando `p.status === 'producao'`** no card de pedido
- [ ] Step 2: implementar `modalEditarItens(p)` + `modalEditarValores(p)`
- [ ] Step 3: funções auxiliares `calcularTaxaCartao` + `calcularTaxaEntrega` internas
- [ ] Step 4: handler `[data-action="editar"]` que abre sequência

### 3: Teste manual E2E + build dist