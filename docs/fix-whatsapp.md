# Plano: Correção do Teste WhatsApp + Exclusão de Instância + Botão WhatsApp no Admin

---

## Problema 1: Erro 400 no "Enviar Teste" (`POST /api/whatsapp/:id/teste`)

### Diagnóstico

O controller `enviarTeste` verifica `connectionStatus` e `phoneNumber` lendo do **banco**, que pode estar desatualizado. O banco só é sincronizado via:
1. Polling a cada 15s (`listar()` → Evolution API → atualiza DB)
2. Chamada manual `status()` (atualiza DB + `phoneNumber`)

Se o usuário clica "Enviar Teste" antes do polling rodar, o banco ainda mostra `'qrcode'` → controller rejeita com **400 "Instância não está conectada"**.

---

## Problema 2: Não consegue excluir instância pelo frontend

### Diagnóstico — **Conflito de classe CSS**

- `whatsapp.html` define `.modal-overlay { display: none; ... }` (para o modal de **criação**)
- `js/utils.js` → `confirmModal()` cria um `div` com `className = 'modal-overlay'` (para a **confirmação de exclusão**)

**Resultado:** o modal de confirmação herda `display: none` do CSS do whatsapp.html → fica **invisível** → promise nunca resolve → `excluirInstancia()` trava no `await confirmModal(...)`.

---

## Problema 3: Botões do Admin.html não enviam WhatsApp pela Evolution API

### Diagnóstico

O frontend (`admin.html`) chama:
- `PATCH /api/pedidos/:id/status` com `{ status: 'producao' }`
- `PATCH /api/pedidos/:id/status` com `{ status: 'pronto' }`
- `PATCH /api/pedidos/:id/status` com `{ status: 'em_rota', entregadorId }`
- `POST /api/pedidos/:id/finalizar`

O backend `orderController.atualizarStatus()` **apenas atualiza o status no banco** — não dispara WhatsApp.

As rotas legadas `/producao`, `/pronto`, `/em-rota` em `orderRoutes.js` **enviam WhatsApp**, mas o frontend **não as usa** (usa PATCH `/status`).

**Resultado:** toast "📤 Enviando notificação..." aparece, mas WhatsApp **não sai**.

---

## O que muda em cada camada

### 1. Backend — `whatsappController.js` — `enviarTeste` síncrono com Evolution

```js
exports.enviarTeste = asyncHandler(async (req, res) => {
  // 1. Atualiza status direto da Evolution API antes de qualquer verificação
  const instancia = await service.status(req.params.id);

  if (!instancia) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }
  if (instancia.connectionStatus !== 'connected' && instancia.connectionStatus !== 'open') {
    return res.status(400).json({ error: 'Instância não está conectada' });
  }
  if (!instancia.phoneNumber) {
    return res.status(400).json({ error: 'Instância não possui número de telefone registrado' });
  }

  const resultado = await whatsapp.enviarMensagemDireta(
    instancia.instanceId,
    instancia.phoneNumber,
    '✅ Mensagem de teste! A integração WhatsApp está funcionando corretamente.'
  );

  res.json({ success: true, message: 'Mensagem de teste enviada', to: instancia.phoneNumber });
});
```

---

### 2. Backend — `whatsappService.js` — Corrigir duplicação do `55` no número

```js
function normalizarNumero(numero) {
  const telefone = numero.replace(/\D/g, '');
  return telefone.startsWith('55') ? telefone : `55${telefone}`;
}

async function enviarMensagem(numero, mensagem) {
  ...
  const telefone = normalizarNumero(numero);
  return await axios.post(
    `${config.evolutionUrl}/message/sendText/${instancia.instanceId}`,
    { number: telefone, text: mensagem },
    ...
  );
}

async function enviarMensagemDireta(instanceId, numero, mensagem) {
  ...
  const telefone = normalizarNumero(numero);
  return await axios.post(
    `${config.evolutionUrl}/message/sendText/${instanceId}`,
    { number: telefone, text: mensagem },
    ...
  );
}
```

---

### 3. Backend — `whatsappInstanceService.js` — Novo método `statusAtivo()`

```js
async function statusAtivo() {
  const instancia = await sql.buscarInstanciaAtiva();
  if (!instancia) return null;
  return status(instancia.id);
}
```

---

### 4. Backend — `orderController.js` — Enviar WhatsApp nas mudanças de status

```js
const whatsapp = require('../services/whatsappService');
const whatsappInstance = require('../services/whatsappInstanceService');

exports.atualizarStatus = asyncHandler(async (req, res) => {
  const { status, ...resto } = req.body;
  if (!status) return res.status(400).json({ error: 'status obrigatório' });

  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

  const atualizado = await orderService.atualizarStatus(req.params.id, status, resto);

  // Dispara WhatsApp via Evolution API se instância conectada
  const mensagens = {
    producao: `🍳 Olá ${pedido.clienteNome}!\n\nSeu pedido ${pedido.id} entrou em produção.`,
    pronto: `Obaaa! ${pedido.clienteNome}, seu pedido ${pedido.id} já está pronto para retirada 🎉`,
    em_rota: `${pedido.clienteNome}, seu pedido já está a caminho da sua casa com muito amor e cuidado 🚚💖`,
    finalizado: `🎉 Olá ${pedido.clienteNome}!\n\nSeu pedido ${pedido.id} foi finalizado. Obrigado pela preferência!`,
  };

  if (mensagens[status] && pedido.clienteWhatsapp) {
    try {
      const instancia = await whatsappInstance.statusAtivo();
      if (instancia && (instancia.connectionStatus === 'connected' || instancia.connectionStatus === 'open')) {
        await whatsapp.enviarMensagem(pedido.clienteWhatsapp, mensagens[status]);
      }
    } catch (err) {
      console.error('WhatsApp notification failed:', err.message);
      // não falha a request principal
    }
  }

  res.json(atualizado);
});

exports.finalizar = asyncHandler(async (req, res) => {
  const pedido = await orderService.finalizarPedido(req.params.id);
  
  // WhatsApp de finalização
  if (pedido.clienteWhatsapp) {
    try {
      const instancia = await whatsappInstance.statusAtivo();
      if (instancia && (instancia.connectionStatus === 'connected' || instancia.connectionStatus === 'open')) {
        await whatsapp.enviarMensagem(pedido.clienteWhatsapp, `🎉 Olá ${pedido.clienteNome}!\n\nSeu pedido ${pedido.id} foi finalizado. Obrigado pela preferência!`);
      }
    } catch (err) {
      console.error('WhatsApp finalizacao failed:', err.message);
    }
  }
  
  res.json(pedido);
});
```

---

### 5. Frontend — `whatsapp.html` — Renomear classes do modal de criação (evita conflito)

**CSS:** trocar `.modal-overlay` → `.criar-modal-overlay`, `.modal-content` → `.criar-modal-content`, `.modal-actions` → `.criar-modal-actions`.

**HTML:** trocar `id="criarModal"` classes para as novas.

**JS:** atualizar `criarInstancia()`, `fecharModal()`, `confirmarCriacao()` para usar os novos IDs/classes.

---

### 6. Frontend — `admin.html` — Botão WhatsApp direto no card (opcional, fallback)

Adicionar botão "WhatsApp" ao lado de "Produção"/"Pronto" que chama nova rota Evolution:

```js
async function enviarWhatsAppDireto(pedidoId, telefone, mensagem) {
  if (!telefone) return toast('Cliente sem WhatsApp', 'warning');
  try {
    await api(`/whatsapp/pedido/${pedidoId}/contato`, { method: 'POST', body: JSON.stringify({ telefone, mensagem }) });
    toast('Enviado via Evolution API', 'success');
  } catch (e) {
    // Fallback: abre wa.me
    const link = `https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
    window.open(link, '_blank');
    toast('Aberto WhatsApp Web (fallback)', 'info');
  }
}
```

---

### 7. Backend — Nova rota `POST /api/whatsapp/pedido/:id/contato`

```js
// whatsappRoutes.js
router.post('/pedido/:id/contato', authenticate, controller.enviarContatoPedido);

// whatsappController.js
exports.enviarContatoPedido = asyncHandler(async (req, res) => {
  const { telefone, mensagem } = req.body;
  if (!telefone || !mensagem) return res.status(400).json({ error: 'telefone e mensagem obrigatórios' });

  const instancia = await service.statusAtivo();
  if (instancia && (instancia.connectionStatus === 'connected' || instancia.connectionStatus === 'open')) {
    await whatsapp.enviarMensagem(telefone, mensagem);
    return res.json({ success: true, via: 'evolution' });
  }
  // Fallback link
  const link = `https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
  res.json({ success: true, via: 'link', link });
});
```

---

## Resumo de arquivos alterados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `backend/src/controllers/whatsappController.js` | Backend | `enviarTeste` usa `service.status()`; nova `enviarContatoPedido` |
| `backend/src/services/whatsappService.js` | Backend | `normalizarNumero()` evita `55` duplicado |
| `backend/src/services/whatsappInstanceService.js` | Backend | Novo `statusAtivo()` |
| `backend/src/controllers/orderController.js` | Backend | WhatsApp automático em `atualizarStatus` + `finalizar` |
| `backend/src/routes/whatsappRoutes.js` | Backend | Nova rota `POST /pedido/:id/contato` |
| `whatsapp.html` | Frontend | Renomear classes CSS do modal (evita conflito com `confirmModal`) |
| `admin.html` | Frontend | (Opcional) Botão WhatsApp direto + função fallback |

---

## Ordem de implantação

1. **Corrigir `whatsappService.js`** — `normalizarNumero()`
2. **Corrigir `whatsappController.js`** — `enviarTeste` usa `status()`; nova `enviarContatoPedido`
3. **Corrigir `whatsappInstanceService.js`** — `statusAtivo()`
4. **Corrigir `orderController.js`** — WhatsApp automático nas mudanças de status
5. **Adicionar rota** `POST /pedido/:id/contato` em `whatsappRoutes.js`
6. **Corrigir `whatsapp.html`** — renomear classes do modal (resolve exclusão)
7. **(Opcional) `admin.html`** — botão WhatsApp direto + fallback
8. **Testar**: criar instância → conectar → testar → excluir → mudar status pedido → WhatsApp sai
9. **Commit**

---

## Observações

- A causa raiz da exclusão não funcionar é **CSS**: `.modal-overlay { display: none }` do whatsapp.html esconde o modal do `confirmModal` do utils.js. Renomear as classes do modal de criação resolve.
- O `55` duplicado no número é bug separado que afeta **todos** envios (teste, notificações de pedido, botão admin). Corrigir com `normalizarNumero()`.
- As notificações automáticas de pedido agora usam a Evolution API quando a instância está conectada; se não, ficam silenciosas (sem erro 500).
- Fallback `wa.me` garante que o admin sempre consiga contactar o cliente, mesmo sem Evolution.

---