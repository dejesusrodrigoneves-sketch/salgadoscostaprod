# Melhorias para o Projeto

## 🔴 Críticas — Corrigir Bugs Financeiros

### 1. Enviar valores calculados no payload do pedido

**Arquivo:** `js/cart.js` — função `generateOrder()`

O payload em `cart.js:850-865` precisa incluir `valoresItens`, `taxasEntrega`, `taxasCartao`, `desconto` e `total`. O backend (`publicController.js`) deve receber e armazenar esses valores ao invés de hardcodar zeros.

```diff
- taxasEntrega: 0,
- taxasCartao: 0,
- desconto: 0,
- total: valoresItens,
+ taxasEntrega: Number(req.body.taxasEntrega) || 0,
+ taxasCartao: Number(req.body.taxasCartao) || 0,
+ desconto: Number(req.body.desconto) || 0,
+ total: Number(req.body.total) || valoresItens,
```

### 2. Corrigir cálculo de combos de preço fixo no backend

Em `publicController.js:131`, o backend precisa tratar `pacotesFixos` e `pacotesEspeciais` da mesma forma que o frontend, usando o preço sem multiplicar pela quantidade:

```js
const fixedComboIds = [201,202,203,204,205,206,207,401,402];
if (fixedComboIds.includes(Number(item.produtoId))) {
  valoresItens += preco; // preço fixo, ignora qtd
} else {
  valoresItens += preco * qtd;
}
```

### 3. Remover bloqueio por geocodificação

Em `cart.js:805-808`, substituir o `return` por continuação com coordenadas nulas:

```js
if (!coords.lat || !coords.lon) {
  console.warn("Pedido sem coordenadas — endereço pode estar incorreto");
  // Não bloqueia, segue com coords nulas
}
```

### 4. Tratar `userLogged` nulo na geocodificação

Substituir optional chaining com fallback para string vazia:

```js
const cidade = userLogged?.cidade || '';
const estado = userLogged?.estado || '';
const enderecoCompleto = `${endereco}, ${numero}, ${bairro}, ${cidade}, ${estado}`;
```

---

## 🟡 Médias — Qualidade e Segurança

### 5. Remover código morto

Em `js/cart.js`:
- Remover `gerarPedidoSequencial()` e `pedidoCodigo` — não usados
- Remover `clientePedido` — não usado
- Remover função duplicada `mostrarCampos()` (linhas 643-662)
- Remover cálculo de `totalFinal` se não for enviado (ou enviá-lo)

### 6. Implementar autenticação segura para clientes

Substituir `generateToken()` (Base64URL sem assinatura) por JWT com:
- Assinatura HMAC-SHA256
- Expiração (ex: 7 dias)
- Payload mínimo (apenas `sub`, `empresaId`, `iat`, `exp`)

### 7. Rate limiting específico para criação de pedidos

Adicionar rate limiter específico na rota `POST /api/public/pedidos` para evitar spam (ex: 5 pedidos/minuto por IP).

### 8. Atualizar taxa de entrega para usuários logados

Remover a condição `if (!userLogged)` em `cart.js:546` para que usuários logados também tenham a taxa recalculada ao alterar o CEP.

---

## ⚪ Leves — UX e Código

### 9. Normalizar nomenclatura de instâncias WhatsApp

- Usar apenas `empresaId` no nome da instância (sem timestamp)
- Adicionar validação: antes de criar, verificar se já existe instância ativa
- Conectar `whatsappService.js` ao repositório de instâncias, permitindo enviar pela instância correta da empresa

### 10. Criar testes para o fluxo de pedido

Testes sugeridos:
- **Frontend:** Validar construção do payload, cálculo de valores, validação de campos
- **Backend:** Testar `publicController.criarPedido` com diferentes cenários (delivery, retirada, com cupom, sem itens, etc.)
- **Integração:** Testar fluxo completo frontend→backend

### 11. Padronizar máscaras de telefone

O prefixo `+55` é adicionado em múltiplos lugares de forma inconsistente:
- `menu.js:394-401` — `adicionarPrefixoTelefone()`
- `cart.js` — sem prefixação, envia raw
- `publicController.js` — sem normalização

Criar uma função utilitária centralizada e usá-la em todo lugar.

### 12. Logging de pedidos

Adicionar logs estruturados no backend para:
- Criação de pedido (com ID e valores)
- Falha de validação
- Erro de geocodificação
- Notificação WhatsApp (sucesso/falha)

---

## 📋 Plano de Implementação Sugerido

| Prioridade | Tarefa | Esforço |
|------------|--------|---------|
| 🔴 1 | Enviar valores financeiros no payload | 1h |
| 🔴 2 | Corrigir cálculo de combos fixos | 30min |
| 🔴 3 | Remover bloqueio de geocodificação | 30min |
| 🔴 4 | Tratar userLogged nulo | 15min |
| 🟡 5 | Remover código morto | 30min |
| 🟡 6 | JWT para clientes | 3h |
| 🟡 7 | Rate limiting pedidos | 1h |
| 🟡 9 | Instância única por empresa | 2h |
| ⚪ 10 | Testes de pedido | 4h |
| ⚪ 11 | Padronizar telefone | 1h |
| ⚪ 12 | Logging | 1h |

---

## Referências

- `view/cart.html` — Página do carrinho
- `js/cart.js` — Lógica do carrinho (880 linhas)
- `backend/src/controllers/publicController.js` — API pública
- `backend/src/services/orderService.js` — Lógica de pedidos
- `backend/src/services/whatsappService.js` — Notificações WhatsApp
- `backend/src/services/whatsappInstanceService.js` — Instâncias Evolution
