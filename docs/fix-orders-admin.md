# Plano: Correção de Pedidos "Em Rota" Sumindo + Taxas de Cartão Não Repassadas

---

## Problema 1: Pedido some do admin.html ao ir para "Em Rota"

### Diagnóstico

O `carregarPedidos()` em `admin.html` distribui pedidos nos containers por status:

```js
const containers = {
  pendente: document.getElementById('pendente'),
  producao: document.getElementById('producao'),
  pronto:   document.getElementById('pronto'),
  emRota:   document.getElementById('emRota')   // ← KEY é "emRota"
};

// ...

pedidos.forEach(function(p) {
  var container = containers[p.status];  // p.status = "em_rota" (snake_case)
  if (!container) return;                // ← containers["em_rota"] é UNDEFINED → pedido SOME
});
```

**Causa raiz:** o status armazenado no banco é `'em_rota'` (snake_case, com underscore), mas a chave do container é `emRota` (camelCase). A busca `containers['em_rota']` retorna `undefined`, e o pedido é silenciosamente ignorado.

### Correção

Trocar a chave do container para `'em_rota'` (manter o `id="emRota"` do HTML, só a chave do objeto muda):

**Arquivo:** `admin.html` (~linha 750)

```js
const containers = {
  pendente: document.getElementById('pendente'),
  producao: document.getElementById('producao'),
  pronto:   document.getElementById('pronto'),
  'em_rota': document.getElementById('emRota')   // ← key agora bate com p.status
};
```

---

## Problema 2: Taxas de cartão não chegam no admin

### Diagnóstico

O `cart.js` calcula a taxa corretamente (crédito 6%, débito 3%) e exibe no resumo, mas **não envia** os valores financeiros no payload:

```js
// cart.js ~linha 799 — payload enviado ao backend
const payload = {
  clienteNome, clienteEndereco, clienteNumero, clienteBairro,
  clienteCep, clienteReferencia, tipoEntrega, formaPagamento, troco, itens
  // ❌ FALTAM: taxasEntrega, taxasCartao, desconto, total
};
```

O backend `publicController.criarPedido()` então hardcoda tudo como zero:

```js
taxasEntrega: 0,   // ← deveria vir do frontend
taxasCartao: 0,     // ← deveria vir do frontend
desconto: 0,        // ← deveria vir do frontend
total: valoresItens, // ← só soma dos itens, sem taxa entrega/cartão/desconto
```

**Resultado:** admin.html mostra `taxaCartao: R$ 0,00` mesmo para pedidos pagos com cartão, e o `total` no banco é menor que o valor real.

### Correção — 2 arquivos

#### 2a. Frontend `js/cart.js` — incluir valores financeiros no payload

Adicionar ao objeto `payload` em `generateOrder()` (~linha 811):

```js
const payload = {
  // ... campos existentes ...
  itens: cart.map(...),
  // NOVOS campos financeiros
  taxasEntrega: deliveryValueLocal,
  taxasCartao: taxaCartaoLocal,
  desconto: desconto,
  total: totalFinal,
};
```

#### 2b. Backend `publicController.js` — aceitar valores do payload

Em `criarPedido()` (~linha 101), extrair os novos campos e usá-los no lugar dos hardcoded zeros:

```js
exports.criarPedido = [authenticatePublic, asyncHandler(async (req, res) => {
  const {
    clienteNome, clienteEndereco, clienteNumero, clienteBairro, clienteCep,
    clienteReferencia, tipoEntrega, formaPagamento, troco, itens,
    taxasEntrega, taxasCartao, desconto, total   // ← extrair do body
  } = req.body;

  // ... calcular valoresItens a partir dos itens no banco ...

  const pedido = await prisma.pedido.create({
    data: {
      // ... campos existentes ...
      valoresItens,
      taxasEntrega: taxasEntrega !== undefined ? Number(taxasEntrega) : 0,
      taxasCartao: taxasCartao !== undefined ? Number(taxasCartao) : 0,
      desconto: desconto !== undefined ? Number(desconto) : 0,
      total: total !== undefined ? Number(total) : valoresItens,
      // ...
    },
  });
})];
```

---

## Arquivos alterados

| Arquivo | Linha(s) | Mudança |
|---------|----------|---------|
| `admin.html` | ~750 | Container key `emRota` → `'em_rota'` |
| `js/cart.js` | ~799-811 | Adicionar `taxasEntrega`, `taxasCartao`, `desconto`, `total` no payload |
| `backend/src/controllers/publicController.js` | ~101-138 | Extrair e usar `taxasEntrega`, `taxasCartao`, `desconto`, `total` do body |

---

## Ordem de implantação

1. **`admin.html`** — corrigir key do container `em_rota` (2 segundos, 1 linha)
2. **`js/cart.js`** — adicionar campos financeiros ao payload
3. **`publicController.js`** — aceitar e usar campos financeiros no create
4. **Testar**: criar pedido no cart com cartão → ver taxa no admin → ver pedido na aba Em Rota
5. **Commit**

---

## Observações

- O bug do "Em Rota" é puramente no frontend: a chave do objeto não bate com o valor do status. Basta alinhar.
- O bug das taxas é bilateral: frontend não envia, backend não espera. Corrigir os dois.
- Após a correção, pedidos antigos continuarão com `taxasCartao: 0` (dados históricos). Apenas pedidos novos serão corrigidos.
- O valor `total` enviado pelo frontend já inclui itens + entrega + cartão - desconto (cálculo feito em `cart.js:797`).

---
