# Pagamento PIX via Asaas — Design

Data: 2026-08-15
Status: Aprovado

## Objetivo

Implementar fluxo completo de pagamento **PIX** via **Asaas** (API v3). Pedidos PIX ficam em `aguardando_pagamento` até o Asaas confirmar o pagamento. Quando confirmado, o pedido vai **automaticamente** para `producao` (já pago, sem aprovação manual do admin). Pagamentos pendentes aparecem numa aba "Aguardando pagamento" do admin, nunca na fila de produção.

Restrição: NÃO alterar dinheiro, cartão, delivery, retirada, produtos, carrinho, descontos, cupons, usuários, autenticação, relatórios, notificações. PIX é adição isolada.

## Contexto atual

- Checkout: `view/cart.html` + `js/cart.js`. Select `formaPagamento` já contém `pix` (`cart.html:60`), mas hoje PIX = pedido `pendente` normal, cai no admin como qualquer outro. **Nenhum processamento real**.
- Criação de pedido: `POST /api/public/pedidos` → `publicController.criarPedido` → recalcula total no DB (busca preço do produto) → `prisma.pedido.create(status='pendente')`.
- Recalculo já existe em `publicController.criarPedido:251-280` e `sqlRepository.criarPedido:69-90`.
- Frontend público: `js/apiHelper.js` (base `/api/public`), `js/menu.js` (polling via `setInterval`).
- Admin: filtra pedidos por `status` (`pendente`/`producao`/etc.) via `listarPedidosFiltrados`.
- `Pedido.id` String gerado por `sql.nextPedidoId()`. `empresaId:1` hardcoded (single-tenant).
- Env: `backend/src/config/env.js` + `backend/.env.example`. `.gitignore` já cobre `.env`.
- Asaas NÃO está instalado. Nenhum webhook existe hoje. Cliente público tem token JWT (`authenticatePublic`).

## Decisões de design

- **Pagamento separado** em tabela `Pagamento` (1:N Pedido→Pagamento) para suportar nova tentativa de PIX no futuro.
- **PaymentService** abstrai Asaas; só `asaasClient` toca a API. Preparado para multi-tenant futuro (PaymentAccountResolver).
- **Status separado**: `Pagamento.status` + `Pedido.paymentStatus`. `Pedido.status` intocado (fluxo do admin).
- **Release**: pagamento confirmado → `Pedido.status = producao` via `orderService.atualizarStatus` (dispara baixa estoque + WhatsApp existentes).
- **SSE** para o cliente acompanhar confirmação em tempo real.
- **Expiração** 5 min, lazy-check ao consultar + verificação no webhook.
- **Reconciliação**: consulta ao Asaas quando pedido ainda `aguardando_pagamento` (auto-cura webhook perdido).
- **Refund manual** no admin para pagamentos `rejeitado`.

## Modelo de dados

### Nova tabela `Pagamento` (`pagamentos`)

```
id                 Int @id @default(autoincrement())
pedidoId           String @map("pedido_id")
empresaId          Int @map("empresa_id")
asaasPaymentId     String @unique @map("asaas_payment_id")
asaasCustomerId    String? @map("asaas_customer_id")
metodo             String @default("pix")
valor              Decimal @db.Decimal(10,2)
pixCode            String? @map("pix_code")       // copia e cola
pixQrCode          String? @map("pix_qr_code")    // base64 do QR
status             String @default("aguardando_pagamento")
expiresAt          DateTime? @map("expira_em")
paidAt             DateTime? @map("pago_em")
rejeitadoEm        DateTime? @map("rejeitado_em")
refundId           String? @map("refund_id")
refundStatus       String? @map("refund_status")
refundReason       String? @map("refund_reason")
refundedAt         DateTime? @map("refundado_em")
createdAt          DateTime @default(now()) @map("criado_em")
pedido             Pedido @relation(fields: [pedidoId], references: [id])
empresa            Empresa @relation(fields: [empresaId], references: [id])
@@map("pagamentos")
```

`Pagamento.status` valores: `aguardando_pagamento`, `pago`, `expirado`, `rejeitado`.

### Campos novos em `Pedido`
```
paymentStatus String? @map("payment_status")  // aguardando_pagamento | pago | expirado | rejeitado
paymentMethod String? @map("payment_method")  // 'pix' — espelho de formaPagamento p/ consulta rápida
paymentId     Int? @map("payment_id")          // último Pagamento ativo
```
Pedidos não-PIX: `paymentStatus = null`, `paymentMethod = null`.

### Campos novos em `Cliente`
```
asaasCustomerId String? @map("asaas_customer_id")
```
Mapeado 1:1 com o customer Asaas (reutilizado entre compras). Preenchido na primeira compra PIX.

### Migration
`prisma db push` (projeto usa push, não `migrate dev`, no fluxo Vercel). 1 tabela nova + 3 colunas em `Pedido` + 1 em `Cliente`.

## Backend

### Arquivos novos
```
backend/src/services/asaasClient.js       // único ponto que chama Asaas API v3
backend/src/services/paymentService.js    // orquestra PIX, consulta, refund, webhook, liberação
backend/src/routes/paymentRoutes.js       // /api/payment (admin) + /api/public/payment
backend/src/routes/webhookRoutes.js       // /webhooks/asaas
```

### asaasClient.js
```
criarCustomer({nome, cpf, phone})
criarPix({customerId, valor, descricao, dueDate})
consultarPayment(paymentId)
reembolsar(paymentId, valor)
verificarAutenticacao(headerToken)   // header 'asaas-access-token' vs ASAAS_WEBHOOK_TOKEN

> Nota (docs Asaas): webhook autentica via header `asaas-access-token` (token 32-255 chars), **não** HMAC signature. Evento de PIX pago é `PAYMENT_RECEIVED` (não `PAYMENT_CONFIRMED`). Webhook envia apenas `payment.id` — buscar valor via `GET /payments/{id}` para validar.
```
- Credencial via `env`. Token **nunca** no frontend/git/logs.
- Base URL: prod `https://www.asaas.com/api/v3`, sandbox `https://sandbox.asaas.com/api/v3` (via `ASAAS_ENV`).

### paymentService.js
```
criarPixPedido(pedidoId, cliente)      // cria/retorna Pagamento, chama Asaas, salva QR/code/expiry
consultarESincronizar(pedidoId)        // se aguardando_pagamento → GET Asaas → reconcilia
processarWebhook(evento)               // valida assinatura, idempotência, valor, status
reembolsar(pagamentoId, motivo)        // refund idempotente
liberarPedido(pedido)                  // status→producao + baixa estoque + notificação
```

### Fluxos

**Criar PIX** — `POST /api/public/payment/pix` (auth cliente):
1. Recalcula total no DB (produtos, quantidades, taxas, desconto — reuso de `publicController.criarPedido`).
2. Valida CPF (formato 11 dígitos).
3. Cria `Pagamento` + `Pedido` (`status='aguardando_pagamento'`, `paymentStatus='aguardando_pagamento'`).
4. `asaasClient.criarPix` (`dueDate` = now+5min). Salva `asaasPaymentId`, `pixCode`, `pixQrCode`, `expiresAt`.
5. Preenche `Cliente.asaasCustomerId` se ausente.
6. Responde `{ pedidoId, pagamento: { id, pixCode, pixQrCode, expiresAt } }`.

**Webhook** — `POST /webhooks/asaas`:
1. Verifica header `asaas-access-token` == `ASAAS_WEBHOOK_TOKEN` → 401 se inválida.
2. Idempotência: `processed_webhooks` → 200 se já processado.
3. Localiza `Pagamento` por `asaasPaymentId`.
4. `Pagamento` inexistente → reembolso automático (valor veio sem pedido), log, 200.
5. `GET /payments/{id}` no Asaas → valida **valor exato** e status Asaas == `RECEIVED`.
   - Valor divergente → reembolso automático, `status='rejeitado'`, `rejeitadoEm=now`, **não libera**.
6. Marca `Pagamento.status='pago'`, `paidAt`, `Pedido.paymentStatus='pago'`.
7. `liberarPedido`: `Pedido.status` → `producao` via `orderService.atualizarStatus`.
8. Grava `processed_webhooks` + logs.
9. Responde `200 {received:true}` sempre.

**Reconciliação** — consulta de pedido (SSE/polling/refresh) quando ainda `aguardando_pagamento`: `GET Asaas /payments/:id`, sincroniza status (pago→libera, expirado/cancelado→expirado).

**Expiração (5 min)**:
- `expiresAt` = criado+5min. Lazy-check: ao consultar/receber webhook, se `now > expiresAt` e não pago → `status='expirado'`, **não libera**, sem refund (nada recebido).
- Webhook `RECEIVED` após expirar, valor correto, Asaas confirma → aceita (pagou dentro do prazo do banco) → libera.
- Webhook `RECEIVED` após expirar, valor divergente → reembolso.

**Reembolso automático**:
- Só quando valor recebido real e não pode ser aceito (valor divergente / sem pedido).
- Salva `refundId`, `refundStatus`, `refundedAt`, `refundReason`. Idempotente (1 refund por `Pagamento`).

### Idempotência
- `processed_webhooks` (evento + hash) — evento já visto ignorado.
- Refund só se `status='pago'|'rejeitado'` e `refundId IS NULL`.
- Frontend nunca define `paymentStatus`/valor/`paymentId`/refund. Backend recalcula total.

### Logs
`PIX_CREATED`, `PIX_CONFIRMED`, `PIX_EXPIRED`, `PIX_REJECTED`, `PIX_REFUNDED`, `WEBHOOK_INVALID`, `WEBHOOK_DUPLICATE` via `auditService`/`AppLog`. Sem tokens/segredos.

## Frontend

**Checkout (`view/cart.html` + `js/cart.js`)**:
- Campo `#cpfCliente` visível só quando `formaPagamento === 'pix'` (via `atualizarCamposEntrega`).
- `generateOrder()`: se PIX, valida CPF, inclui `cpf` no payload.
- `publicController.criarPedido`: se `formaPagamento==='pix'` → cria pedido + `paymentService.criarPixPedido` → responde dados PIX.
- Tela PIX (adaptar `orderOverlay`): QR (img base64), copia-e-cola, botão "Copiar código" (toast "Código copiado!"), "Aguardando pagamento...", instrução de liberação.

**Status em tempo real (`js/apiHelper.js` + acompanhamento)**:
- `GET /api/public/payment/status/:pedidoId` → SSE (`text/event-stream`).
- Frontend abre `EventSource`, evento `pago` → "Pagamento confirmado! Pedido recebido." / `expirado` → "Pagamento expirado".
- EventSource auto-reconnect nativo; fallback polling 5s se necessário.

## Admin

- Aba nova **"Aguardando pagamento"**: lista pedidos `status='aguardando_pagamento'` + `paymentStatus='aguardando_pagamento'` (read-only, sem botão aceitar). Só webhook move.
- Pagamento confirmado → pedido vai automaticamente para `producao` (aba normal).
- Pedidos não-PIX intocados.

### Refund manual (aba "Reembolsos")
- Lista `Pagamento` onde `status='rejeitado'` e `refundId IS NULL`, com join `Pedido`.
- Colunas exibidas: cliente nome, WhatsApp, Pedido #id, data/hora criação do pedido, data/hora PIX rejeitado (`rejeitadoEm`), valor, motivo (`refundReason`), botão "Reembolsar".
- `POST /api/payment/:id/refund` (auth `superadmin`/`admin`): valida `status='rejeitado'` e `refundId IS NULL`, chama `asaasClient.reembolsar`, salva refund fields. Idempotente. Pedido **não** libera.
- Refund **nunca** de `aguardando_pagamento`/`expirado` (nada recebido).

## Variáveis de ambiente

`backend/.env` + `.env.example`:
```
ASAAS_ACCESS_TOKEN=
ASAAS_WEBHOOK_TOKEN=
ASAAS_ENV=production|sandbox
ASAAS_PIX_EXPIRY_MIN=5
PIX_ENABLED=true|false     // feature flag
```
Token nunca commitado (`.gitignore` já cobre `.env`).

## Testes (Vitest, `backend/tests/`)

1. Dinheiro/cartão — criar pedido não-PIX continua `pendente`, cai no admin (regressão).
2. PIX criação — POST pedido PIX (mock Asaas) → cria `Pagamento`, retorna QR/code, `aguardando_pagamento`.
3. Cliente não paga — passa 5min → `expirado`, não libera, sem refund.
4. Cliente paga — webhook validado → `pago` → pedido vai `producao`.
5. Webhook duplicado — mesmo evento 3x → processa 1x.
6. Webhook inválido (assinatura/valor) — rejeita, não libera.
7. Valor menor — rejeita, reembolsa, não libera.
8. Valor maior — idem.
9. Frontend altera status/valor — backend ignora/recalcula.
10. CPF inválido — rejeita criar PIX.
11. Reconciliação — consulta pendente após Asaas confirmar (webhook perdido) → sincroniza `pago`.
12. SSE — evento emit no webhook → stream recebe.

## Riscos

- Asaas em sandbox vs produção (validar conta ativa para PIX).
- Webhook delivery atrasado — mitigado por reconciliação.
- Pedidos PIX fantasmas se expiração não sincronizar — mitigado por lazy-check + reconciliação.
- Refund duplicado — mitigado por `refundId IS NULL` check.

## Plano de rollback

- Feature flag `PIX_ENABLED=false` → PIX volta ao comportamento atual (pedido `pendente` normal).
- Reverter migration: drop `pagamentos`, remover cols novas.
- Pedidos já pagos mantêm `status=producao`.
- Refund manual via Asaas dashboard se necessário.

## Documentação

`docs/` — configurar Asaas (criar conta, webhook URL, sandbox vs prod), testar PIX, testar webhook (curl payload/assinatura), testar expiração, investigar pendente/rejeitado/refund, ver logs.

## Critério de sucesso

```
Cliente seleciona PIX → finaliza → backend recalcula → cria Pagamento + Asaas PIX
→ QR + copia-e-cola → cliente paga (ou não)
→ webhook confirmado → valida valor/status/idempotência → pago
→ pedido automaticamente para producao (admin vê)
Nunca: pedido PIX na fila de produção sem pagamento confirmado.
```
