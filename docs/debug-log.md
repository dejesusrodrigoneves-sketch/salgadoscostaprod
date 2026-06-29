# Debug Log — Fluxo de Criação de Pedido

## Cenário Analisado

Cliente acessa `view/cart.html`, preenche dados, clica em "Gerar Pedido" e o pedido é criado no sistema.

---

## 1. Fluxo Detalhado (Frontend → Backend)

### 1.1 Frontend — `js/cart.js`

| Etapa | Linha | Descrição |
|-------|-------|-----------|
| `init()` registra listener | 581 | `btnGenerateOrder` → `generateOrder()` |
| Coleta dados do formulário | 710-718 | nome, whatsapp, endereço, numero, bairro, pontoReferencia, formaPagamento, troco |
| Valida nome/whatsapp | 727-730 | Se vazio → `return` |
| Valida formaPagamento | 732-735 | Se vazio → `return` |
| Valida troco (delivery + dinheiro) | 737-742 | Se troco vazio → `return` |
| Valida carrinho vazio | 744-748 | Se vazio → `return` |
| Formata itens com sabores | 761-781 | Texto para exibição (não enviado ao backend) |
| Calcula `valorItens` | 789-794 | `sum(price * qtd)` — exceto combos fixos que usam só `price` |
| Geocodificação (delivery) | 800-809 | `GET /api/proxy/geoapify` — **se falhar, BLOQUEIA o pedido** |
| Monta payload | 850-865 | **NÃO inclui** `valoresItens`, `taxasEntrega`, `taxasCartao`, `desconto`, `total` |
| Chama API | 868 | `PUBLIC_API.criarPedido(payload)` → `POST /api/public/pedidos` |
| Sucesso | 869-871 | Toast + limpa `localStorage.cart` |

### 1.2 API Helper — `js/apiHelper.js`

| Etapa | Linha |
|-------|-------|
| `criarPedido(data)` | 66-68 |
| `request('POST', '/pedidos', data)` | 15-29 |
| Adiciona `Authorization: Bearer {token}` se existir | 17-18 |
| `fetch('/api/public/pedidos', { method, headers, body })` | 19-23 |

### 1.3 Backend — `backend/src/controllers/publicController.js`

| Etapa | Linha | Descrição |
|-------|-------|-----------|
| `criarPedido()` | 115-160 | Handler do endpoint |
| Valida dados | 117-119 | nome, whatsapp, itens (array não vazio) |
| Resolve empresa | 120 | `resolveEmpresa(slug)` → busca por slug no banco |
| Gera ID sequencial | 121 | `sql.nextPedidoId(empresa.id)` — counter no banco |
| Loop itens | 126-138 | Busca produto, calcula `preco * qtd` |
| Cria pedido no banco | 140-157 | `prisma.pedido.create()` com **taxasEntrega:0, taxasCartao:0, desconto:0** |
| Retorna | 159 | `{ id, status: 'pendente' }` |

### 1.4 Admin — Atualização de Status

| Etapa | Arquivo | Linha |
|-------|---------|-------|
| `PATCH /api/pedidos/:id/status` | `orderRoutes.js` | roteia para `orderController.atualizarStatus` |
| Valida status + permissão | `orderController.js` | 33-39 |
| `orderService.atualizarStatus()` | `orderService.js` | 66-82 |
| Baixa estoque se `aceito`/`producao` | `orderService.js` | 73-76 |
| Notifica WhatsApp se `producao`/`pronto`/`em_rota` | `orderService.js` | 78-80 |

---

## 2. Testes Existentes

### 2.1 `tests/backend.test.js` — 3 describe blocks, 5 tests

| Teste | Status |
|-------|--------|
| Logger tem métodos debug, info, warn, error | ✅ |
| authenticate retorna 401 sem token | ✅ |
| authorize com role correta chama next | ✅ |
| authorize com role errada retorna 403 | ✅ |
| errorHandler retorna status 500 com mensagem | ✅ |
| asyncHandler captura erros e chama next | ✅ |

### 2.2 `tests/utils.test.js` — 3 describe blocks, 6 tests

| Teste | Status |
|-------|--------|
| escapeHtml escapa & < > " ' | ✅ |
| escapeHtml retorna string vazia | ✅ |
| escapeHtml mantém texto normal | ✅ |
| fmtMoeda formata número como BRL | ✅ |
| fmtMoeda retorna R$ 0,00 para null | ✅ |
| fmtMoeda retorna R$ 0,00 para undefined | ✅ |
| debounce retorna uma função | ✅ |
| debounce executa após o delay | ✅ |

### 2.3 `backend/tests/` — **vazio**

---

## 3. Bugs Encontrados

### 🔴 CRÍTICO - Bug 1: Valores financeiros não persistem no banco

**Arquivo:** `publicController.js:150-153`
```js
taxasEntrega: 0,
taxasCartao: 0,
desconto: 0,
total: valoresItens,
```

**Problema:** O frontend calcula `deliveryValue`, `taxaCartao`, `desconto` e `totalFinal` (`cart.js:816-820`), mas **NENHUM desses valores é enviado no payload** (`cart.js:850-865`). O backend armazena tudo como 0.

**Impacto:** Todo pedido com:
- **Entrega (delivery):** `taxasEntrega` fica 0 no banco
- **Cartão (crédito/débito):** `taxasCartao` fica 0 no banco
- **Cupom de desconto:** `desconto` fica 0 no banco
- **Total armazenado:** `total = valoresItens` (soma dos produtos apenas)
- **Relatórios financeiros e caixa ficam inconsistentes**

### 🔴 CRÍTICO - Bug 2: Preço de combos fixos calculado errado

**Arquivo:** `cart.js:432` + `publicController.js:131`

```js
// cart.js:432 — confirmarSabores()
cart[index].qtd = totalEscolhido; // sobrescreve qtd com contagem de sabores
```

```js
// publicController.js:131 — backend recalcula
valoresItens += preco * qtd; // price × totalEscolhido (ex: 25)
```

**Problema:** Combos de preço fixo (IDs 201-208, 401-402) têm o `qtd` sobrescrito com o número de sabores escolhidos (ex: 25). O backend então calcula `price * 25` ao invés de apenas `price`.

**Exemplo real:**
- Combo Festa 25 unidades (ID 201) = R$ 50,00
- Cliente escolhe 25 sabores
- Backend salva: R$ 50,00 × 25 = **R$ 1.250,00** (valor incorreto)
- Frontend mostra: R$ 50,00 (correto)

### 🔴 CRÍTICO - Bug 3: Geocodificação bloqueia pedidos de delivery

**Arquivo:** `cart.js:805-808`
```js
if (!coords.lat || !coords.lon) {
    toast("Não foi possível obter as coordenadas. Verifique o endereço!", 'danger');
    return; // <-- BLOQUEIA o pedido
}
```

**Problema:** Se a API Geoapify estiver fora do ar, retornar vazio ou o proxy falhar, o cliente **não consegue finalizar o pedido**. O toast na linha 699-700 diz "O pedido será processado sem coordenadas", mas o código bloqueia.

### 🟡 MÉDIO - Bug 4: userLogged nulo quebra geocodificação

**Arquivo:** `cart.js:802`
```js
const enderecoCompleto = `${endereco}, ${numero}, ${bairro}, ${userLogged?.cidade}, ${userLogged?.estado}`;
```

**Problema:** Se `userLogged` é `null` (cliente não logado), `userLogged?.cidade` retorna `undefined` e a string vira `"Rua X, 123, Centro, undefined, undefined"`. A geocodificação falha e o pedido é bloqueado pelo Bug 3.

### 🟡 MÉDIO - Bug 5: Código morto (dead code)

**Arquivo:** `cart.js`

| Variável | Linha | Status |
|----------|-------|--------|
| `pedidoCodigo` | 826 | Gerado via `gerarPedidoSequencial()` mas **nunca enviado** |
| `clientePedido` | 828-844 | Montado mas **nunca usado** — descartado |
| `totalFinal` | 820 | Calculado mas **nunca enviado ao backend** |
| `pedidoId` em `gerarPedidoSequencial` | 682-684 | Gera ID aleatório (Date.now base36) mas não é usado — servidor gera o próprio ID |

### 🟡 MÉDIO - Bug 6: Função `gerarPedidoSequencial` não é sequencial

**Arquivo:** `cart.js:682-684`
```js
async function gerarPedidoSequencial() {
  return Date.now().toString(36).toUpperCase().slice(-4);
}
```

**Problema:** Retorna um trecho de timestamp em base36, **NÃO** é um número sequencial. Além disso, a função é chamada mas o retorno é descartado (dead code).

### 🟡 MÉDIO - Bug 7: Duplicação de lógica de exibição de campos

**Arquivo:** `cart.js`

Duas funções fazem a mesma coisa:
- `atualizarCamposEntrega()` — linhas 591-626 (chamada pelos eventos)
- `mostrarCampos()` — linhas 643-662 (NUNCA é chamada)

### ⚪ LEVE - Bug 8: Taxa por bairro não recalcula para usuários logados

**Arquivo:** `cart.js:546`
```js
// Só recalcula a taxa se o usuário NÃO estiver logado
if (!userLogged && document.querySelector("#bairroCliente").value) {
```

**Problema:** Usuários logados que alteram o CEP/Bairro não têm a taxa de entrega recalculada automaticamente.

### ⚪ LEVE - Bug 9: Token de cliente sem assinatura

**Arquivo:** `publicController.js:8-10`
```js
function generateToken(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}
```

**Problema:** Token é apenas Base64URL do JSON — qualquer um pode decodificar, alterar e re-encode. Não há:
- Assinatura criptográfica (HMAC/RSA)
- Expiração (exp)
- Validação de integridade

---

## 4. Evolution API — Instâncias WhatsApp

### 4.1 Criação de Cliente

**Não gera instância Evolution.** `publicController.registrarCliente()` apenas insere na tabela `Cliente`. Zero chamadas à Evolution API.

### 4.2 Criação de Instância

Apenas via admin autenticado:
```
POST /api/whatsapp/criar  →  whatsappInstanceService.criar(empresaId)
```

### 4.3 Disconnect: Instância de envio vs. instâncias gerenciadas

**Arquivo:** `whatsappService.js:8` — usa instância fixa do `.env`
```js
`${config.evolutionUrl}/message/sendText/${config.evolutionInstance}`
```

**Arquivo:** `whatsappInstanceService.js:14` — cria instâncias com nome dinâmico
```js
return `loja_${empresaId}_${Date.now()}`;
```

**Problema:** O serviço de notificação usa `EVOLUTION_INSTANCE` (hardcoded). O gerenciador de instâncias cria instâncias separadas. **Nunca se comunicam.** Mensagens sempre são enviadas pela instância fixa, independente das instâncias criadas/gerenciadas.

### 4.4 Instância única por empresa

`buildInstanceName()` sempre adiciona `Date.now()`, permitindo criação ilimitada. Não há:
- Verificação de instância existente antes de criar
- Limite de uma instância por empresa
- Reuso de instância ativa

---

## 5. Arquivos Envolvidos

| Arquivo | Função |
|---------|--------|
| `view/cart.html` | Página do carrinho |
| `js/cart.js` | Lógica do carrinho e envio do pedido |
| `js/apiHelper.js` | Cliente HTTP público (`PUBLIC_API`) |
| `js/services/orderService.js` | Serviço de pedidos (admin) |
| `js/menu.js` | Cadastro/login de clientes |
| `backend/src/controllers/publicController.js` | API pública: criar pedido, cliente, cupom |
| `backend/src/controllers/orderController.js` | API admin: CRUD pedidos |
| `backend/src/services/orderService.js` | Lógica de pedidos + estoque + WhatsApp |
| `backend/src/services/whatsappService.js` | Envio de notificações WhatsApp |
| `backend/src/services/whatsappInstanceService.js` | Gerenciamento de instâncias Evolution |
| `backend/src/repositories/sqlRepository.js` | Camada de banco de dados |
| `backend/prisma/schema.prisma` | Schema do banco |
| `tests/backend.test.js` | Testes de backend (não cobrem pedidos) |
| `tests/utils.test.js` | Testes de utilitários (não cobrem pedidos) |
