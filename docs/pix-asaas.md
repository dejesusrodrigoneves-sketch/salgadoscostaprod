# PIX via Asaas — Configuração e Testes

## 1. Configurar Conta Asaas

### Criar Conta
1. Acesse [asaas.com](https://www.asaas.com) (produção) ou [sandbox.asaas.com](https://sandbox.asaas.com) (sandbox)
2. Cadastre-se com CNPJ/CPF, e-mail e telefone
3. Complete verificação de identidade (sandbox não exige)
4. Ative o recebimento por PIX nas configurações de pagamento

### Chave PIX
- Em **Configurações → Chaves PIX**, cadastre a chave (CNPJ, CPF, e-mail ou telefone)
- A chave é usada pelo Asaas para identificar sua conta como destino dos pagamentos

### Token de Acesso (API Key)
1. Em **Configurações → Integrações → API**, gere um Access Token
2. Copie e guarde — é o `ASAAS_ACCESS_TOKEN`
3. Para sandbox, gere em `sandbox.asaas.com`

### Webhook URL
1. Em **Configurações → Integrações → Webhook**
2. URL: `https://seu-dominio.com.br/webhooks/asaas` (produção)
3. Para testes locais: use ngrok (ver seção 3)
4. Eventos assinados: `PAYMENT_RECEIVED`
5. Copie o token gerado — é o `ASAAS_WEBHOOK_TOKEN`

---

## 2. Variáveis de Ambiente

Adicione ao `backend/.env`:

```env
# Asaas (PIX)
ASAAS_ACCESS_TOKEN=seu_token_de_acesso_aqui
ASAAS_WEBHOOK_TOKEN=seu_token_de_webhook_aqui
ASAAS_ENV=sandbox          # ou 'production'
ASAAS_PIX_EXPIRY_MIN=5     # tempo de expiração em minutos
PIX_ENABLED=true           # false desativa PIX (fallback pendente)
```

**Referência:** `backend/.env.example` (linhas 26-30) tem todos os campos.

---

## 3. Testar PIX no Sandbox

### Fluxo Completo
1. Gere um pedido via API (`POST /api/pedidos`) com pagamento PIX
2. O sistema cria automaticamente o customer e pagamento no Asaas
3. Retorna `pixCode` (código copia-e-cola) e `pixQrCode` (imagem base64)
4. O QR Code expira em `ASAAS_PIX_EXPIRY_MIN` minutos (padrão: 5)

### Simular Pagamento no Sandbox
- No sandbox do Asaas, PIXs são confirmados automaticamente após ~2 segundos
- Não precisa escanear QR — o webhook `PAYMENT_RECEIVED` é disparado automaticamente
- Verifique o status via SSE: `GET /api/payment/status/:pedidoId`

### Verificar Status
```bash
# Consultar pagamento específico
curl -H "Authorization: Bearer $JWT_TOKEN" http://localhost:3000/api/payment/status/PEDIDO_ID
```

Respostas SSE:
- `{ "status": "pago" }` — pagamento confirmado
- `{ "status": "expirado" }` — prazo excedido

---

## 4. Testar Webhook (ngrok + curl)

### Configurar ngrok
```bash
# Instalar ngrok (se necessário)
npm install -g ngrok

# Iniciar túnel para o backend
ngrok http 3000
```

Copie a URL pública (ex: `https://abc123.ngrok.io`).

### Configurar no Asaas
- Webhook URL: `https://abc123.ngrok.io/webhooks/asaas`
- Evento: `PAYMENT_RECEIVED`

### Testar com curl
```bash
# Simular evento PAYMENT_RECEIVED
curl -X POST https://abc123.ngrok.io/webhooks/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: SEU_ASAAS_WEBHOOK_TOKEN" \
  -d '{
    "id": "evt_test_001",
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_123",
      "value": 30.00,
      "status": "RECEIVED"
    }
  }'
```

Resposta esperada: `{ "received": true }`

### Validação do Token
- O header `asaas-access-token` deve corresponder ao `ASAAS_WEBHOOK_TOKEN` do `.env`
- Token inválido retorna `401 { "error": "Não autorizado" }`
- Eventos duplicados (mesmo `id`) são ignorados (idempotência)

---

## 5. Testar Expiração (5 min)

### Configurar Expiração Curta
```env
ASAAS_PIX_EXPIRY_MIN=1    # 1 minuto para teste rápido
```

### Comportamento
- Após criar PIX, o campo `expiresAt` é calculado: `now + ASAAS_PIX_EXPIRY_MIN`
- Quando o cliente acessa `GET /api/payment/status/:pedidoId` e o prazo expirou:
  - `consultarESincronizar()` detecta `expiresAt < now`
  - Marca pagamento como `expirado`
  - Emite evento SSE `{ "status": "expirado" }`
- Webhooks recebidos após expiração são processados normalmente (pagamento pode ter sido pago antes do timeout)

### Verificar no Banco
```sql
SELECT id, pedido_id, status, expira_em, pago_em
FROM pagamentos
WHERE status = 'aguardando_pagamento'
ORDER BY criado_em DESC;
```

---

## 6. Investigar Estados

### Estados do Pagamento
| Estado | Descrição |
|--------|-----------|
| `aguardando_pagamento` | PIX criado, aguardando confirmação |
| `pago` | Pagamento confirmado, pedido liberado para produção |
| `expirado` | Prazo excedido sem pagamento |
| `rejeitado` | Pagamento com valor divergente, reembolso solicitado |

### Consultar Pagamentos Pendentes
```sql
SELECT p.id, p.pedido_id, p.asaas_payment_id, p.status, p.valor, p.pix_code
FROM pagamentos p
WHERE p.empresa_id = 1 AND p.status = 'aguardando_pagamento'
ORDER BY p.criado_em DESC;
```

### Investigar Rejeições
- Rejeição automática: quando valor recebido difere do esperado (tolerância: 0.001)
- O sistema solicita reembolso automaticamente via `asaasClient.reembolsar()`
- Para reembolso manual: `POST /api/payment/:id/refund` (requer auth admin)
- Listar rejeitados sem reembolso: `GET /api/payment/rejeitados`

### Investigar Reembolsos
```sql
SELECT id, pedido_id, status, refund_id, refund_status, refund_reason, refundado_em
FROM pagamentos
WHERE refund_id IS NOT NULL
ORDER BY refundado_em DESC;
```

### Consultar no Asaas
- Acesse o painel Asaas → Pagamentos → detalhe do pagamento
- Verifique `status`, `value`, `refund` na API: `GET /payments/{id}`
- Código do cliente Asaas: campo `asaas_customer_id` na tabela `clientes`

---

## 7. Ver Logs

### AppLog (banco de dados)
Logs de pagamento são registrados com `module: 'pagamentos'`:

```sql
SELECT id, level, message, module, meta, created_at
FROM app_logs
WHERE module = 'pagamentos'
ORDER BY created_at DESC
LIMIT 50;
```

Mensagens relevantes:
- `PIX_CREATED` — pagamento criado
- `PIX_CONFIRMED` — pagamento confirmado, pedido em produção
- `PIX_EXPIRED` — pagamento expirado
- `PIX_REJECTED` — pagamento rejeitado (valor divergente)
- `PIX_REFUNDED` — reembolso solicitado
- `PIX_REEMBOLSO_ERRO` — erro ao solicitar reembolso
- `PIX_LIBERAR_ERRO` — erro ao liberar pedido para produção
- `WEBHOOK_DUPLICATE` — evento duplicado ignorado
- `WEBHOOK_ORFAO` — webhook para pagamento não encontrado

### auditService (application logs)
```bash
# Ver logs no console do servidor
# Os logs são escritos via auditService.appLog() → auditQueue → console
```

### Filtros por Nível
```sql
-- Apenas erros
SELECT * FROM app_logs WHERE module = 'pagamentos' AND level = 'error';

-- Apenas warnings
SELECT * FROM app_logs WHERE module = 'pagamentos' AND level = 'warning';
```

---

## 8. Desativar PIX

Para desativar PIX (fallback para comportamento `pendente`):

```env
PIX_ENABLED=false
```

Quando `PIX_ENABLED=false`:
- O fluxo de pagamento não é iniciado
- Pedidos ficam com `paymentStatus: null` (comportamento legado)
- Sem erros — o sistema ignora PIX silenciosamente

---

## 9. Fluxo de Dados (Resumo)

```
Frontend → POST /api/pedidos
  ↓
orderService.criar()
  ↓ (se PIX_ENABLED)
paymentService.criarPixPedido()
  ├── asaasClient.criarCustomer() → customerId
  ├── asaasClient.criarPix() → paymentId, pixCode, pixQrCode
  └── prisma.pagamento.create() → status: aguardando_pagamento
  ↓
SSE: GET /api/payment/status/:pedidoId
  ↓ (pagamento confirmado via webhook ou polling)
webhookRouter.post('/asaas')
  ├── asaasClient.verificarAutenticacao() → header check
  └── paymentService.processarWebhook()
        ├── Idempotência (processedWebhooks)
        ├── confirmarPagamento() → status: pago
        └── liberarPedido() → status: producao
```

---

## 10. Arquivos Relevantes

| Arquivo | Função |
|---------|--------|
| `backend/src/services/asaasClient.js` | Cliente API Asaas (customer, pix, refund, auth) |
| `backend/src/services/paymentService.js` | Lógica de pagamento (criar, webhook, expirar, reembolsar) |
| `backend/src/routes/paymentRoutes.js` | Rotas: SSE status, rejeitados, refund |
| `backend/src/routes/webhookRoutes.js` | Endpoint webhook Asaas |
| `backend/src/config/env.js` | Variáveis de ambiente (linhas 17-21) |
| `backend/prisma/schema.prisma` | Modelos: `Pagamento` (148-173), `ProcessedWebhook` (175-180) |
| `backend/tests/asaasClient.test.js` | Testes do cliente Asaas |
| `backend/tests/paymentService.test.js` | Testes do serviço de pagamento |
| `backend/tests/webhookRoutes.test.js` | Testes do endpoint webhook |
