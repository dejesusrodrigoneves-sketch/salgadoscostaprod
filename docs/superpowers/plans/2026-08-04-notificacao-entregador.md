# Notificação WhatsApp ao Entregador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando o admin atribui um pedido a um entregador ("Em Rota"), enviar automaticamente ao entregador uma mensagem WhatsApp com os dados completos do pedido (mesmo conteúdo do comprovante impresso), além do aviso existente ao cliente.

**Architecture:** Backend dispara a notificação ao entregador dentro do handler `atualizarStatus` do `orderController` quando `status === 'em_rota'` e há `entregadorId` no body. Um novo módulo `mensagemEntregador` formata o texto do pedido (itens, sabores, endereço, valores) de forma determinística e testável; o `whatsappService` já existente (`enviarMensagem`) reutilizado para o envio. Frontend sem alterações — já envia `entregadorId` no PATCH.

**Tech Stack:** Node 24, Express, Prisma/PostgreSQL, Vitest.

## Global Constraints

- Sem commit — usuário valida e commita manualmente (regra da sessão).
- Backend: alterar `backend/src/controllers/orderController.js` (handler `atualizarStatus`, linha 66) + criar `backend/src/services/mensagemEntregador.js` + criar teste `backend/tests/mensagemEntregador.test.js`. Nada mais no backend.
- Não alterar frontend `admin.html`, `entregador.html` nem dist/.
- Não alterar `orderService.atualizarStatus`; a notificação é ORQUESTRADA no controller.
- Reutilizar `whatsapp.enviarMensagem` e `sql.listarEntregadores`, `sql.listarProdutos` — não criar novos métodos de envio.
- Mensagem ao entregador espelha o conteúdo de `gerarHTMLImpressao` do `admin.html` (Campos: Código, Entrega, Cliente, Whatsapp, Endereço, Bairro, Ref, Pagamento, Troco, Itens com sabores, Total itens, Taxa cartão, Taxa entrega, Desconto, Total).
- Formatação monetária pt-BR (`R$ 1.234,56`), número com DDI 55.
- Se `status !== 'em_rota'` ou sem `entregadorId` ou entregador sem `whatsapp` → não envia (no-op, sem erro).

---

### Task 1: Formatar mensagem do entregador (puro + testável)

**Files:**
- Create: `backend/src/services/mensagemEntregador.js`
- Test: `backend/tests/mensagemEntregador.test.js`

**Interfaces:**
- Produces: `formatarMensagemEntregador(pedido) => string` — recebe o pedido no formato do banco (campos `clienteNome`, `clienteWhatsapp`, `clienteEndereco`, `clienteNumero`, `clienteBairro`, `clienteCep`, `clienteReferencia`, `tipoEntrega`, `formaPagamento`, `troco` (Decimal), `valoresItens`, `taxasCartao`, `taxasEntrega`, `desconto`, `total` (Decimal), `itens` array de `{ produtoId, quantidade, precoUnitario, sabores }`) e uma lista `produtos` (array de `{ id, name, price, type }`). Retorna string multiline.

- [ ] **Step 1: Escrever teste falhando**

```js
// backend/tests/mensagemEntregador.test.js
import { describe, it, expect } from 'vitest';
import { formatarMensagemEntregador } from '../src/services/mensagemEntregador.js';

describe('formatarMensagemEntregador', () => {
  const pedido = {
    id: '003',
    tipoEntrega: 'delivery',
    clienteNome: 'Maria',
    clienteWhatsapp: '5511999888777',
    clienteEndereco: 'Rua A',
    clienteNumero: '100',
    clienteBairro: 'Centro',
    clienteCep: '01000-000',
    clienteReferencia: 'Perto da padaria',
    formaPagamento: 'pix',
    troco: null,
    valoresItens: '30.00',
    taxasCartao: '0.00',
    taxasEntrega: '5.00',
    desconto: '0.00',
    total: '35.00',
    itens: [
      { produtoId: 1, quantidade: 2, precoUnitario: '15.00', sabores: JSON.stringify({ 3: 2 }) },
      { produtoId: 2, quantidade: 1, precoUnitario: '5.00', sabores: null },
    ],
  };
  const produtos = [
    { id: 1, name: 'Pizza Grande', price: '15.00', type: 0 },
    { id: 2, name: 'Refrigerante', price: '5.00', type: 0 },
    { id: 3, name: 'Mussarela', price: '0.00', type: 1 },
  ];

  it('inclui dados do cliente', () => {
    const msg = formatarMensagemEntregador(pedido, produtos);
    expect(msg).toContain('Maria');
    expect(msg).toContain('Rua A, 100');
    expect(msg).toContain('Centro');
    expect(msg).toContain('01000-000');
  });

  it('listaa itens com quantidade, nome e preço', () => {
    const msg = formatarMensagemEntregador(pedido, produtos);
    expect(msg).toContain('2x Pizza Grande');
    expect(msg).toContain('1x Refrigerante');
  });

  it('resolve sabores pelo id do produto', () => {
    const msg = formatarMensagemEntregador(pedido, produtos);
    expect(msg).toContain('Mussarela');
    expect(msg).toContain('2x Mussarela');
  });

  it('inclui totais formatados em BRL', () => {
    const msg = formatarMensagemEntregador(pedido, produtos);
    expect(msg).toContain('R$ 30,00');
    expect(msg).toContain('R$ 5,00');
    expect(msg).toContain('R$ 35,00');
  });

  it('usa nome do produto quando produtoId não encontrado', () => {
    const msg = formatarMensagemEntregador(pedido, []);
    expect(msg).toContain('Produto #1');
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `cd backend && npx vitest run tests/mensagemEntregador.test.js`
Expected: FAIL (module não existe / `Cannot find module`).

- [ ] **Step 3: Implementar formatação**

```js
// backend/src/services/mensagemEntregador.js
function fmtReais(valor) {
  const num = Number(valor);
  if (Number.isNaN(num)) return 'R$ 0,00';
  return 'R$ ' + num.toFixed(2).replace('.', ',');
}

function linhaItem(item, produtos) {
  const prod = produtos.find(function (p) { return Number(p.id) === Number(item.produtoId); });
  const nome = prod ? prod.name : 'Produto #' + item.produtoId;
  const qtd = Number(item.quantidade) || 1;
  const preco = Number(item.precoUnitario || 0);
  let txt = qtd + 'x ' + nome + ' \u2192 ' + fmtReais(preco) + '\n';
  if (item.sabores) {
    try {
      const obj = typeof item.sabores === 'string' ? JSON.parse(item.sabores) : item.sabores;
      Object.keys(obj).filter(function (id) { return Number(obj[id]) > 0; }).forEach(function (id) {
        const s = produtos.find(function (p) { return Number(p.id) === Number(id); });
        txt += '   ' + obj[id] + 'x ' + (s ? s.name : 'Sabor #' + id) + '\n';
      });
    } catch (e) { /* ignora sabores inválidos */ }
  }
  return txt;
}

function formatarMensagemEntregador(pedido, produtos) {
  const L = [];
  L.push('\uD83D\uDE9A *NOVA ENTREGA*\n');
  L.push('Pedido: ' + (pedido.id || '-'));
  L.push('Entrega: ' + (pedido.tipoEntrega || '-'));
  L.push('Cliente: ' + (pedido.clienteNome || '-'));
  L.push('Whatsapp: ' + (pedido.clienteWhatsapp || '-'));
  const endereco = (pedido.clienteEndereco || '-') + ', ' + (pedido.clienteNumero || '-');
  L.push('Endereço: ' + endereco);
  L.push('Bairro: ' + (pedido.clienteBairro || '-'));
  L.push('CEP: ' + (pedido.clienteCep || '-'));
  L.push('Ref: ' + (pedido.clienteReferencia || '-'));
  L.push('Pagamento: ' + (pedido.formaPagamento || '-'));
  L.push('Troco: ' + (pedido.troco ? fmtReais(pedido.troco) : 'R$ 0,00'));
  L.push('');
  L.push('*Itens:*');
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  itens.forEach(function (i) { L.push(linhaItem(i, produtos)); });
  L.push('');
  L.push('Total itens: ' + fmtReais(pedido.valoresItens));
  L.push('Taxa cartão: ' + fmtReais(pedido.taxasCartao));
  L.push('Taxa entrega: ' + fmtReais(pedido.taxasEntrega));
  L.push('Desconto: ' + fmtReais(pedido.desconto));
  L.push('Total: ' + fmtReais(pedido.total));
  return L.filter(function (l) { return l !== '' || l.indexOf('\n') > -1 || l.indexOf('x ') > -1; }).join('\n');
}

module.exports = { formatarMensagemEntregador };
```

> Nota: `L.push(linhaItem(...))` já inclui quebra interna; o `filter` final remove linhas vazias, mas preserva blocos que contêm '\n'. Se preferir simplicidade, remova o `filter` e use `L.join('\n')` diretamente — os testes não dependem do filtro (verificam apenas `.toContain`).

- [ ] **Step 4: Rodar teste e confirmar passagem**

Run: `cd backend && npx vitest run tests/mensagemEntregador.test.js`
Expected: 7 tests ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/mensagemEntregador.js backend/tests/mensagemEntregador.test.js
git commit -m "feat: formatação de mensagem WhatsApp para entregador"
```
(Sessão: usuário commita — pular commit e avisar.)

---

### Task 2: Orquestrar envio no controller `atualizarStatus`

**Files:**
- Modify: `backend/src/controllers/orderController.js:66` (handler `atualizarStatus`) e topo (imports)
- Test: `backend/tests/mensagemEntregador.test.js` (extendido)

**Interfaces:**
- Consumes: `formatarMensagemEntregador` (Task 1), `sql.listarEntregadores`, `sql.listarProdutos`, `whatsapp.enviarMensagem`.
- Produces: side-effect — envia WhatsApp ao entregador; sem retorno novo no controller.

- [ ] **Step 1: Adicionar imports no topo do controller**

```js
const mensagemEntregador = require('../services/mensagemEntregador');
```
(já existe: `const sql = require('../repositories/sqlRepository');` e `const whatsapp = require('../services/whatsappService');`)

- [ ] **Step 2: Escrever teste de integração (mock)**

Extenda o arquivo de teste com mock do módulo de envio:

```js
// Adicionar ao topo: vitest mock do whatsappService e do sqlRepository
import { vi } from 'vitest';
import { formatarMensagemEntregador } from '../src/services/mensagemEntregador.js';

it('produz mensagem com campo esperado para integração (golden snapshot parcial)', () => {
  const msg = formatarMensagemEntregador(pedido, produtos);
  expect(msg).toMatch(/NOVA ENTREGA/);
  expect(msg).toMatch(/\*Itens:\*/);
});
```

> Teste de INTEGRAÇÃO real (que dispara `whatsapp.enviarMensagem` via HTTP) requer Evolution API ativa em runtime e uma instância conectada — fora do escopo de teste unitário Vitest. A orquestração é validada por teste manual no fluxo "Em Rota" do `admin.html`.

- [ ] **Step 3: Implementar orquestração no handler `atualizarStatus`**

Substituir o corpo de `exports.atualizarStatus` (linhas 66-95) por:

```js
exports.atualizarStatus = asyncHandler(async (req, res) => {
  const { status, entregadorId } = req.body;
  if (!status) return res.status(400).json({ error: 'status obrigatório' });
  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  const atualizado = await orderService.atualizarStatus(req.params.id, status, getCtx(req));

  const mensagens = {
    producao: `🍳 Olá ${pedido.clienteNome}!\n\nSeu pedido ${pedido.id} entrou em produção.`,
    pronto: `Obaaa! ${pedido.clienteNome}, seu pedido ${pedido.id} já está pronto para retirada 🎉`,
    em_rota: `${pedido.clienteNome}, seu pedido já está a caminho da sua casa 🚚💖`,
  };

  if (mensagens[status] && pedido.clienteWhatsapp) {
    try {
      const instancia = await whatsappInstance.statusAtivo();
      if (instancia && (instancia.connectionStatus === 'connected' || instancia.connectionStatus === 'open')) {
        await whatsapp.enviarMensagem(pedido.clienteWhatsapp, mensagens[status]);
      }
    } catch (err) {
      console.error('WhatsApp notification failed:', err.message);
    }
  }

  // Notificação ao entregador quando pedido sai em rota
  if (status === 'em_rota' && entregadorId) {
    try {
      const entregadores = await sql.listarEntregadores();
      const entregador = entregadores.find(function (e) { return Number(e.id) === Number(entregadorId); });
      if (entregador && entregador.whatsapp) {
        const produtos = await sql.listarProdutos();
        const msg = mensagemEntregador.formatarMensagemEntregador(pedido, produtos);
        await whatsapp.enviarMensagem(entregador.whatsapp, msg);
      }
    } catch (err) {
      console.error('WhatsApp entregador notify failed:', err.message);
    }
  }

  res.json(atualizado);
});
```

- [ ] **Step 4: Rodar testes**

Run: `cd backend && npx vitest run tests/`
Expected: ALL PASS (testes de formatação + golden).

- [ ] **Step 5: Verificação syntax**

Run: `cd backend && node --check src/controllers/orderController.js`
Expected: sem saída (OK).

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/orderController.js backend/tests/mensagemEntregador.test.js
git commit -m "feat: notifica entregador com dados do pedido ao colocar em rota"
```
(Sessão: usuário commita — pular commit e avisar.)

---

### Task 3: Teste manual do fluxo completo (E2E)

**Files:**
- Nenhum arquivo alterado.

**Interfaces:**
- Consumes: Task 1 + Task 2 implantados; Evolution API + instância WhatsApp conectada.

- [ ] **Step 1: Reiniciar servidor backend**

```bash
cd backend && node server.js
```
Expected: `Servidor iniciado na porta 3000` (matar processo anterior se houver).

- [ ] **Step 2: Login como admin e criar/posicionar um pedido em "Em Rota"**

- Abrir `http://localhost:5173/admin.html`, logar (ex: admin `simone` / senha administrada).
- Criar pedido (pela esteira ou via view), avançar para "Pronto".
- Clicar "Em Rota", selecionar entregador com WhatsApp cadastrado.
Expected: toast "✅ Pedido em rota e notificação enviada!".

- [ ] **Step 3: Confirmar entrega das duas mensagens**

- Cliente: recebe `...já está a caminho da sua casa 🚚💖`.
- Entregador: recebe mensagem `🚚 *NOVA ENTREGA*` com Código, Entrega, Cliente, Endereço, Itens (com sabores), totais.
Expected: ambas chegam; conteúdo do entregador espelha o comprovante impresso.

---