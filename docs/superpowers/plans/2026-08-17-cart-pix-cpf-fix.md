# Plano: Correções cart.html — CPF Estilizado + Taxa PIX no Total

## Contexto
- Branch: `feat/pix-asaas` (uncommitted changes)
- Single-tenant: `empresaId = 1`
- PIX flow funcionando: checkout CPF → Asaas PIX charge → QR → webhook confirma → pedido em `producao`

## Decisões Confirmadas
| Item | Decisão |
|---|---|
| Taxa PIX | Somar ao total (como cartão) |
| Taxa PIX origem | Backend calcula e retorna ao criar PIX |
| Percentual default | 2% (`ASAAS_PIX_FEE_PERCENT=2` no `.env`) |
| Campo CPF | Mesmo estilo dos outros inputs (`cart-page.css`) |

---

## Tasks

### Task 1: CSS — Estilizar campo CPF
**Arquivo**: `css/cart-page.css`

**Mudanças**:
- Linha 7: adicionar `#campoCPF` na lista de containers
- Linhas 12-25: adicionar `#campoCPF label` nos estilos de label
- Linhas 27-42: adicionar `#campoCPF input` nos estilos de input
- Linhas 44-54: adicionar `#campoCPF input:focus` nos estilos de focus

**Verificação**: Abrir `cart.html`, selecionar PIX → campo CPF aparece com mesmo visual dos outros campos.

---

### Task 2: Config Backend — Percentual taxa PIX
**Arquivo**: `backend/src/config/env.js`

**Mudança**: Após `asaasPixExpiryMin` (linha ~20), adicionar:
```js
asaasPixFeePercent: Number(process.env.ASAAS_PIX_FEE_PERCENT) || 2,
```

**Verificação**: `node -e "require('dotenv').config(); console.log(require('./backend/src/config/env.js').asaasPixFeePercent)"` retorna `2`.

---

### Task 3: Service Backend — Calcular e retornar taxaServico
**Arquivo**: `backend/src/services/paymentService.js`

**Mudança em `criarPixPedido` (linhas 16-52)**:
1. Calcular `taxaServico = Math.round(valor * env.asaasPixFeePercent / 100 * 100) / 100` (2 casas decimais)
2. Incluir `taxaServico` no objeto retornado (linha 51):
```js
return { ...pagamento, taxaServico };
```

**Verificação**: Test unitário ou manual — criar PIX retorna objeto com `taxaServico` numérico.

---

### Task 4: Controller Backend — Incluir taxaServico na resposta
**Arquivo**: `backend/src/controllers/publicController.js`

**Mudança**: No branch PIX do `criarPedido` (após linha ~280 onde chama `criarPixPedido`), incluir `taxaServico` na resposta JSON:
```js
res.status(201).json({
  id: pedido.id,
  pagamento: {
    paymentId: pagamento.id,
    pixCode: pagamento.pixCode,
    pixQrCode: pagamento.pixQrCode,
    expiresAt: pagamento.expiresAt,
    taxaServico: pagamento.taxaServico  // NOVO
  }
});
```

**Verificação**: POST `/api/public/pedidos` com `formaPagamento=pix` retorna `taxaServico` no JSON.

---

### Task 5: Frontend HTML — Adicionar caixa taxa PIX
**Arquivo**: `view/cart.html`

**Mudança**: Após linha 81 (`taxaCartaoBox`), adicionar:
```html
<div class="item" id="taxaPixBox" style="display:none;">
  <p>Taxa de serviço PIX: <span id="showTaxaPix">Carregando...</span></p>
</div>
```

**Verificação**: Elemento existe no DOM (inspecionar).

---

### Task 6: Frontend JS — updateValores() branch PIX
**Arquivo**: `js/cart.js`

**Mudanças em `updateValores()` (linhas 133-178)**:
1. Adicionar `else if (formaPagamento.value === "pix")` após bloco cartão
2. Mostrar `#taxaPixBox` e preencher `#showTaxaPix` com valor formatado
3. Somar `taxaPix` ao `totalComDesconto`
4. Variável `taxaPix` no escopo do módulo (linha ~6)

**Lógica**:
```js
let taxaPix = 0; // topo do arquivo

// em updateValores():
} else if (formaPagamento.value === "pix") {
  // taxaPix será preenchida após createOrder (resposta backend)
  // por enquanto mostra 0 ou valor cacheado
  document.getElementById("taxaPixBox").style.display = "block";
  document.getElementById("showTaxaPix").textContent =
    "+ R$ " + taxaPix.toFixed(2).replace(".", ",");
  totalComDesconto += taxaPix;
} else {
  taxaPix = 0;
  document.getElementById("taxaPixBox").style.display = "none";
}
```

**Verificação**: Selecionar PIX no dropdown → aparece "Taxa de serviço PIX: + R$ 0,00" e soma ao total.

---

### Task 7: Frontend JS — generateOrder() ler e exibir taxaServico
**Arquivo**: `js/cart.js`

**Mudança em `generateOrder()` (após linha 814 onde recebe `result`)**:
```js
if (result.pagamento && result.pagamento.taxaServico !== undefined) {
  taxaPix = Number(result.pagamento.taxaServico);
  document.getElementById("showTaxaPix").textContent =
    "+ R$ " + taxaPix.toFixed(2).replace(".", ",");
  document.getElementById("taxaPixBox").style.display = "block";
  updateValores(); // recalcula total com taxa real
}
```

**Posição**: Antes de `mostrarPagamentoPix()` / `mostrarConfirmacaoPedido()`.

**Verificação**: Fluxo completo PIX → overlay mostra QR + taxa PIX correta no resumo + total atualizado.

---

## Constraints Globais
- **No commits** — todas mudanças uncommitted
- **Single-tenant** — `empresaId = 1` hardcoded
- **ESM modules** — backend usa `import`/`export`; frontend CJS
- **Testes existentes** — não quebrar `orderService.test.js`, `sqlRepository.test.js` (52/54 passam)
- **Prisma** — `npx prisma generate` após schema changes (não aplicável aqui)

---

## Ordem de Execução
1 → 2 → 3 → 4 → 5 → 6 → 7 (dependências lineares: backend antes do frontend que consome)