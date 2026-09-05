# Auditoria de Segurança Completa — SIC.IA

**Data:** 05/09/2026
**Escopo:** Rotas, autenticação, autorização, exposição de dados, multi-tenancy

---

## 1. RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| Total de rotas HTTP | ~85 |
| Rotas públicas (por design) | 18 |
| Rotas autenticadas | 52 |
| Rotas com autorização por role | 48 |
| Rotas com ownership check | 8 |
| Rotas potencialmente vulneráveis | 7 |
| **Críticas (P0)** | **2** |
| **Altas (P1)** | **3** |
| **Médias (P2)** | **4** |
| **Baixas (P3)** | **2** |

---

## 2. TODAS AS ROTAS

### 2.1 Rotas Públicas (sem middleware `authenticate`)

| Método | Rota | Arquivo | Controller | Auth necessária |
|--------|------|---------|------------|-----------------|
| GET | `/health` | app.js | inline | Nenhuma |
| GET | `/` | app.js | inline | Nenhuma |
| GET | `/api/public/produtos` | publicRoutes.js | publicController.listarProdutos | Tenant (slug) |
| GET | `/api/public/categorias` | publicRoutes.js | publicController.listarCategorias | Tenant (slug) |
| GET | `/api/public/loja/status` | publicRoutes.js | publicController.statusLoja | Tenant (slug) |
| GET | `/api/public/loja/settings` | publicRoutes.js | publicController.settingsLoja | Tenant (slug) |
| POST | `/api/public/clientes/register` | publicRoutes.js | publicController.registrarCliente | Tenant (slug) + rate limit |
| POST | `/api/public/clientes/login` | publicRoutes.js | publicController.loginCliente | Tenant (slug) |
| GET | `/api/public/clientes/me` | publicRoutes.js | publicController.clientePerfil | **authenticatePublic** |
| PUT | `/api/public/clientes/me` | publicRoutes.js | publicController.atualizarCliente | **authenticatePublic** |
| DELETE | `/api/public/clientes/me` | publicRoutes.js | publicController.excluirConta | **authenticatePublic** |
| POST | `/api/public/clientes/consent/revogar` | publicRoutes.js | publicController.revogarConsentimento | **authenticatePublic** |
| GET | `/api/public/pedidos` | publicRoutes.js | publicController.listarPedidosCliente | **authenticatePublic** |
| POST | `/api/public/pedidos` | publicRoutes.js | publicController.criarPedido | **authenticatePublic** |
| GET | `/api/public/pedidos/:id` | publicRoutes.js | publicController.buscarPedido | Tenant (slug) |
| GET | `/api/public/cupons/:codigo` | publicRoutes.js | publicController.validarCupom | Tenant (slug) |
| GET | `/api/public/empresa/:slug/contact` | publicRoutes.js | inline | Nenhuma |
| GET | `/api/loja/status` | lojaRoutes.js | lojaController.statusPublic | Tenant (slug) |
| GET | `/api/loja/settings` | lojaRoutes.js | lojaController.settingsPublic | Tenant (slug) |
| POST | `/api/auth/login` | authRoutes.js | authController.login | Rate limit |
| POST | `/api/auth/register-public` | authRoutes.js | authController.criarConta | Rate limit |
| POST | `/api/auth/refresh` | authRoutes.js | authController.refreshToken | Nenhuma |
| POST | `/api/entregador/auth/login` | entregadorAuthRoutes.js | inline | Rate limit |
| POST | `/api/entregador/auth/refresh` | entregadorAuthRoutes.js | inline | Nenhuma |
| GET | `/api/proxy/:service` | proxyRoutes.js | inline | Nenhuma |
| POST | `/api/proxy/:service` | proxyRoutes.js | inline | Nenhuma |
| GET | `/api/payment/status/:pedidoId` | paymentRoutes.js | inline (SSE) | Nenhuma |
| POST | `/webhooks/asaas` | webhookRoutes.js | inline | Token header |
| POST | `/api/webhooks/ifoood` | marketplaceWebhookRoutes.js | inline | **Nenhuma** |
| POST | `/api/webhooks/keeta` | marketplaceWebhookRoutes.js | inline | **Nenhuma** |
| POST | `/api/webhooks/ninefood` | marketplaceWebhookRoutes.js | inline | **Nenhuma** |
| POST | `/api/webhooks/asaas/subscription` | subscriptionRoutes.js | webhookAsaasController | **Nenhuma** |
| GET | `/api/financeiro/integrations/:platform/callback` | financeiroRoutes.js | controller.callback | **Nenhuma** |

### 2.2 Rotas Autenticadas (com middleware `authenticate`)

| Método | Rota | Roles | Ownership | Arquivo |
|--------|------|-------|-----------|---------|
| GET | `/api/admin/` | superadmin | — | adminRoutes.js |
| POST | `/api/admin/` | superadmin | — | adminRoutes.js |
| PUT | `/api/admin/:id` | superadmin | — | adminRoutes.js |
| DELETE | `/api/admin/:id` | superadmin | — | adminRoutes.js |
| GET | `/api/admin/clientes` | superadmin | — | adminRoutes.js |
| PUT | `/api/admin/clientes/:id` | superadmin | — | adminRoutes.js |
| DELETE | `/api/admin/clientes/:id` | superadmin | — | adminRoutes.js |
| POST | `/api/admin/filiais` | superadmin | — | adminRoutes.js |
| GET | `/api/admin/empresas/:id/filiais` | superadmin | — | adminRoutes.js |
| PUT | `/api/admin/empresas/:id/parent` | superadmin | — | adminRoutes.js |
| PUT | `/api/admin/empresas/:id/theme/pending` | superadmin | — | adminRoutes.js |
| PUT | `/api/admin/empresas/:id/theme/approve` | superadmin | — | adminRoutes.js |
| DELETE | `/api/admin/empresa/:id/payment` | superadmin | — | adminRoutes.js |
| GET | `/api/admin/pedidos/preview-limpeza` | superadmin, admin | — | adminRoutes.js |
| POST | `/api/admin/pedidos/limpar-expirados` | superadmin, admin | — | adminRoutes.js |
| GET | `/api/produtos/` | authenticate | — | productRoutes.js |
| GET | `/api/produtos/:id` | authenticate | — | productRoutes.js |
| POST | `/api/produtos/` | superadmin, admin | — | productRoutes.js |
| PUT | `/api/produtos/:id` | superadmin, admin | — | productRoutes.js |
| DELETE | `/api/produtos/:id` | superadmin | — | productRoutes.js |
| GET | `/api/pedidos/` | authenticate | — | orderRoutes.js |
| GET | `/api/pedidos/nao-concluidos` | authenticate | — | orderRoutes.js |
| GET | `/api/pedidos/:id` | authenticate | **pedido** | orderRoutes.js |
| POST | `/api/pedidos/` | authenticate | — | orderRoutes.js |
| PATCH | `/api/pedidos/:id/status` | authenticate | **pedido** | orderRoutes.js |
| DELETE | `/api/pedidos/:id` | authenticate | **pedido** | orderRoutes.js |
| POST | `/api/pedidos/:id/finalizar` | authenticate | **pedido** | orderRoutes.js |
| PATCH | `/api/pedidos/:id/editar` | superadmin, admin, user | **pedido** | orderRoutes.js |
| POST | `/api/pedidos/producao` | authenticate | **pedido** | orderRoutes.js |
| POST | `/api/pedidos/pronto` | authenticate | **pedido** | orderRoutes.js |
| POST | `/api/pedidos/em-rota` | authenticate | **pedido** | orderRoutes.js |
| GET | `/api/entregadores/` | superadmin, admin | — | driverRoutes.js |
| POST | `/api/entregadores/` | superadmin, admin | — | driverRoutes.js |
| PUT | `/api/entregadores/:id` | superadmin, admin | — | driverRoutes.js |
| PATCH | `/api/entregadores/:id/toggle` | superadmin, admin | — | driverRoutes.js |
| PUT | `/api/entregadores/:id/password` | superadmin, admin | — | driverRoutes.js |
| DELETE | `/api/entregadores/:id` | superadmin | — | driverRoutes.js |
| GET | `/api/caixa/hoje` | superadmin, admin | — | cashierRoutes.js |
| POST | `/api/caixa/abrir` | superadmin, admin | — | cashierRoutes.js |
| POST | `/api/caixa/fechar` | superadmin, admin | — | cashierRoutes.js |
| GET | `/api/caixa/relatorios` | superadmin, admin | — | cashierRoutes.js |
| GET | `/api/horarios/` | authenticate | — | scheduleRoutes.js |
| PUT | `/api/horarios/` | superadmin, admin | — | scheduleRoutes.js |
| GET | `/api/categorias/` | authenticate | — | categoriaRoutes.js |
| GET | `/api/categorias/:id` | authenticate | — | categoriaRoutes.js |
| POST | `/api/categorias/` | superadmin, admin | — | categoriaRoutes.js |
| PUT | `/api/categorias/:id` | superadmin, admin | — | categoriaRoutes.js |
| DELETE | `/api/categorias/:id` | superadmin | — | categoriaRoutes.js |
| GET | `/api/whatsapp/` | authenticate | — | whatsappRoutes.js |
| POST | `/api/whatsapp/criar` | superadmin, admin, user | — | whatsappRoutes.js |
| DELETE | `/api/whatsapp/:id` | superadmin, admin, user | — | whatsappRoutes.js |
| POST | `/api/whatsapp/:id/qrcode` | superadmin, admin, user | — | whatsappRoutes.js |
| POST | `/api/whatsapp/:id/reconectar` | superadmin, admin, user | — | whatsappRoutes.js |
| GET | `/api/whatsapp/:id/status` | authenticate | — | whatsappRoutes.js |
| POST | `/api/whatsapp/:id/teste` | superadmin, admin, user | — | whatsappRoutes.js |
| POST | `/api/whatsapp/pedido/:id/contato` | superadmin, admin, user | — | whatsappRoutes.js |
| POST | `/api/upload/` | authenticate | — | uploadRoutes.js |
| GET | `/api/usuarios/` | superadmin | — | userRoutes.js |
| POST | `/api/usuarios/` | superadmin | — | userRoutes.js |
| DELETE | `/api/usuarios/:id` | superadmin | — | userRoutes.js |
| PUT | `/api/usuarios/:id/password` | superadmin | — | userRoutes.js |
| GET | `/api/usuarios/logs` | superadmin | — | userRoutes.js |
| GET | `/api/audit/` | superadmin | — | auditRoutes.js |
| GET | `/api/audit/usuarios` | superadmin | — | auditRoutes.js |
| GET | `/api/entregas/resumo-periodo` | superadmin, admin | — | entregaRoutes.js |
| GET | `/api/entregas/resumo` | superadmin, admin | — | entregaRoutes.js |
| GET | `/api/entregas/` | superadmin, admin | — | entregaRoutes.js |
| POST | `/api/entregas/` | superadmin, admin | — | entregaRoutes.js |
| DELETE | `/api/entregas/:pedidoId` | superadmin, admin | — | entregaRoutes.js |
| GET | `/api/payment/rejeitados` | superadmin, admin | — | paymentRoutes.js |
| POST | `/api/payment/:id/refund` | superadmin, admin | — | paymentRoutes.js |
| GET | `/api/financeiro/balance` | superadmin, admin, user | requireEmpresa | financeiroRoutes.js |
| GET | `/api/financeiro/consolidated` | superadmin, admin | requireEmpresa | financeiroRoutes.js |
| GET | `/api/financeiro/entries` | superadmin, admin, user | requireEmpresa | financeiroRoutes.js |
| GET | `/api/financeiro/closings` | superadmin, admin, user | requireEmpresa | financeiroRoutes.js |
| GET | `/api/financeiro/reconciliations` | superadmin, admin, user | requireEmpresa | financeiroRoutes.js |
| GET | `/api/financeiro/integrations` | superadmin, admin | requireEmpresa | financeiroRoutes.js |
| POST | `/api/financeiro/sync` | superadmin, admin | requireEmpresa | financeiroRoutes.js |
| POST | `/api/financeiro/closing` | superadmin, admin | requireEmpresa | financeiroRoutes.js |
| POST | `/api/financeiro/integrations/:platform/connect` | superadmin, admin | requireEmpresa | financeiroRoutes.js |
| POST | `/api/financeiro/integrations/:platform/disconnect` | superadmin, admin | requireEmpresa | financeiroRoutes.js |
| GET | `/api/admin/integracoes/` | superadmin | — | adminIntegracoesRoutes.js |
| GET | `/api/admin/integracoes/:platform` | superadmin | — | adminIntegracoesRoutes.js |
| GET | `/api/admin/dashboard/summary` | superadmin | — | superadminDashboardRoutes.js |
| GET | `/api/admin/dashboard/empresas` | superadmin | — | superadminDashboardRoutes.js |
| GET | `/api/admin/subscription/list` | superadmin | — | subscriptionRoutes.js |
| GET | `/api/admin/subscription/:empresaId` | superadmin | — | subscriptionRoutes.js |
| POST | `/api/admin/subscription/:empresaId` | superadmin | — | subscriptionRoutes.js |
| PUT | `/api/admin/subscription/:empresaId/status` | superadmin | — | subscriptionRoutes.js |
| GET | `/api/empresa/subscription/status` | admin | subscriptionGuard | subscriptionRoutes.js |
| POST | `/api/empresa/subscription/pay` | admin | subscriptionGuard | subscriptionRoutes.js |
| DELETE | `/api/empresa/subscription/cancel` | admin | subscriptionGuard | subscriptionRoutes.js |
| POST | `/api/admin/pricing` | superadmin | — | pricingRoutes.js |
| GET | `/api/admin/pricing` | superadmin | — | pricingRoutes.js |
| GET | `/api/admin/pricing/current` | superadmin | — | pricingRoutes.js |
| POST | `/api/empresa/payment/setup` | superadmin, admin | — | paymentSetupRoutes.js |
| GET | `/api/empresa/payment/status` | superadmin, admin | — | paymentSetupRoutes.js |
| PUT | `/api/empresa/payment/` | superadmin, admin | — | paymentSetupRoutes.js |
| DELETE | `/api/empresa/payment/` | superadmin, admin | — | paymentSetupRoutes.js |
| GET | `/api/empresa/settlement/actual` | superadmin, admin | — | settlementRoutes.js |
| GET | `/api/empresa/settlement/history` | superadmin, admin | — | settlementRoutes.js |
| GET | `/api/empresa/settlement/global` | superadmin | — | settlementRoutes.js |
| GET | `/api/empresa/settlement/:id` | superadmin, admin | — | settlementRoutes.js |
| GET | `/api/loja/settings-admin` | authenticate | — | lojaRoutes.js |
| PUT | `/api/loja/settings` | superadmin, admin | — | lojaRoutes.js |
| GET | `/api/config` | authenticate | — | app.js |

### 2.3 Rotas de Entregador (com middleware `authenticate + authorize('entregador')`)

| Método | Rota | Arquivo |
|--------|------|---------|
| GET | `/api/entregador/pedidos` | entregadorAppRoutes.js |
| GET | `/api/entregador/pedidos/:id` | entregadorAppRoutes.js |
| POST | `/api/entregador/pedidos/:id/confirmar` | entregadorAppRoutes.js |
| POST | `/api/entregador/pedidos/:id/falha` | entregadorAppRoutes.js |
| GET | `/api/entregador/historico` | entregadorAppRoutes.js |
| GET | `/api/entregador/perfil` | entregadorAppRoutes.js |
| PUT | `/api/entregador/perfil` | entregadorAppRoutes.js |
| POST | `/api/entregador/push/register` | entregadorAppRoutes.js |
| POST | `/api/entregador/push/unregister` | entregadorAppRoutes.js |

---

## 3. ROTAS PÚBLICAS LEGÍTIMAS

| Rota | Justificativa |
|------|---------------|
| `/health` | Health check para monitoramento |
| `/` | Status do backend |
| `/api/public/produtos` | Cardápio público (necessário para clientes) |
| `/api/public/categorias` | Categorias do cardápio |
| `/api/public/loja/status` | Horário de funcionamento |
| `/api/public/loja/settings` | Endereço, telefone, tema da loja |
| `/api/public/clientes/register` | Cadastro de clientes |
| `/api/public/clientes/login` | Login de clientes |
| `/api/public/pedidos/:id` | Consulta de pedido específico |
| `/api/public/cupons/:codigo` | Validação de cupom |
| `/api/public/empresa/:slug/contact` | Contato da empresa |
| `/api/loja/status` | Status da loja (duplicata) |
| `/api/loja/settings` | Configurações públicas (duplicata) |
| `/api/auth/login` | Login admin |
| `/api/auth/register-public` | Registro público admin |
| `/api/auth/refresh` | Refresh token |
| `/api/entregador/auth/login` | Login entregador |
| `/api/entregador/auth/refresh` | Refresh token entregador |
| `/api/proxy/:service` | Proxy geocodificação (com allowlist) |

---

## 4. ROTAS PÚBLICAS INDEVIDAMENTE EXPOSTAS

### P0 — CRÍTICO

#### 4.1 Webhooks de Marketplace sem Autenticação

**Problema:** `/api/webhooks/ifoood`, `/api/webhooks/keeta`, `/api/webhooks/ninefood` não possuem autenticação.

**Arquivo:** `marketplaceWebhookRoutes.js`

**Risco:** Qualquer pessoa pode enviar webhooks falsos para:
- Criar pedidos falsos
- Alterar status de pedidos
- Manipular dados de integração

**Severidade:** CRÍTICO

**Correção:** Adicionar validação de assinatura HMAC ou token para cada marketplace.

#### 4.2 OAuth Callback sem Autenticação

**Problema:** `/api/financeiro/integrations/:platform/callback` não possui autenticação.

**Arquivo:** `financeiroRoutes.js:17`

**Risco:** Tokens OAuth (access_token, refresh_token) podem ser capturados por atacante que intercepte o callback.

**Severidade:** CRÍTICO

**Correção:** Usar state parameter criptografado para validar origem do callback.

### P1 — ALTO

#### 4.3 Webhook Asaas Subscription sem Autenticação

**Problema:** `/api/webhooks/asaas/subscription` não possui validação de token.

**Arquivo:** `subscriptionRoutes.js:30`

**Risco:** Falsificação de webhooks para:
- Ativar assinaturas sem pagamento
- Cancelar assinaturas
- Manipular status de cobrança

**Severidade:** ALTO

**Correção:** Adicionar validação de token/header igual ao webhook principal.

#### 4.4 Criar Pedido sem Autenticação JWT

**Problema:** `POST /api/public/pedidos` aceita pedidos com apenas `aceitePoliticas: true`.

**Arquivo:** `publicController.js:296`

**Risco:**
- Spam de pedidos
- Abuso de sistema de entrega
- Manipulação de preços (se campo `desconto` for manipulável)

**Severidade:** ALTO

**Correção:** Opcional: exigir CAPTCHA ou limitar pedidos por IP/telefone.

#### 4.5 Proxy Expondo Chaves de API

**Problema:** `/api/proxy/:service` expõe chaves de Mapbox, Graphhopper e Geoapify.

**Arquivo:** `proxyRoutes.js`

**Risco:**
- Uso indevido das chaves de API
- Consumo de quota
- Custo financeiro

**Severidade:** ALTO

**Correção:** Adicionar autenticação ou rate limiting mais restritivo para proxy.

### P2 — MÉDIO

#### 4.6 Error Handler Expondo Stack Traces

**Problema:** `errorHandler.js` retorna `requestId` em erros 500.

**Arquivo:** `errorHandler.js:10`

**Risco:** Information disclosure (requestId pode ser usado para correlação).

**Severidade:** MÉDIO

**Correção:** Não retornar requestId em produção.

#### 4.7 Registro Público sem Limite de Empresa

**Problema:** `/api/auth/register-public` cria usuário sem limitar empresa.

**Arquivo:** `authController.js:37`

**Risco:** Criação de contas em qualquer empresa.

**Severidade:** MÉDIO

**Correção:** Limitar registro público a roles específicas ou exigir convite.

#### 4.8 Settings Loja Expondo Dados Internos

**Problema:** `GET /api/loja/settings` retorna todos os campos da empresa.

**Arquivo:** `lojaService.js:84-114`

**Risco:** Exposição de dados internos como `themeSettings` completo.

**Severidade:** MÉDIO

**Correção:** Filtrar campos retornados para o público.

#### 4.9 Pedidos Por ID Sem Rate Limit Específico

**Problema:** `GET /api/public/pedidos/:id` permite enumeração de pedidos.

**Arquivo:** `publicController.js:403`

**Risco:** Enumeração de pedidos para descobrir dados de outros clientes.

**Severidade:** MÉDIO

**Correção:** Usar UUID ou token aleatório em vez de ID sequencial.

### P3 — BAIXO

#### 4.10 CORS Permissivo em Desenvolvimento

**Problema:** `CORS_ORIGIN: '*'` em desenvolvimento.

**Arquivo:** `app.js:87`

**Risco:** Requisições cross-origin em dev.

**Severidade:** BAIXO

**Correção:** Manter `*` apenas em dev, exigir origem explícita em produção.

#### 4.11 Revoked Tokens Eviction

**Problema:** `revokedTokens.clear()` quando >10000 tokens.

**Arquivo:** `tokenService.js:56`

**Risco:** Tokens revogados podem ser reutilizados após clear.

**Severidade:** BAIXO

**Correção:** Usar Redis ou DB para persistir revogações.

---

## 5. ROTAS COM AUTENTICAÇÃO INSUFICIENTE

### 5.1 `GET /api/pedidos/:id` — Ownership Apenas

**Problema:** Rota usa `requireOwnership('pedido')` mas não valida `empresaId` do token vs `empresaId` do pedido.

**Análise:** O `requireOwnership` busca o pedido por ID e verifica `resource.empresaId === req.user.empresaId`. Isso é correto para isolamento tenant.

**Status:** ✅ SEGURO

### 5.2 `GET /api/produtos/:id` — Sem Ownership

**Problema:** Rota usa `authenticate` mas não valida se o produto pertence à empresa do usuário.

**Arquivo:** `productController.js:14`

**Análise:** O `productService.buscar(id, empresaId)` recebe `empresaId` do token. Verificar se o service filtra por empresa.

**Status:** ⚠️ VERIFICAR — O `sql.buscarProduto(id, empresaId)` deve filtrar por empresa.

### 5.3 `DELETE /api/admin/clientes/:id` — Sem Ownership

**Problema:** Superadmin pode deletar qualquer cliente, mas admin não deveria deletar clientes de outra empresa.

**Arquivo:** `adminRoutes.js:25`

**Análise:** A rota está dentro de `router.use(authenticate, authorize('superadmin'))`, então apenas superadmin acessa.

**Status:** ✅ SEGURO (apenas superadmin)

---

## 6. POSSÍVEIS VULNERABILIDADES

### 6.1 IDOR/BOLA

| Endpoint | Risco | Status |
|----------|-------|--------|
| `GET /api/pedidos/:id` | Pedido de outra empresa | ✅ Ownership check |
| `DELETE /api/pedidos/:id` | Deletar pedido de outra empresa | ✅ Ownership check |
| `PATCH /api/pedidos/:id/status` | Alterar status de outro pedido | ✅ Ownership check |
| `GET /api/produtos/:id` | Produto de outra empresa | ⚠️ Verificar service |
| `GET /api/public/pedidos/:id` | Pedido de outra empresa | ❌ **SEM ownership** |

### 6.2 Multi-Tenancy

| Cenário | Status |
|---------|--------|
| Admin A → dados Admin B | ✅ Bloqueado por authenticate + empresaId |
| Cliente A → dados Cliente B | ✅ Bloqueado por token + empresaId |
| Token empresa A em empresa B | ✅ Bloqueado por resolveEmpresa + authenticate |
| Superadmin → qualquer empresa | ✅ Permitido por design |

### 6.3 Webhook Forgery

| Webhook | Mecanismo | Status |
|---------|-----------|--------|
| `/webhooks/asaas` | Token header + timingSafeEqual | ✅ SEGURO |
| `/api/webhooks/asaas/subscription` | **Nenhum** | ❌ VULNERÁVEL |
| `/api/webhooks/ifoood` | **Nenhum** | ❌ VULNERÁVEL |
| `/api/webhooks/keeta` | **Nenhum** | ❌ VULNERÁVEL |
| `/api/webhooks/ninefood` | **Nenhum** | ❌ VULNERÁVEL |

### 6.4 SSRF

| Endpoint | Proteção | Status |
|----------|----------|--------|
| `/api/proxy/:service` | Allowlist de paths | ✅ SEGURO |
| `/api/proxy/:service` | Validação de protocolo | ✅ Apenas HTTPS |
| `/api/proxy/:service` | Validação de redirect | ⚠️ Não verifica redirects |

### 6.5 Rate Limiting

| Endpoint | Rate Limit | Status |
|----------|------------|--------|
| `/api/auth/login` | 5/15min | ✅ |
| `/api/auth/register-public` | 5/hora | ✅ |
| `/api/entregador/auth/login` | 5/15min | ✅ |
| `/api/public/pedidos` (POST) | **Nenhum** | ❌ |
| `/api/proxy/:service` | 60/min (global) | ⚠️ Insuficiente |
| `/api/public/cupons/:codigo` | **Nenhum** | ❌ |

### 6.6 Enumeration

| Endpoint | Risco | Status |
|----------|-------|--------|
| `POST /api/public/clientes/register` | Telefone já cadastrado (409) | ⚠️ Enumeração possível |
| `POST /api/auth/login` | Usuário não encontrado (404) | ⚠️ Enumeração possível |
| `GET /api/public/pedidos/:id` | ID sequencial | ❌ Enumeração possível |

### 6.7 Information Disclosure

| Endpoint | Dados expostos | Status |
|----------|----------------|--------|
| `GET /api/loja/settings` | Todos os campos da empresa | ⚠️ |
| `GET /api/admin/` | Lista completa de empresas (inclui asaasApiKey) | ❌ |
| `GET /api/config` | mapboxToken, graphhopperKey | ⚠️ |

---

## 7. DADOS QUE PODEM SER EXPOSTOS

| Endpoint | Dados em risco |
|----------|----------------|
| `GET /api/admin/` | **asaasApiKey** (criptografada), cpfCnpj, email, asaasSubcontaId |
| `GET /api/loja/settings` | themeSettings completo, bairrosAtendidos |
| `GET /api/public/pedidos/:id` | clienteNome, clienteWhatsapp, clienteEndereco, total |
| `GET /api/config` | mapboxToken, graphhopperKey |
| `GET /api/admin/clientes` | Todos os campos do cliente |

---

## 8. MATRIZ DE AUTORIZAÇÃO

| Rota | Público | Cliente | Admin | Superadmin | Entregador |
|------|---------|---------|-------|------------|------------|
| `/health` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/produtos` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/categorias` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/loja/status` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/loja/settings` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/clientes/register` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/clientes/login` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/clientes/me` | DENY | ALLOW | DENY | DENY | DENY |
| `/api/public/pedidos` (GET) | DENY | ALLOW | DENY | DENY | DENY |
| `/api/public/pedidos` (POST) | DENY | ALLOW | DENY | DENY | DENY |
| `/api/public/pedidos/:id` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/public/cupons/:codigo` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/auth/login` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/auth/register-public` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/auth/refresh` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/entregador/auth/login` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/proxy/:service` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/payment/status/:pedidoId` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/webhooks/asaas` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/webhooks/ifoood` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/webhooks/keeta` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/webhooks/ninefood` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/webhooks/asaas/subscription` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/financeiro/integrations/:callback` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `/api/admin/` | DENY | DENY | DENY | ALLOW | DENY |
| `/api/produtos/` | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/pedidos/` | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/pedidos/:id` | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/entregadores/` | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/caixa/` | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/whatsapp/` | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/usuarios/` | DENY | DENY | DENY | ALLOW | DENY |
| `/api/audit/` | DENY | DENY | DENY | ALLOW | DENY |
| `/api/financeiro/` | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/loja/settings` (PUT) | DENY | DENY | ALLOW | ALLOW | DENY |
| `/api/entregador/pedidos` | DENY | DENY | DENY | DENY | ALLOW |
| `/api/entregador/perfil` | DENY | DENY | DENY | DENY | ALLOW |

---

## 9. PLANO DE CORREÇÃO

### P0 — CRÍTICO

#### 9.1 Webhooks de Marketplace

**Problema:** Sem autenticação em `/api/webhooks/ifoood`, `/api/webhooks/keeta`, `/api/webhooks/ninefood`.

**Arquivo:** `marketplaceWebhookRoutes.js`

**Correção:**
```javascript
// Adicionar validação de token por marketplace
router.post('/ifoood', asyncHandler(async (req, res) => {
  const token = req.headers['x-webhook-token'];
  if (!verificarMarketplaceToken('IFOOD', token)) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  // ... handler existente
}));
```

**Middleware necessário:** Validação de token por marketplace.

**Alteração de controller:** Nenhuma.

**Alteração de schema:** Criar tabela `marketplace_webhook_tokens` ou usar `PlatformSettings`.

**Alteração de frontend:** Nenhuma.

**Teste necessário:** Enviar webhook sem token → 401. Com token válido → 200.

#### 9.2 OAuth Callback

**Problema:** `/api/financeiro/integrations/:platform/callback` sem validação de state.

**Arquivo:** `financeiroRoutes.js:17`

**Correção:**
```javascript
// Usar state parameter criptografado
router.get('/integrations/:platform/callback', asyncHandler(async (req, res) => {
  const { state, code } = req.query;
  if (!state || !validarStateOAuth(state)) {
    return res.status(403).json({ error: 'State inválido' });
  }
  // ... handler existente
}));
```

**Middleware necessário:** Validação de state OAuth.

**Alteração de controller:** Adicionar validação de state.

**Alteração de schema:** Nenhuma.

**Alteração de frontend:** Gerar state criptografado antes do redirect.

**Teste necessário:** Callback com state inválido → 403.

### P1 — ALTO

#### 9.3 Webhook Asaas Subscription

**Problema:** Sem validação de token.

**Arquivo:** `subscriptionRoutes.js:30`

**Correção:** Reutilizar `verificarAutenticacao` do `asaasClient.js`.

**Middleware necessário:** Verificar token no header.

**Alteração de controller:** Adicionar verificação de token.

**Teste necessário:** Webhook sem token → 401.

#### 9.4 Rate Limiting para Criar Pedido

**Problema:** `POST /api/public/pedidos` sem rate limit específico.

**Arquivo:** `publicRoutes.js:19`

**Correção:**
```javascript
const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3, // 3 pedidos por minuto por IP
  message: { error: 'Muitos pedidos. Aguarde 1 minuto.' },
});
router.post('/pedidos', orderLimiter, controller.criarPedido);
```

**Middleware necessário:** Rate limit específico para pedidos.

**Teste necessário:** 4 pedidos em 1 minuto → 429.

#### 9.5 Proxy Rate Limiting

**Problema:** Rate limit global de 60/min insuficiente para proxy.

**Correção:** Rate limit separado e mais restritivo para proxy.

**Teste necessário:** 70 requisições em 1 minuto → 429.

### P2 — MÉDIO

#### 9.6 Error Handler

**Problema:** Retorna `requestId` em erros 500.

**Correção:** Não retornar `requestId` em produção.

#### 9.7 Enumeração de Pedidos

**Problema:** `GET /api/public/pedidos/:id` usa ID sequencial.

**Correção:** Usar UUID ou token aleatório para pedidos públicos.

#### 9.8 Settings Loja

**Problema:** Retorna todos os campos.

**Correção:** Filtrar campos para response pública.

#### 9.9 Admin Lista Empresas

**Problema:** `GET /api/admin/` retorna `asaasApiKey`.

**Correção:** Filtrar campos sensíveis na resposta.

### P3 — BAIXO

#### 9.10 CORS

**Problema:** `*` em desenvolvimento.

**Correção:** Manter como está (dev only).

#### 9.11 Token Revocation

**Problema:** In-memory store com clear periódico.

**Correção:** Usar Redis em produção (futuro).

---

## 10. ORDEM DE IMPLEMENTAÇÃO

1. **P0-1:** Adicionar autenticação em webhooks de marketplace
2. **P0-2:** Adicionar validação de state em OAuth callback
3. **P1-1:** Adicionar autenticação em webhook Asaas subscription
4. **P1-2:** Adicionar rate limit para criar pedido
5. **P1-3:** Adicionar rate limit restritivo para proxy
6. **P2-1:** Filtrar requestId do error handler em produção
7. **P2-2:** Filtrar campos sensíveis em `GET /api/admin/`
8. **P2-3:** Filtrar campos em `GET /api/loja/settings`
9. **P2-4:** Usar UUID para pedidos públicos (futuro)
10. **P3-1:** Manter CORS como está
11. **P3-2:** Documentar necessidade de Redis para revogação

---

## 11. PLANO DE TESTES

### 11.1 Testes Sem Autenticação

```bash
# Webhooks sem token
curl -X POST http://localhost:3000/api/webhooks/ifoood -H "Content-Type: application/json" -d '{"event":"test"}'
# Esperado: 401 ou processamento (verificar)

curl -X POST http://localhost:3000/api/webhooks/keeta -H "Content-Type: application/json" -d '{"event":"test"}'
# Esperado: 401

# OAuth callback sem state
curl "http://localhost:3000/api/financeiro/integrations/ifood/callback?code=test&state=invalid"
# Esperado: 403

# Criar pedido sem token
curl -X POST http://localhost:3000/api/public/pedidos -H "Content-Type: application/json" -d '{"clienteNome":"Test","itens":[]}'
# Esperado: 401 (requer authenticatePublic)
```

### 11.2 Testes Com Autenticação

```bash
# Token empresa A → dados empresa B
TOKEN_A=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"adminA","password":"senha"}' | jq -r '.token')

# Acessar pedido da empresa B com token empresa A
curl http://localhost:3000/api/pedidos/1 -H "Authorization: Bearer $TOKEN_A"
# Esperado: 403 ou 404
```

### 11.3 Testes Multi-Tenant

```bash
# Admin A → empresa A = ALLOW
# Admin A → empresa B = DENY

# Verificar via subdomínio
curl "http://loja-a.localhost:3000/api/produtos" -H "Authorization: Bearer $TOKEN_A"
# Esperado: Produtos da loja A

curl "http://loja-b.localhost:3000/api/produtos" -H "Authorization: Bearer $TOKEN_A"
# Esperado: 403 (empresa não corresponde)
```

### 11.4 Testes de Rate Limit

```bash
# Login com muitas tentativas
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"errada"}'
done
# Esperado: 429 após 5 tentativas

# Criar pedido com muitas requisições
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/public/pedidos -H "Content-Type: application/json" -d '{"clienteNome":"Test","itens":[],"aceitePoliticas":true}'
done
# Esperado: 429 após 3 requisições (após correção P1-2)
```

### 11.5 Testes de Enumeração

```bash
# Enumerar pedidos por ID sequencial
for i in {1..100}; do
  curl -s "http://localhost:3000/api/public/pedidos/$i" | jq -r '.clienteNome // "not found"'
done
# Esperado: Apenas pedidos da empresa atual (se autenticado)
```

---

## 12. RESUMO DOS Achados Críticos

| # | Achado | Severidade | Arquivo | Correção |
|---|--------|------------|---------|----------|
| 1 | Webhooks marketplace sem auth | P0 | marketplaceWebhookRoutes.js | Adicionar token validation |
| 2 | OAuth callback sem state | P0 | financeiroRoutes.js | Validar state parameter |
| 3 | Webhook Asaas subscription sem auth | P1 | subscriptionRoutes.js | Adicionar token validation |
| 4 | Criar pedido sem rate limit | P1 | publicRoutes.js | Adicionar orderLimiter |
| 5 | Proxy com rate limit insuficiente | P1 | proxyRoutes.js | Rate limit separado |
| 6 | Admin lista empresas expõe asaasApiKey | P2 | adminController.js | Filtrar campos |
| 7 | Settings loja expõe todos os campos | P2 | lojaService.js | Filtrar response |
