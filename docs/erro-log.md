# Log de Erros — WhatsApp 404

## Erro no Console
```
api/whatsapp:1  Failed to load resource: the server responded with a status of 401 (Unauthorized)
api/whatsapp/criar:1  Failed to load resource: the server responded with a status of 401 (Unauthorized)
whatsapp.html:98  GET http://localhost:5173/api/whatsapp 401 (Unauthorized)
```

## Causas Raiz

### 1. Trailing Slash no EVOLUTION_URL (Crítico)
**Arquivo:** `backend/.env:5`
```
EVOLUTION_URL=https://evolution-api-production-2837.up.railway.app/  ← trailing slash!
```
Toda chamada à Evolution API produz **dupla barra** no path:
```
${EVOLUTION_URL}/instance/create
→ https://evolution-api...railway.app//instance/create  ← 404!
```

Afeta todos os endpoints:
- `//instance/create` → criação de instância
- `//instance/delete/{id}` → deletar instância
- `//instance/connect/{id}` → conectar / QR Code
- `//message/sendText/{instance}` → enviar notificação

**Solução:** Remover a barra final no `.env`:
```
EVOLUTION_URL=https://evolution-api-production-2837.up.railway.app
```

### 2. Ausência de try/catch em whatsappService.js
**Arquivo:** `backend/src/services/whatsappService.js`
```js
async function enviarMensagem(numero, mensagem) {
  const telefone = numero.replace(/\D/g, '');
  return axios.post(/* ... */);  // Sem try/catch — erro 404 propaga sem tratamento
}
```
Qualquer erro da Evolution API (404, 401, timeout) **quebra** o fluxo que chamou `enviarMensagem()` (ex.: transição de status do pedido).

**Solução:** Adicionar try/catch que loga o erro sem relançar:
```js
async function enviarMensagem(numero, mensagem) {
  try {
    const telefone = numero.replace(/\D/g, '');
    return await axios.post(/* ... */);
  } catch (err) {
    console.error(`WhatsApp send failed for ${numero}:`, err.message);
  }
}
```

### 3. Erro de Criação de Instância Engolido
**Arquivo:** `backend/src/services/whatsappInstanceService.js:17-28`
```js
try {
  const { data } = await axios.post(`${config.evolutionUrl}/instance/create`, ...);
  evolutionData = data;
} catch (err) {
  console.error('Evolution API error creating instance:', err.message);
  // Erro NÃO é relançado — frontend vê "disconnected" sem QR
}
```
A Evolution retorna 404 (dupla barra), o erro é logado mas ignorado. A instância é criada no banco local com `connectionStatus: "disconnected"`, sem QR Code.

**Solução:** Relançar o erro para o frontend receber feedback adequado.

### 4. Instância Hardcoded Pode Não Existir
**Arquivo:** `backend/.env:7`
```
EVOLUTION_INSTANCE=costasalgados-testedev
```
O serviço de notificação `whatsappService.js` usa esta instância fixa para enviar mensagens. Se ela nunca foi criada no servidor Evolution (ou foi deletada), toda chamada retorna 404.

**Solução:** Sincronizar — ou pré-criar `costasalgados-testedev` no servidor Evolution, ou fazer o serviço de notificação usar instâncias dinâmicas do banco.

### 5. Servidor Evolution Pode Estar Fora do Ar
A URL aponta para um deploy no Railway. Se o serviço foi desligado, restartado ou a API key rotacionada, todas as chamadas falham.

**Verificação manual:**
```bash
curl -X POST https://evolution-api-production-2837.up.railway.app/instance/create \
  -H "apikey: 26RodJancia" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"costasalgados-testedev","integration":"WHATSAPP-BAILEYS"}'
```

---

## Arquivos Envolvidos

| Arquivo | Função |
|---|---|
| `backend/.env` | EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE |
| `backend/src/services/whatsappService.js` | Envio de notificações via Evolution API |
| `backend/src/services/whatsappInstanceService.js` | CRUD de instâncias WhatsApp |
| `backend/src/routes/whatsappRoutes.js` | Rotas /api/whatsapp/* |
| `backend/src/controllers/whatsappController.js` | Controller das rotas |
| `whatsapp.html` | Frontend de gerenciamento de instâncias |
| `vite.config.js` | Proxy /api → backend (funcionando corretamente) |

---

## Plano de Correção

1. Remover trailing slash do `EVOLUTION_URL` no `.env`
2. Adicionar try/catch no `whatsappService.js` (não relançar)
3. Relançar erro de criação de instância no `whatsappInstanceService.js`
4. Verificar se a instância `costasalgados-testedev` existe no servidor Evolution
5. Testar criação de nova instância pelo frontend (`whatsapp.html`)
