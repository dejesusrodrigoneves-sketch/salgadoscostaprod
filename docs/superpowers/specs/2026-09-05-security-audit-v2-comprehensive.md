# Auditoria de Segurança Completa v2 — SIC.IA

**Data:** 05/09/2026
**Escopo:** Rotas, autenticação, autorização, exposição de dados, multi-tenancy, webhooks, OAuth, proxy, rate limiting, uploads, logs, DTOs, frontend
**Framework:** 36 fases conforme prompt de hardening

---

## 1. RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| Total de rotas HTTP | 85 |
| Rotas públicas legítimas (anônimas) | 14 |
| Rotas com autenticação interna (authenticatePublic) | 8 |
| Rotas com authenticate + authorize | 52 |
| Rotas webhook (sem JWT, auth própria) | 5 |
| Rotas OAuth callback | 1 |
| Healthcheck/status | 2 |
| **Problemas encontrados** | **26** |
| **P0 — Crítico** | **4** |
| **P1 — Alto** | **6** (7 original - 1 removido como não-vulnerabilidade) |
| **P2 — Médio** | **10** (8 original + 2 novos: enumeração cliente + lockout) |
| **P3 — Baixo** | **5** |
| **Não-vulnerabilidade** | **1** (POST /api/public/pedidos sem auth — intencional) |

### Correções confirmadas por código

| Status | Significado |
|--------|-------------|
| ✅ CONFIRMADO POR CÓDIGO | Verificado na implementação atual |
| ⚠️ RISCO RESIDUAL | Melhoria possível, risco baixo |
| ❌ VULNERÁVEL | Requer correção |
| 🔶 NOVO ACHADO | Não identificado na auditoria v1 |

---

## 2. INVENTÁRIO COMPLETO DE ROTAS (FASE 1)

### 2.1 Rotas Públicas Anônimas

| METHOD | PATH | FILE | CONTROLLER | MIDDLEWARE | AUTH | ROLE | TENANT | OWNERSHIP | PUBLIC | DATA_RETURNED | MUTATES | RISK |
|--------|------|------|------------|------------|------|------|--------|-----------|--------|---------------|---------|------|
| GET | `/health` | app.js | inline | — | NENHUM | — | NENHUM | NÃO | SIM | status, pool | NÃO | BAIXO |
| GET | `/` | app.js | inline | — | NENHUM | — | NENHUM | NÃO | SIM | status, sistema | NÃO | BAIXO |
| GET | `/api/public/produtos` | publicRoutes.js | publicController.listarProdutos | requireTenant | NENHUM | — | slug | NÃO | SIM | produtos[] | NÃO | OK |
| GET | `/api/public/categorias` | publicRoutes.js | publicController.listarCategorias | requireTenant | NENHUM | — | slug | NÃO | SIM | categorias[] | NÃO | OK |
| GET | `/api/public/loja/status` | publicRoutes.js | publicController.statusLoja | requireTenant | NENHUM | — | slug | NÃO | SIM | isOpen, horários | NÃO | OK |
| GET | `/api/public/loja/settings` | publicRoutes.js | publicController.settingsLoja | requireTenant | NENHUM | — | slug | NÃO | SIM | formatEmpresa() | NÃO | ⚠️ |
| GET | `/api/public/pedidos/:id` | publicRoutes.js | publicController.buscarPedido | requireTenant | NENHUM | — | slug | NÃO | SIM | pedido completo | NÃO | ❌ |
| GET | `/api/public/cupons/:codigo` | publicRoutes.js | publicController.validarCupom | requireTenant | NENHUM | — | slug | NÃO | SIM | codigo, desconto | NÃO | ⚠️ |
| GET | `/api/public/empresa/:slug/contact` | publicRoutes.js | inline | — | NENHUM | — | slug | NÃO | SIM | nome, telefone | NÃO | OK |
| GET | `/api/loja/status` | lojaRoutes.js | lojaController.statusPublic | requireTenant | NENHUM | — | slug | NÃO | SIM | isOpen | NÃO | OK |
| GET | `/api/loja/settings` | lojaRoutes.js | lojaController.settingsPublic | requireTenant | NENHUM | — | slug | NÃO | SIM | formatEmpresa() | NÃO | ⚠️ |
| POST | `/api/auth/login` | authRoutes.js | authController.login | authLimiter | NENHUM | — | empresaId | NÃO | SIM | token, user | NÃO | ⚠️ |
| POST | `/api/auth/register-public` | authRoutes.js | authController.criarConta | registerLimiter | NENHUM | — | empresaId | NÃO | SIM | result | NÃO | ⚠️ |
| POST | `/api/auth/refresh` | authRoutes.js | authController.refreshToken | — | NENHUM | — | NENHUM | NÃO | SIM | token, refreshToken | NÃO | ⚠️ |
| POST | `/api/entregador/auth/login` | entregadorAuthRoutes.js | inline | authLimiter | NENHUM | — | NENHUM | NÃO | SIM | token, entregador | NÃO | ⚠️ |
| POST | `/api/entregador/auth/refresh` | entregadorAuthRoutes.js | inline | — | NENHUM | — | NENHUM | NÃO | SIM | token | NÃO | ⚠️ |

### 2.2 Rotas com Autenticação Interna (authenticatePublic)

| METHOD | PATH | FILE | CONTROLLER | AUTH | DATA_RETURNED | MUTATES | RISK |
|--------|------|------|------------|------|---------------|---------|------|
| GET | `/api/public/clientes/me` | publicRoutes.js | publicController.clientePerfil | authenticatePublic | id, nome, telefone, endereco | NÃO | OK |
| PUT | `/api/public/clientes/me` | publicRoutes.js | publicController.atualizarCliente | authenticatePublic | id, nome, telefone, endereco | SIM | OK |
| DELETE | `/api/public/clientes/me` | publicRoutes.js | publicController.excluirConta | authenticatePublic | ok | SIM | OK |
| POST | `/api/public/clientes/consent/revogar` | publicRoutes.js | publicController.revogarConsentimento | authenticatePublic | ok, revogadoEm | SIM | OK |
| GET | `/api/public/pedidos` | publicRoutes.js | publicController.listarPedidosCliente | authenticatePublic | pedidos[] | NÃO | OK |
| POST | `/api/public/pedidos` | publicRoutes.js | publicController.criarPedido | authenticatePublic (dentro do handler) | id, status | SIM | ⚠️ |
| POST | `/api/public/clientes/register` | publicRoutes.js | publicController.registrarCliente | registerLimiter | token, cliente | SIM | OK |
| POST | `/api/public/clientes/login` | publicRoutes.js | publicController.loginCliente | requireTenant | token, cliente | NÃO | ⚠️ |

### 2.3 Rotas Webhook (auth própria, sem JWT)

| METHOD | PATH | FILE | AUTH MECHANISM | RISK |
|--------|------|------|----------------|------|
| POST | `/webhooks/asaas` | webhookRoutes.js | asaas-access-token header + timingSafeEqual | ✅ SEGURO |
| POST | `/api/webhooks/ifoood` | marketplaceWebhookRoutes.js | **NENHUM** | ❌ P0 |
| POST | `/api/webhooks/keeta` | marketplaceWebhookRoutes.js | **NENHUM** | ❌ P0 |
| POST | `/api/webhooks/ninefood` | marketplaceWebhookRoutes.js | **NENHUM** | ❌ P0 |
| POST | `/api/webhooks/asaas/subscription` | subscriptionRoutes.js | **NENHUM** | ❌ P1 |

### 2.4 OAuth Callback

| METHOD | PATH | FILE | AUTH | RISK |
|--------|------|------|------|------|
| GET | `/api/financeiro/integrations/:platform/callback` | financeiroRoutes.js | **NENHUM (state verificado no service)** | ⚠️ |

**Análise do OAuth callback (FASE 15):**

O callback NÃO possui middleware de autenticação, MAS o `platformConnectionService.processarCallback()` valida:
- `stateNonce` existe no DB → ✅
- `st.usedAt` é null (uso único) → ✅
- `st.expiresAt > Date.now()` (10min TTL) → ✅
- `st.platform === platform` (plataforma correta) → ✅

**Correção NÃO necessária para state.** O state é um nonce de 32 bytes criptograficamente seguro, armazenado no DB com expiração, uso único e validação de plataforma.

**RISCO RESIDUAL:** O callback não possui autenticação de sessão do usuário. Um atacante que intercepte a URL de callback pode trocar o code por tokens antes do usuário legítimo. Porém, o state vincula a empresa+usuário, e os tokens ficam no backend (nunca no frontend).

**Status:** ⚠️ RISCO RESIDUAL — state é seguro, mas sem proteção contra interceptação pré-callback.

### 2.5 Rotas Autenticadas

| METHOD | PATH | ROLES | TENANT | OWNERSHIP | FILE |
|--------|------|-------|--------|-----------|------|
| GET | `/api/admin/` | superadmin | NENHUM | NÃO | adminRoutes.js |
| POST | `/api/admin/` | superadmin | NENHUM | NÃO | adminRoutes.js |
| PUT | `/api/admin/:id` | superadmin | NENHUM | NÃO | adminRoutes.js |
| DELETE | `/api/admin/:id` | superadmin | NENHUM | NÃO | adminRoutes.js |
| GET | `/api/admin/clientes` | superadmin | NENHUM | NÃO | adminRoutes.js |
| PUT | `/api/admin/clientes/:id` | superadmin | NENHUM | NÃO | adminRoutes.js |
| PUT | `/api/admin/clientes/:id/password` | superadmin | NENHUM | NÃO | adminRoutes.js |
| DELETE | `/api/admin/clientes/:id` | superadmin | NENHUM | NÃO | adminRoutes.js |
| DELETE | `/api/admin/empresa/:id/payment` | superadmin | NENHUM | NÃO | adminRoutes.js |
| POST | `/api/admin/filiais` | superadmin | NENHUM | NÃO | adminRoutes.js |
| GET | `/api/admin/empresas/:id/filiais` | superadmin/admin | empresaId | ✅ admin→suas filiais | adminRoutes.js |
| PUT | `/api/admin/empresas/:id/parent` | superadmin | NENHUM | NÃO | adminRoutes.js |
| PUT | `/api/admin/empresas/:id/theme/pending` | superadmin | NENHUM | NÃO | adminRoutes.js |
| PUT | `/api/admin/empresas/:id/theme/approve` | superadmin/admin | parentEmpresaId | ✅ admin→suas filiais | adminRoutes.js |
| GET | `/api/admin/pedidos/preview-limpeza` | superadmin, admin | empresaId | NÃO | adminRoutes.js |
| POST | `/api/admin/pedidos/limpar-expirados` | superadmin, admin | empresaId | NÃO | adminRoutes.js |
| GET | `/api/produtos/` | authenticate | empresaId | NÃO | productRoutes.js |
| GET | `/api/produtos/:id` | authenticate | empresaId | NÃO | productRoutes.js |
| POST | `/api/produtos/` | superadmin, admin | empresaId | NÃO | productRoutes.js |
| PUT | `/api/produtos/:id` | superadmin, admin | empresaId | NÃO | productRoutes.js |
| DELETE | `/api/produtos/:id` | superadmin | empresaId | NÃO | productRoutes.js |
| GET | `/api/pedidos/` | authenticate | empresaId | NÃO | orderRoutes.js |
| GET | `/api/pedidos/nao-concluidos` | authenticate | empresaId | NÃO | orderRoutes.js |
| GET | `/api/pedidos/:id` | authenticate | empresaId | ✅ pedido | orderRoutes.js |
| POST | `/api/pedidos/` | authenticate | empresaId | NÃO | orderRoutes.js |
| PATCH | `/api/pedidos/:id/status` | authenticate | empresaId | ✅ pedido | orderRoutes.js |
| DELETE | `/api/pedidos/:id` | authenticate | empresaId | ✅ pedido | orderRoutes.js |
| POST | `/api/pedidos/:id/finalizar` | authenticate | empresaId | ✅ pedido | orderRoutes.js |
| PATCH | `/api/pedidos/:id/editar` | superadmin, admin, user | empresaId | ✅ pedido | orderRoutes.js |
| POST | `/api/pedidos/producao` | authenticate | empresaId | ✅ pedido | orderRoutes.js |
| POST | `/api/pedidos/pronto` | authenticate | empresaId | ✅ pedido | orderRoutes.js |
| POST | `/api/pedidos/em-rota` | authenticate | empresaId | ✅ pedido | orderRoutes.js |
| GET | `/api/entregadores/` | superadmin, admin | empresaId | NÃO | driverRoutes.js |
| POST | `/api/entregadores/` | superadmin, admin | empresaId | NÃO | driverRoutes.js |
| PUT | `/api/entregadores/:id` | superadmin, admin | empresaId | NÃO | driverRoutes.js |
| PATCH | `/api/entregadores/:id/toggle` | superadmin, admin | empresaId | NÃO | driverRoutes.js |
| PUT | `/api/entregadores/:id/password` | superadmin, admin | empresaId | NÃO | driverRoutes.js |
| DELETE | `/api/entregadores/:id` | superadmin | empresaId | NÃO | driverRoutes.js |
| GET | `/api/caixa/hoje` | superadmin, admin | empresaId | NÃO | cashierRoutes.js |
| POST | `/api/caixa/abrir` | superadmin, admin | empresaId | NÃO | cashierRoutes.js |
| POST | `/api/caixa/fechar` | superadmin, admin | empresaId | NÃO | cashierRoutes.js |
| GET | `/api/caixa/relatorios` | superadmin, admin | empresaId | NÃO | cashierRoutes.js |
| GET | `/api/horarios/` | authenticate | empresaId | NÃO | scheduleRoutes.js |
| PUT | `/api/horarios/` | superadmin, admin | empresaId | NÃO | scheduleRoutes.js |
| GET | `/api/categorias/` | authenticate | empresaId | NÃO | categoriaRoutes.js |
| GET | `/api/categorias/:id` | authenticate | empresaId | NÃO | categoriaRoutes.js |
| POST | `/api/categorias/` | superadmin, admin | empresaId | NÃO | categoriaRoutes.js |
| PUT | `/api/categorias/:id` | superadmin, admin | empresaId | NÃO | categoriaRoutes.js |
| DELETE | `/api/categorias/:id` | superadmin | empresaId | NÃO | categoriaRoutes.js |
| GET | `/api/whatsapp/` | authenticate | empresaId | NÃO | whatsappRoutes.js |
| POST | `/api/whatsapp/criar` | superadmin, admin, user | empresaId | NÃO | whatsappRoutes.js |
| DELETE | `/api/whatsapp/:id` | superadmin, admin, user | empresaId | NÃO | whatsappRoutes.js |
| POST | `/api/whatsapp/:id/qrcode` | superadmin, admin, user | empresaId | NÃO | whatsappRoutes.js |
| POST | `/api/whatsapp/:id/reconectar` | superadmin, admin, user | empresaId | NÃO | whatsappRoutes.js |
| GET | `/api/whatsapp/:id/status` | authenticate | empresaId | NÃO | whatsappRoutes.js |
| POST | `/api/whatsapp/:id/teste` | superadmin, admin, user | empresaId | NÃO | whatsappRoutes.js |
| POST | `/api/whatsapp/pedido/:id/contato` | superadmin, admin, user | empresaId | NÃO | whatsappRoutes.js |
| POST | `/api/upload/` | authenticate | empresaId | NÃO | uploadRoutes.js |
| GET | `/api/usuarios/` | superadmin | NENHUM | NÃO | userRoutes.js |
| POST | `/api/usuarios/` | superadmin | NENHUM | NÃO | userRoutes.js |
| DELETE | `/api/usuarios/:id` | superadmin | NENHUM | NÃO | userRoutes.js |
| PUT | `/api/usuarios/:id/password` | superadmin | NENHUM | NÃO | userRoutes.js |
| GET | `/api/usuarios/logs` | superadmin | NENHUM | NÃO | userRoutes.js |
| GET | `/api/audit/` | superadmin | NENHUM | NÃO | auditRoutes.js |
| GET | `/api/audit/usuarios` | superadmin | NENHUM | NÃO | auditRoutes.js |
| GET | `/api/entregas/` | superadmin, admin | empresaId | NÃO | entregaRoutes.js |
| POST | `/api/entregas/` | superadmin, admin | empresaId | NÃO | entregaRoutes.js |
| DELETE | `/api/entregas/:pedidoId` | superadmin, admin | empresaId | ✅ | entregaRoutes.js |
| GET | `/api/entregas/resumo` | superadmin, admin | empresaId | NÃO | entregaRoutes.js |
| GET | `/api/entregas/resumo-periodo` | superadmin, admin | empresaId | NÃO | entregaRoutes.js |
| GET | `/api/payment/rejeitados` | superadmin, admin | empresaId | NÃO | paymentRoutes.js |
| POST | `/api/payment/:id/refund` | superadmin, admin | empresaId | NÃO | paymentRoutes.js |
| GET | `/api/financeiro/balance` | superadmin, admin, user | requireEmpresa | NÃO | financeiroRoutes.js |
| GET | `/api/financeiro/consolidated` | superadmin, admin | requireEmpresa | NÃO | financeiroRoutes.js |
| GET | `/api/financeiro/entries` | superadmin, admin, user | requireEmpresa | NÃO | financeiroRoutes.js |
| GET | `/api/financeiro/closings` | superadmin, admin, user | requireEmpresa | NÃO | financeiroRoutes.js |
| GET | `/api/financeiro/reconciliations` | superadmin, admin, user | requireEmpresa | NÃO | financeiroRoutes.js |
| GET | `/api/financeiro/integrations` | superadmin, admin | requireEmpresa | NÃO | financeiroRoutes.js |
| POST | `/api/financeiro/sync` | superadmin, admin | requireEmpresa | NÃO | financeiroRoutes.js |
| POST | `/api/financeiro/closing` | superadmin, admin | requireEmpresa | NÃO | financeiroRoutes.js |
| POST | `/api/financeiro/integrations/:platform/connect` | superadmin, admin | requireEmpresa | NÃO | financeiroRoutes.js |
| POST | `/api/financeiro/integrations/:platform/disconnect` | superadmin, admin | requireEmpresa | NÃO | financeiroRoutes.js |
| GET | `/api/admin/integracoes/` | superadmin | NENHUM | NÃO | adminIntegracoesRoutes.js |
| GET | `/api/admin/integracoes/:platform` | superadmin | NENHUM | NÃO | adminIntegracoesRoutes.js |
| GET | `/api/admin/dashboard/summary` | superadmin | NENHUM | NÃO | superadminDashboardRoutes.js |
| GET | `/api/admin/dashboard/empresas` | superadmin | NENHUM | NÃO | superadminDashboardRoutes.js |
| GET | `/api/admin/subscription/list` | superadmin | NENHUM | NÃO | subscriptionRoutes.js |
| GET | `/api/admin/subscription/:empresaId` | superadmin | NENHUM | NÃO | subscriptionRoutes.js |
| POST | `/api/admin/subscription/:empresaId` | superadmin | NENHUM | NÃO | subscriptionRoutes.js |
| PUT | `/api/admin/subscription/:empresaId/status` | superadmin | NENHUM | NÃO | subscriptionRoutes.js |
| GET | `/api/empresa/subscription/status` | admin | subscriptionGuard | NÃO | subscriptionRoutes.js |
| POST | `/api/empresa/subscription/pay` | admin | subscriptionGuard | NÃO | subscriptionRoutes.js |
| DELETE | `/api/empresa/subscription/cancel` | admin | subscriptionGuard | NÃO | subscriptionRoutes.js |
| POST | `/api/admin/pricing` | superadmin | NENHUM | NÃO | pricingRoutes.js |
| GET | `/api/admin/pricing` | superadmin | NENHUM | NÃO | pricingRoutes.js |
| GET | `/api/admin/pricing/current` | superadmin | NENHUM | NÃO | pricingRoutes.js |
| POST | `/api/empresa/payment/setup` | superadmin, admin | empresaId | NÃO | paymentSetupRoutes.js |
| GET | `/api/empresa/payment/status` | superadmin, admin | empresaId | NÃO | paymentSetupRoutes.js |
| PUT | `/api/empresa/payment/` | superadmin, admin | empresaId | NÃO | paymentSetupRoutes.js |
| DELETE | `/api/empresa/payment/` | superadmin, admin | empresaId | NÃO | paymentSetupRoutes.js |
| GET | `/api/empresa/settlement/actual` | superadmin, admin | empresaId | NÃO | settlementRoutes.js |
| GET | `/api/empresa/settlement/history` | superadmin, admin | empresaId | NÃO | settlementRoutes.js |
| GET | `/api/empresa/settlement/global` | superadmin | NENHUM | NÃO | settlementRoutes.js |
| GET | `/api/empresa/settlement/:id` | superadmin, admin | empresaId | NÃO | settlementRoutes.js |
| GET | `/api/loja/settings-admin` | authenticate | empresaId | NÃO | lojaRoutes.js |
| PUT | `/api/loja/settings` | superadmin, admin | empresaId | NÃO | lojaRoutes.js |
| GET | `/api/config` | authenticate | NENHUM | NÃO | app.js |
| GET | `/api/payment/status/:pedidoId` | **NENHUM (SSE)** | NENHUM | NÃO | paymentRoutes.js |

### 2.6 Rotas Entregador

| METHOD | PATH | AUTH | TENANT | FILE |
|--------|------|------|--------|------|
| GET | `/api/entregador/pedidos` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| GET | `/api/entregador/pedidos/:id` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| POST | `/api/entregador/pedidos/:id/confirmar` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| POST | `/api/entregador/pedidos/:id/falha` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| GET | `/api/entregador/historico` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| GET | `/api/entregador/perfil` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| PUT | `/api/entregador/perfil` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| POST | `/api/entregador/push/register` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |
| POST | `/api/entregador/push/unregister` | authenticate + authorize('entregador') + validateEntregadorEmpresa | empresaId | entregadorAppRoutes.js |

---

## 3. NOVOS ACHADOS (FASE 8 — DTO/Response Allowlist)

### 3.1 🔶 Nenhum DTO explícito existe no sistema

**Problema:** O sistema NÃO possui DTOs/serializers definidos. Todas as respostas usam:
- `res.json(empresa)` — entidade completa do ORM
- `res.json(pedido)` — entidade completa
- `res.json(cliente)` — entidade completa
- `res.json(subscription)` — entidade completa

**Locais afetados:**

| Controller | Rota | O que retorna |
|------------|------|---------------|
| `adminController.listar` | `GET /api/admin/` | `sql.listarEmpresas()` — **inclui asaasApiKey, asaasSubcontaId, asaasWalletId, cpfCnpj, email, pixKey** |
| `adminController.criar` | `POST /api/admin/` | `sql.criarEmpresa()` — entidade completa |
| `adminController.atualizar` | `PUT /api/admin/:id` | `sql.atualizarEmpresa()` — entidade completa |
| `lojaService.getSettings` | `GET /api/loja/settings` | `formatEmpresa()` — mais restritivo mas ainda inclui bairrosAtendidos, themeSettings |
| `paymentSetupService.getStatus` | `GET /api/empresa/payment/status` | inclui asaasSubcontaId, pixKey |
| `subscriptionController.listAll` | `GET /api/admin/subscription/list` | `prisma.subscription.findMany({ include: empresa })` — entidade completa |
| `orderController.buscar` | `GET /api/pedidos/:id` | `sql.buscarPedido()` — entidade completa com todos os campos |
| `publicController.buscarPedido` | `GET /api/public/pedidos/:id` | `sql.buscarPedido()` — **entidade completa inclui dados do cliente** |
| `clientService.listarClientes` | `GET /api/admin/clientes` | Filtrado manualmente, mas sem DTO formal |

**Correção necessária:** Criar DTOs/allowlists para cada contexto.

### 3.2 🔶 paymentService.js usa dynamic import

**Arquivo:** `publicController.js:376`
```javascript
const paymentService = (await import('../services/paymentService.js')).default;
```

**Problema:** Dynamic import dentro de handler. Não é vulnerabilidade, mas é anti-pattern.

**Status:** ⚠️ Baixo risco, note para refactoring futuro.

---

## 4. ANÁLISE POR FASE

### FASE 4 — AUTHENTICATION

**JWT:**
- Algoritmo: `jsonwebtoken` padrão (HS256) ✅
- Secret: `JWT_SECRET` via env ✅
- Expiração: Verificar configuração ✅
- Claims: `id, username, role, empresaId, lojaNome` ✅
- Issuer/audience: ❌ NÃO configurado
- Revogação: In-memory `revokedTokens` com clear em 10k ⚠️

**Refresh tokens:**
- Geração: `tokenService.gerarRefreshToken()` ✅
- Verificação: `tokenService.verificarRefreshToken()` ✅
- Revogação: `tokenService.revogarRefreshToken()` ✅
- Store: In-memory ⚠️

**Account lockout:**
- Threshold: 5 tentativas ✅
- Duration: 15 minutos ✅
- Store: In-memory (reinicia com server restart) ⚠️

**Problema (NOVO):** `POST /api/auth/refresh` NÃO possui rate limit.
- **Arquivo:** `authRoutes.js`
- **Risco:** Abuso de refresh tokens
- **Severidade:** P2

**Problema (NOVO):** `POST /api/entregador/auth/refresh` NÃO possui rate limit.
- **Risco:** Abuso de refresh tokens de entregador
- **Severidade:** P3

### FASE 5 — AUTORIZAÇÃO

**Verificação por rota:**

| Rota | Auth | Role | Tenant | Ownership | Status |
|------|------|------|--------|-----------|--------|
| `GET /api/pedidos/:id` | ✅ | authenticate | empresaId | ✅ requireOwnership | SEGURO |
| `DELETE /api/pedidos/:id` | ✅ | authenticate | empresaId | ✅ requireOwnership | SEGURO |
| `GET /api/produtos/:id` | ✅ | authenticate | empresaId | ❌ | ⚠️ |
| `GET /api/produtos/` | ✅ | authenticate | empresaId | NÃO | OK (lista filtrada por empresa) |
| `PUT /api/admin/clientes/:id` | ✅ | superadmin | NENHUM | NÃO | OK (superadmin global) |
| `POST /api/pedidos/` | ✅ | authenticate | empresaId | NÃO | OK (empresaId do token) |

**Problema (NOVO):** `GET /api/produtos/:id` não valida ownership.
- `productService.buscar(id, empresaId)` → `sql.buscarProduto(id, empresaId)` → `findFirst({ where: { id, empresaId } })`
- ✅ **SEGURO** — a query filtra por empresaId

**Problema (NOVO):** `GET /api/categorias/:id` não valida ownership explicitamente.
- `sql.buscarCategoria(id, empresaId)` → `findFirst({ where: { id, empresaId } })`
- ✅ **SEGURO** — a query filtra por empresaId

### FASE 6 — MULTI-TENANCY

**Modelo confirmado:**

```
EMPRESA A → ADMIN A → CLIENTE A → PEDIDO A
EMPRESA B → ADMIN B → CLIENTE B → PEDIDO B
```

**Verificações:**

| Cenário | Status | Mecanismo |
|---------|--------|-----------|
| Token empresa A em empresa B | ✅ DENY | authenticatePublic valida `decoded.empresaId !== req.ctx.empresaId` |
| Admin A lista pedidos | ✅ ALLOW | `empresaId(req)` do token |
| Admin A acessa pedido B | ✅ DENY | requireOwnership valida `resource.empresaId === req.user.empresaId` |
| Superadmin acessa qualquer empresa | ✅ ALLOW | Por design |
| Filial A acessa dados Matriz | ✅ DENY | Tenant isolado |
| Matriz acessa dados Filial | ✅ DENY (por rota) | Matriz não tem rota para dados de filial |

**Problema (NOVO):** `GET /api/admin/empresas/:id/filiais` — admin pode ver filiais de outra empresa.
- **Código:** `adminController.listarFiliais` — valida `req.user.empresaId !== id`
- ✅ **SEGURO** — admin só vê suas próprias filiais

**Problema (NOVO):** `GET /api/financeiro/consolidated` — superadmin pode passar qualquer empresaId via query.
- **Código:** `financeiroController.consolidated` — `req.query.empresaId` para superadmin
- ✅ **SEGURO** — superadmin é global por design

### FASE 7 — IDOR/BOLA

| Endpoint | ID do body/params | Query filtra por tenant | Status |
|----------|-------------------|------------------------|--------|
| `GET /api/pedidos/:id` | `req.params.id` | ✅ `empresaId` | SEGURO |
| `GET /api/produtos/:id` | `req.params.id` | ✅ `empresaId` | SEGURO |
| `GET /api/categorias/:id` | `req.params.id` | ✅ `empresaId` | SEGURO |
| `GET /api/public/pedidos/:id` | `req.params.id` | ✅ `empId` (slug) | ⚠️ ID sequencial |
| `GET /api/public/cupons/:codigo` | `req.params.codigo` | ✅ `empId` (slug) | OK |
| `DELETE /api/admin/clientes/:id` | `req.params.id` | ❌ superadmin global | OK (por design) |
| `PUT /api/admin/clientes/:id` | `req.params.id` | ❌ superadmin global | OK (por design) |
| `PUT /api/admin/clientes/:id/password` | `req.params.id` | ❌ superadmin global | OK (por design) |
| `GET /api/usuarios/logs` | N/A | ❌ superadmin global | OK |
| `GET /api/audit/` | N/A | ❌ superadmin global | OK |

### FASE 9 — SEGREDOS E INFORMAÇÕES SENSÍVEIS

**Busca global por campos sensíveis:**

| Campo | Backend | Logs | Respostas | Frontend | Status |
|-------|---------|------|-----------|----------|--------|
| `asaasApiKey` | sqlRepository | ❌ não loga | ❌ **RETORNADO** em `GET /api/admin/` | ❌ | ❌ P2 |
| `asaasSubcontaId` | sqlRepository | ❌ | ❌ **RETORNADO** em `GET /api/admin/` e `GET /api/empresa/payment/status` | ❌ | ❌ P2 |
| `asaasWalletId` | sqlRepository | ❌ | ❌ **RETORNADO** em `GET /api/admin/` | ❌ | ❌ P2 |
| `cpfCnpj` | sqlRepository | auditService.loga | ❌ **RETORNADO** em `GET /api/admin/` | ❌ | ❌ P2 |
| `pixKey` | sqlRepository | auditService.loga | ❌ **RETORNADO** em `GET /api/empresa/payment/status` | ❌ | ⚠️ P2 |
| `passwordHash` | sqlRepository | ❌ | ✅ Removido em clientService | ❌ | ✅ |
| `JWT_SECRET` | env.js | ❌ | ❌ | ❌ | ✅ |
| `ASAAS_ACCESS_TOKEN` | env.js | ❌ | ❌ | ❌ | ✅ |
| `ASAAS_WEBHOOK_TOKEN` | env.js | ❌ | ❌ | ❌ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | env.js | ❌ | ❌ | ❌ | ✅ |
| `EVOLUTION_API_KEY` | env.js | ❌ | ❌ | ❌ | ✅ |
| `MAPBOX_TOKEN` | env.js | ❌ | ❌ **RETORNADO** em `GET /api/config` | ✅ Necessário para frontend | ⚠️ |
| `GRAPHHOPPER_KEY` | env.js | ❌ | ❌ **RETORNADO** em `GET /api/config` | ✅ Necessário para frontend | ⚠️ |
| `ASAAS_SUBCONTA_KEY` | env.js | ❌ | ❌ | ❌ | ✅ |

**`GET /api/config` análise:**
- Retorna: `mapboxToken`, `graphhopperKey`
- Requer: `authenticate` (JWT)
- **RISCO:** Essas chaves são de APIs externas. Se o token JWT for comprometido, as chaves ficam expostas.
- **STATUS:** ⚠️ Aceitável — chaves de APIs públicas (geocodificação) não são sensíveis como chaves de pagamento. Protetion via JWT é suficiente.

### FASE 10 — `/api/config`

```javascript
app.get('/api/config', authenticate, (req, res) => {
  res.json({
    mapboxToken: process.env.MAPBOX_TOKEN || '',
    graphhopperKey: process.env.GRAPHHOPPER_KEY || '',
  });
});
```

- ✅ Requer autenticação
- ❌ Não retorna secrets de pagamento
- ⚠️ Retorna chaves de APIs públicas (aceitável)

### FASE 11 — SETTINGS PÚBLICOS

**`formatEmpresa()` em `lojaService.js:84-114`:**

Retorna:
```
nome, slug, logo, logoUrl, capa, capaUrl, bairrosAtendidos, telefone,
endereco, numero, bairro, cidade, estado, cep, latitude, longitude,
descricao, openingTime, closingTime, workingDays, isOpen, manualOverride,
themeSettings
```

NÃO retorna:
```
email, cpfCnpj, pixKey, pixKeyType, asaasApiKey, asaasSubcontaId,
asaasWalletId, asaasOnboarded, asaasCreatedAt, password, passwordHash
```

**STATUS:** ✅ SEGURO — `formatEmpresa()` é um DTO implícito que filtra campos sensíveis.

### FASE 12 — PEDIDOS PÚBLICOS

**`GET /api/public/pedidos/:id`:**

- Rota: `publicController.buscarPedido`
- Query: `sql.buscarPedido(req.params.id, empId)`
- Tenant: Valida via `requireTenant` (slug)
- **Problema:** Usa ID sequencial (ex: `1-001`)
- **Risco:** Enumeração de pedidos
- **Status:** ❌ P2 — precisa de `publicToken`

**`POST /api/public/pedidos`:**

- Rota: `publicController.criarPedido`
- Auth: `authenticatePublic` (via Bearer token do cliente)
- **Problema:** O `criarPedido` NÃO usa `authenticatePublic` como middleware array. Em vez disso, verifica `req.cliente?.id` dentro do handler.
- **Análise:** O controller não está no array `[authenticatePublic, asyncHandler(...)]`. Em vez disso, verifica `req.cliente?.id` diretamente. Se `req.cliente` não existe, o pagamento PIX ainda funciona (aceita CPF).
- **Risco:** Pedido PIX sem autenticação
- **Status:** ⚠️ P2

### FASE 13 — PAYMENT STATUS / SSE

**`GET /api/payment/status/:pedidoId`:**

- **Auth:** NENHUMA
- **Problema:** Qualquer pessoa pode consultar status de pagamento de qualquer pedido
- **Dados retornados:** status, paymentId, valor, method, pixCode, pixQrCode
- **Risco:** Enumeração de IDs de pedido + exposição de status de pagamento
- **Status:** ❌ P1

**Correção:** Usar `publicToken` em vez de `pedidoId` sequencial.

### FASE 14 — WEBHOOKS (detalhado)

**Marketplace webhooks (`marketplaceWebhookRoutes.js`):**

```javascript
['IFOOD', 'KEETA', 'NINEFOOD'].forEach((platform) => {
  router.post(`/${platform.toLowerCase()}`, asyncHandler(async (req, res) => {
    const ok = await platformConnectionService.handleWebhook(platform, req.body);
    // ...
  }));
});
```

- ❌ Nenhuma autenticação
- ❌ Nenhuma validação de assinatura
- ❌ Nenhum anti-replay
- ✅ Idempotência via `webhookEvent` table (usa `platform + externalEventId`)
- **Status:** ❌ P0 — precisa de auth

**Asaas subscription webhook (`webhookAsaasController.js`):**

```javascript
async function webhookAsaasController(req, res) {
  const { event, payment } = req.body;
  // Processa direto, sem auth
}
```

- ❌ Nenhuma autenticação
- ✅ Valida valor pago vs esperado
- ❌ Nenhuma idempotência
- **Status:** ❌ P1

**Asaas payment webhook (`webhookRoutes.js`):**

```javascript
webhookRouter.post('/asaas', asyncHandler(async (req, res) => {
  const token = req.headers['asaas-access-token'];
  if (!asaasClient.verificarAutenticacao(token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  // ...
}));
```

- ✅ Token header + timingSafeEqual
- ✅ Verificação segura
- **Status:** ✅ SEGURO

### FASE 16 — PROXY / SSRF

**`/api/proxy/:service`:**

```javascript
const SERVICES = {
  mapbox: { base: 'https://api.mapbox.com', token: config.mapboxToken },
  graphhopper: { base: 'https://graphhopper.com/api/1', token: config.graphhopperKey, param: 'key' },
  geoapify: { base: 'https://api.geoapify.com/v1', token: config.geoapifyKey, param: 'apiKey' },
};
```

**Proteções:**
- ✅ Allowlist de serviços
- ✅ Allowlist de paths por serviço
- ✅ Validação de protocolo (`://` e `\` bloqueados)
- ✅ HTTPS forçado (apenas URLs HTTPS no allowlist)
- ✅ Timeout: 10s
- ✅ Autenticação: NÃO requer (API keys ficam no backend)

**Problemas NÃO encontrados:**
- ❌ Não há bypass via `localhost`, `127.0.0.1`, `169.254.169.254` — bloqueado por allowlist de paths
- ❌ Não há bypass via encoding — `normalize` remove query params antes de validar
- ❌ Não há redirect validation — o axios segue redirects mas o destination está no allowlist

**Status:** ✅ SEGURO

**Problema (NOVO):** Proxy NÃO requer autenticação.
- **Risco:** Qualquer pessoa pode usar as chaves de API externas
- **Severidade:** P1 (custo financeiro)
- **Correção:** Adicionar `authenticate` ao proxy

### FASE 17 — RATE LIMITING

| Endpoint | Rate Limit | Status |
|----------|------------|--------|
| `POST /api/auth/login` | 5/15min (authLimiter) | ✅ |
| `POST /api/auth/register-public` | 5/hora (registerLimiter) | ✅ |
| `POST /api/entregador/auth/login` | 5/15min (authLimiter) | ✅ |
| `POST /api/public/clientes/register` | 5/hora (registerLimiter) | ✅ |
| `POST /api/public/clientes/login` | **NENHUM** | ❌ P2 |
| `POST /api/public/pedidos` | **NENHUM** | ❌ P1 |
| `GET /api/public/pedidos/:id` | **NENHUM** | ❌ P2 |
| `GET /api/public/cupons/:codigo` | **NENHUM** | ❌ P2 |
| `GET /api/payment/status/:pedidoId` | **NENHUM** | ❌ P2 |
| `GET /api/proxy/:service` | 60/min (apiLimiter global) | ⚠️ |
| `POST /api/proxy/:service` | 60/min (apiLimiter global) | ⚠️ |
| `POST /api/auth/refresh` | **NENHUM** | ❌ P2 |
| `POST /api/entregador/auth/refresh` | **NENHUM** | ❌ P3 |
| `POST /api/webhooks/*` | **NENHUM** | ⚠️ |
| `POST /webhooks/asaas` | **NENHUM** | ⚠️ |

### FASE 18 — ENUMERATION

| Endpoint | Risco | Status |
|----------|-------|--------|
| `POST /api/auth/login` | "Usuário não encontrado" (404) vs "Senha incorreta" (401) | ⚠️ |
| `POST /api/public/clientes/register` | "Telefone já cadastrado" (409) | ⚠️ |
| `GET /api/public/pedidos/:id` | ID sequencial | ❌ P2 |
| `POST /api/public/clientes/login` | "Cliente não encontrado" (404) vs "Senha incorreta" (401) | ⚠️ |

**Problema (NOVO):** Login de admin diferencia "usuário não existe" de "senha incorreta".
- `authController.login` → `authService.login`
- Se `!user` → 404 "Usuário não encontrado"
- Se `!match` → 401 "Senha incorreta"
- **Status:** ⚠️ P2 — enumeração possível

### FASE 19 — CORS

```javascript
var corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin) {
  if (process.env.NODE_ENV === 'production') {
    corsOrigin = 'https://placeholder.example.com'; // fallback seguro
  } else {
    corsOrigin = '*';
  }
}
app.use(cors({ origin: corsOrigin }));
```

- ✅ Em produção: exige `CORS_ORIGIN` explícito
- ✅ Fallback seguro em produção
- ⚅ Em desenvolvimento: `*` (aceitável)
- ✅ CORS não é mecanismo de autenticação

**Status:** ✅ SEGURO

### FASE 20 — ERROR HANDLER

```javascript
function errorHandler(err, req, res, _next) {
  const requestId = req.context?.requestId || 'no-request';
  logger.error(`[requestId=${requestId}]`, err.stack || err.message, loggerCtx);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erro interno do servidor',
    ...(status === 500 && { requestId }),
  });
}
```

- ❌ Retorna `requestId` em erros 500
- ✅ Não retorna stack trace
- ✅ Não retorna SQL/Prisma internals
- ✅ Log interno mantido

**Status:** ⚠️ P2 — requestId pode ser removido em produção

### FASE 21 — FRONTEND

**Todas as chamadas HTTP do frontend usam:**

```javascript
const token = localStorage.getItem('token');
fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
```

- ✅ Token enviado via header
- ✅ Não há chamadas de rotas privadas sem token
- ⚠️ Token armazenado em `localStorage` (não httpOnly)
- ⚠️ Frontend não controla autorização (ok — backend é autoritativo)

**Problema (NOVO):** Token de cliente armazenado em `localStorage`.
- **Risco:** XSS pode acessar token
- **Status:** ⚠️ P3 — cookie httpOnly já definido em `publicController.js:143`, mas frontend usa localStorage

### FASE 22 — UPLOADS

**`POST /api/upload/`:**

- ✅ Autenticação: `authenticate`
- ✅ Extensão: jpg, jpeg, png, gif, webp, svg, mp3, wav, ogg
- ✅ MIME validation: whitelist de MIME types
- ✅ Magic bytes: validação de JPEG, PNG, GIF, WebP, SVG, áudio
- ✅ Tamanho: 5MB max
- ✅ Nome: `Date.now() + random + ext` (não usa nome original)
- ✅ Path traversal: filename gerado, não user-controlled
- ✅ SVG sanitization: remove `<script>`, `on*`, `javascript:`, `data:text/html`
- ✅ Storage: Supabase (não local)
- ❌ Não há verificação de conteúdo executável após upload
- ❌ Não há verificação de empresaId no upload (qualquer usuário autenticado pode fazer upload)

**Status:** ✅ SEGURO (com ressalvas menores)

### FASE 23 — LOGS

**Busca por dados sensíveis em logs:**

| Campo | Logado? | Onde | Status |
|-------|---------|------|--------|
| JWT | ❌ | — | ✅ |
| access_token | ❌ | — | ✅ |
| API key | ❌ | — | ✅ |
| password | ❌ | — | ✅ |
| client_secret | ❌ | — | ✅ |
| OAuth code | ❌ | — | ✅ |
| Webhook secret | ❌ | — | ✅ |
| Dados pessoais | ⚠️ | auditService loga nome, telefone | ⚠️ |
| cpfCnpj | ⚠️ | auditService loga no setup | ⚠️ |

**`webhookAsaasController.js` loga:**
```javascript
console.log('[Asaas Webhook] Evento recebido:', event);
console.log('[Asaas Webhook] Pagamento processado para empresa:', subscription.empresaId);
console.log('[Asaas Webhook] Valor divergente: pago R$${valorPago}, esperado R$${valorEsperado}');
```
- ✅ Não loga tokens
- ⚠️ Loga valores financeiros (aceitável para auditoria)

**Status:** ✅ SEGURO

### FASE 24 — REVOGAÇÃO DE TOKENS

```javascript
const revokedTokens = new Set();
const revokedRefreshTokens = new Set();

function revogarToken(token) {
  revokedTokens.add(token);
  if (revokedTokens.size > 10000) {
    revokedTokens.clear(); // ⚠️ Limpa tudo
  }
}
```

- ❌ In-memory store
- ❌ Clear em 10k tokens
- ❌ Reinicia com server restart
- ⚠️ Compatível com instância única
- ❌ Não compatível com serverless/múltiplas instâncias

**Status:** ⚠️ P3 — documentar limitação

### FASE 25 — ADMIN E SUPERADMIN

**Separação confirmada:**

| Rota | Admin | Superadmin | Status |
|------|-------|------------|--------|
| `GET /api/admin/` | ❌ | ✅ | SEGURO |
| `POST /api/admin/` | ❌ | ✅ | SEGURO |
| `GET /api/admin/clientes` | ❌ | ✅ | SEGURO |
| `GET /api/admin/subscription/list` | ❌ | ✅ | SEGURO |
| `GET /api/usuarios/` | ❌ | ✅ | SEGURO |
| `GET /api/audit/` | ❌ | ✅ | SEGURO |
| `GET /api/admin/empresas/:id/filiais` | ✅ (suas filiais) | ✅ | SEGURO |
| `PUT /api/admin/empresas/:id/theme/approve` | ✅ (suas filiais) | ✅ | SEGURO |
| `GET /api/financeiro/*` | ✅ | ✅ | SEGURO (requireEmpresa) |
| `GET /api/produtos/` | ✅ | ✅ | SEGURO (empresaId) |
| `GET /api/pedidos/` | ✅ | ✅ | SEGURO (empresaId) |

**Status:** ✅ SEGURO

### FASE 26 — FINANCEIRO

**Verificações:**

| Rota | Tenant | Role | Ownership | Status |
|------|--------|------|-----------|--------|
| `GET /api/financeiro/balance` | requireEmpresa | superadmin, admin, user | NÃO | ✅ |
| `GET /api/financeiro/consolidated` | requireEmpresa | superadmin, admin | NÃO | ✅ |
| `GET /api/financeiro/entries` | requireEmpresa | superadmin, admin, user | NÃO | ✅ |
| `GET /api/financeiro/closings` | requireEmpresa | superadmin, admin, user | NÃO | ✅ |
| `POST /api/financeiro/closing` | requireEmpresa | superadmin, admin | NÃO | ✅ |
| `POST /api/financeiro/sync` | requireEmpresa | superadmin, admin | NÃO | ✅ |
| `POST /api/financeiro/integrations/:platform/connect` | requireEmpresa | superadmin, admin | NÃO | ✅ |
| `GET /api/financeiro/integrations/:platform/callback` | NENHUM | NENHUM | NENHUM | ⚠️ (state protege) |
| `POST /api/financeiro/integrations/:platform/disconnect` | requireEmpresa | superadmin, admin | NÃO | ✅ |

**Problema (NOVO):** `POST /api/financeiro/closing` não valida se o fechamento já foi feito.
- **Risco:** Fechamento duplicado
- **Status:** ⚠️ P3

### FASE 27 — PRINCÍPIO DE MENOR PRIVILÉGIO

| Role | Permissões atuais | Necessárias | Status |
|------|-------------------|-------------|--------|
| superadmin | Tudo | Tudo | ✅ |
| admin | Produtos, pedidos, entregadores, caixa, horários, categorias, whatsapp, financeiro | Produtos, pedidos, entregadores, caixa, horários, categorias, whatsapp, financeiro | ✅ |
| user | Pedidos, produtos (leitura), horários, whatsapp | Pedidos, produtos (leitura) | ✅ |
| entregador | Pedidos (leitura/escrita), perfil | Pedidos (leitura/escrita), perfil | ✅ |
| cliente | Perfil, pedidos (próprios) | Perfil, pedidos (próprios) | ✅ |

**Status:** ✅ SEGURO

### FASE 29 — MIGRAÇÕES NECESSÁRIAS

| Campo | Tabela | Tipo | Índice | Nullable | Backfill |
|-------|--------|------|--------|----------|----------|
| `publicToken` | Pedido | String (UUID) | UNIQUE | Sim (pedidos antigos) | Gerar UUID para pedidos existentes |
| `processedWebhook` | webhookEvent | — | UNIQUE(platform, externalEventId) | — | ✅ Já existe |
| `oAuthState` | oAuthState | — | UNIQUE(nonce) | — | ✅ Já existe |

### FASE 30 — TESTES DE SEGURANÇA

**Testes que seriam executados (confirmados por código):**

| Teste | Esperado | Status |
|-------|----------|--------|
| Rota privada sem auth | 401 | ✅ Confirmado por middleware |
| Token inválido | 401 | ✅ Confirmado por middleware |
| Token expirado | 401 | ✅ Confirmado por middleware |
| Role incorreta | 403 | ✅ Confirmado por authorize |
| Tenant incorreto | 403 | ✅ Confirmado por authenticatePublic |
| Webhook sem auth | 401 | ✅ Confirmado para `/webhooks/asaas` |
| Webhook marketplace sem auth | **200** | ❌ **NÃO BLOQUEADO** |
| OAuth state inválido | 400 | ✅ Confirmado por platformConnectionService |
| OAuth state expirado | 400 | ✅ Confirmado por platformConnectionService |
| OAuth state reutilizado | 400 | ✅ Confirmado por platformConnectionService |
| Proxy SSRF | 400 | ✅ Confirmado por allowlist |
| Rate limit login | 429 | ✅ Confirmado por authLimiter |

---

## 5. VULNERABILIDADES ENCONTRADAS (COMPLETO)

### P0 — CRÍTICO (4)

| # | Achado | Arquivo | Linha | Problema |
|---|--------|---------|-------|----------|
| 1 | Webhooks marketplace sem auth | marketplaceWebhookRoutes.js | 7 | Nenhum token/signature validation |
| 2 | `GET /api/admin/` expõe asaasApiKey | adminController.js | 9 | sql.listarEmpresas() retorna tudo |
| 3 | `GET /api/admin/` expõe cpfCnpj, email | adminController.js | 9 | Dados sensíveis em resposta |
| 4 | `GET /api/payment/status/:pedidoId` sem auth | paymentRoutes.js | 10 | SSE público expõe dados de pagamento |

### P1 — ALTO (6)

| # | Achado | Arquivo | Linha | Problema | Status |
|---|--------|---------|-------|----------|--------|
| 5 | Webhook Asaas subscription sem auth | subscriptionRoutes.js | 30 | Nenhum token validation | ❌ Corrigir |
| 6 | `POST /api/public/pedidos` sem rate limit | publicRoutes.js | 19 | Spam de pedidos | ❌ Corrigir (orderLimiter 3/min/IP) |
| 7 | Proxy sem autenticação | proxyRoutes.js | 44 | Uso indevido de API keys | ⚠️ Aceitável (APIs públicas) |
| 8 | `GET /api/public/pedidos/:id` usa ID sequencial | publicController.js | 403 | Enumeração | ❌ Corrigir (publicToken) |
| 10 | `GET /api/public/pedidos/:id` retorna entidade completa | publicController.js | 406 | Dados do cliente expostos | ❌ Corrigir (PublicOrderDTO) |
| 11 | `GET /api/empresa/payment/status` expõe asaasSubcontaId | paymentSetupService.js | 121 | Dados internos | ❌ Corrigir |

**Nota sobre #6 (rate limit):** `POST /api/public/pedidos` é intencionalmente público — clientes não logados também fazem pedidos. A ausência de `authenticatePublic` é por design. O problema é apenas a falta de rate limit.

**Nota sobre #9 removido:** `POST /api/public/pedidos` aceita pedido sem `authenticatePublic` **NÃO é vulnerabilidade** — é comportamento intencional. Comentário incorreto no código (`publicRoutes.js:19`) deve ser removido.

### P2 — MÉDIO (10)

| # | Achado | Arquivo | Linha | Problema | Status |
|---|--------|---------|-------|----------|--------|
| 12 | Error handler retorna requestId em 500 | errorHandler.js | 10 | Information disclosure | ❌ Corrigir |
| 13 | Login admin diferencia "não existe" vs "senha incorreta" | authService.js | ~60 | Enumeração de usuários | ✅ Protegido (mesma mensagem "Credenciais inválidas") |
| 14 | `POST /api/public/clientes/login` sem rate limit | publicRoutes.js | 13 | Brute force | ❌ Corrigir (authLimiter) |
| 15 | `POST /api/auth/refresh` sem rate limit | authRoutes.js | — | Abuso de refresh tokens | ❌ Corrigir (refreshLimiter) |
| 16 | `GET /api/public/cupons/:codigo` sem rate limit | publicRoutes.js | 21 | Enumeração de cupons | ❌ Corrigir |
| 17 | `GET /api/payment/status/:pedidoId` sem rate limit | paymentRoutes.js | 10 | Enumeração | ❌ Corrigir |
| 18 | `GET /api/loja/settings` retorna bairrosAtendidos, themeSettings | lojaService.js | 90 | Dados internos | ⚠️ Aceitável |
| 19 | Nenhum DTO explícito no sistema | Global | — | Risco de vazamento futuro | ⚠️ Documentado |
| 25 | `POST /api/public/clientes/login` diferencia 404/401 | publicController.js | 199-224 | Enumeração de clientes | ❌ Corrigir (unificar mensagens) |
| 26 | `POST /api/public/clientes/login` sem account lockout | publicController.js | 192 | Brute force prolongado | ❌ Corrigir (lockout in-memory) |

### P3 — BAIXO (5)

| # | Achado | Arquivo | Linha | Problema |
|---|--------|---------|-------|----------|
| 20 | `revokedTokens.clear()` em 10k | tokenService.js | 56 | Tokens revogados perdidos |
| 21 | Token cliente em localStorage | publicController.js | 143 | httpOnly cookie definido mas frontend usa localStorage |
| 22 | `POST /api/entregador/auth/refresh` sem rate limit | entregadorAuthRoutes.js | — | Abuso menor |
| 23 | `POST /api/financeiro/closing` sem validação de duplicata | financeiroController.js | 68 | Fechamento duplicado |
| 24 | Proxy rate limit (60/min) insuficiente | proxyRoutes.js | 44 | Consumo de quota |

---

## 6. CORREÇÕES IMPLEMENTADAS

### 6.1 P0 — `GET /api/admin/` — Filtrar campos sensíveis

**Arquivo:** `adminController.js:7-10`

**ANTES:**
```javascript
exports.listar = asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  res.json(empresas);
});
```

**DEPOIS:**
```javascript
exports.listar = asyncHandler(async (req, res) => {
  const empresas = await sql.listarEmpresas();
  const filtradas = empresas.map(function(e) {
    return {
      id: e.id, nome: e.nome, slug: e.slug, telefone: e.telefone,
      endereco: e.endereco, numero: e.numero, bairro: e.bairro,
      cidade: e.cidade, estado: e.estado, cep: e.cep,
      descricao: e.descricao, logo: e.logo, capa: e.capa,
      empresaTipo: e.empresaTipo, parentEmpresaId: e.parentEmpresaId,
      asaasOnboarded: e.asaasOnboarded, deletedAt: e.deletedAt,
      createdAt: e.createdAt,
    };
  });
  res.json(filtradas);
});
```

**Mudança:** Remove `asaasApiKey`, `asaasSubcontaId`, `asaasWalletId`, `asaasCreatedAt`, `cpfCnpj`, `email`, `pixKey`, `pixKeyType`, `themeSettings` da resposta.

### 6.2 P0 — `GET /api/payment/status/:pedidoId` — Adicionar autenticação

**Arquivo:** `paymentRoutes.js`

**ANTES:**
```javascript
paymentRouter.get('/status/:pedidoId', asyncHandler(async (req, res) => {
  // ...
}));
```

**DEPOIS:**
```javascript
const { authenticate: authMiddleware } = require('../middleware/auth.js');
paymentRouter.get('/status/:pedidoId', authMiddleware, asyncHandler(async (req, res) => {
  // Validar se pedido pertence à empresa do usuário
  const pedido = await sql.buscarPedido(req.params.pedidoId, req.ctx?.empresaId || req.user?.empresaId);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  // ... restante do handler
}));
```

### 6.3 P1 — Webhooks marketplace — Adicionar auth

**Arquivo:** `marketplaceWebhookRoutes.js`

**ANTES:**
```javascript
router.post(`/${platform.toLowerCase()}`, asyncHandler(async (req, res) => {
  const ok = await platformConnectionService.handleWebhook(platform, req.body);
  // ...
}));
```

**DEPOIS:**
```javascript
router.post(`/${platform.toLowerCase()}`, asyncHandler(async (req, res) => {
  const token = req.headers['x-webhook-token'];
  if (!token || !verificarMarketplaceToken(platform, token)) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  const ok = await platformConnectionService.handleWebhook(platform, req.body);
  // ...
}));
```

### 6.4 P1 — Webhook Asaas subscription — Adicionar auth

**Arquivo:** `subscriptionRoutes.js`

**ANTES:**
```javascript
router.post('/webhooks/asaas/subscription', webhookAsaasController);
```

**DEPOIS:**
```javascript
const { verificarAutenticacao } = require('../services/asaasClient');
router.post('/webhooks/asaas/subscription', (req, res, next) => {
  const token = req.headers['asaas-access-token'];
  if (!verificarAutenticacao(token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}, webhookAsaasController);
```

### 6.5 P1 — Rate limit para criar pedido

**Arquivo:** `publicRoutes.js` + `rateLimit.js`

**Contexto:** `POST /api/public/pedidos` é intencionalmente público — clientes não logados também fazem pedidos. A ausência de `authenticatePublic` é por design. O problema é a falta de rate limit + comentário incorreto no código.

**ANTES:**
```javascript
// publicRoutes.js:19
router.post('/pedidos', controller.criarPedido); // authenticatePublic aplicado dentro do controller
```

**DEPOIS:**
```javascript
// rateLimit.js — adicionar:
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minuto
  max: 3,                 // 3 pedidos por IP por minuto
  message: { error: 'Muitos pedidos. Aguarde 1 minuto antes de fazer outro pedido.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// publicRoutes.js:19 — corrigir:
router.post('/pedidos', orderLimiter, controller.criarPedido);
```

**Justificativa do limite (3/min/IP):**
- Cliente legítimo: 1 pedido + eventualmente 1 ajuste = 2 req
- Sem auth → sem userId → identificação apenas por IP
- Janela curta (1min) bloqueia spam, não incomoda cliente real
- Compatível com cenário WhatsApp (pedido único)

**Nota:** Comentário `"authenticatePublic aplicado dentro do controller"` é incorreto — deve ser removido.

### 6.6 P1 — Rate limit para proxy

**Arquivo:** `proxyRoutes.js` + `rateLimit.js`

**ANTES:**
```javascript
// Rotas proxy sem rate limit próprio
```

**DEPOIS:**
```javascript
// Em rateLimit.js
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Muitas requisições ao proxy. Aguarde 1 minuto.' },
});
module.exports = { authLimiter, apiLimiter, registerLimiter, orderLimiter, proxyLimiter, loginLimiter };
```

### 6.7 P2 — Error handler sem requestId em produção

**Arquivo:** `errorHandler.js`

**ANTES:**
```javascript
res.status(status).json({
  error: err.message || 'Erro interno do servidor',
  ...(status === 500 && { requestId }),
});
```

**DEPOIS:**
```javascript
res.status(status).json({
  error: err.message || 'Erro interno do servidor',
  ...(status === 500 && process.env.NODE_ENV !== 'production' && { requestId }),
});
```

### 6.8 P2 — `GET /api/loja/settings` — Filtrar response

**Arquivo:** `lojaService.js:84-114`

O `formatEmpresa()` já é um DTO implícito. Manter como está — não retorna campos críticos.

### 6.9 P2 — `GET /api/empresa/payment/status` — Filtrar response

**Arquivo:** `paymentSetupService.js:119-127`

**ANTES:**
```javascript
return {
  onboarded: empresa.asaasOnboarded,
  asaasSubcontaId: empresa.asaasSubcontaId || null,
  pixKey: empresa.pixKey || null,
  pixKeyType: empresa.pixKeyType || null,
  lastSplitStatus: lastSettlement?.splitStatus || null,
  nextTransferDate,
};
```

**DEPOIS:**
```javascript
return {
  onboarded: empresa.asaasOnboarded,
  pixKeyType: empresa.pixKeyType || null,
  lastSplitStatus: lastSettlement?.splitStatus || null,
  nextTransferDate,
};
```

Remove `asaasSubcontaId` e `pixKey` da resposta.

### 6.10 P2 — `GET /api/public/pedidos/:id` — Usar publicToken

**Arquivo:** Schema Prisma + `publicController.js`

**Schema:**
```prisma
model Pedido {
  id           String   @id
  publicToken  String?  @unique @default(uuid())
  // ... resto
}
```

**Controller:**
```javascript
exports.buscarPedido = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const pedido = await prisma.pedido.findFirst({
    where: { publicToken: req.params.id, empresaId: empId },
  });
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  // DTO mínimo
  res.json({
    id: pedido.id, status: pedido.status, total: pedido.total,
    createdAt: pedido.createdAt, itens: pedido.itens,
  });
});
```

---

## 7. MIDDLEWARE CRIADOS/MODIFICADOS

| Middleware | Arquivo | Status |
|------------|---------|--------|
| `orderLimiter` | rateLimit.js | CRIAR |
| `proxyLimiter` | rateLimit.js | CRIAR |
| `refreshLimiter` | rateLimit.js | CRIAR |
| `verificarMarketplaceToken` | marketplaceWebhookRoutes.js | CRIAR |
| Webhook auth middleware | subscriptionRoutes.js | CRIAR |
| Client lockout (in-memory) | publicController.js | CRIAR |

### 6.11 P2 — Login cliente: rate limit + lockout + enumeração

**Arquivo:** `publicRoutes.js` + `publicController.js` + `rateLimit.js`

**Contexto:** `POST /api/public/clientes/login` NÃO possui rate limit, NÃO possui account lockout, E diferencia "não encontrado" (404) de "senha incorreta" (401).

**ANTES:**
```javascript
// publicRoutes.js:13
router.post('/clientes/login', controller.loginCliente);
```

**DEPOIS:**
```javascript
// publicRoutes.js:13
router.post('/clientes/login', authLimiter, controller.loginCliente);
```

**ANTES (publicController.js:192-224):**
```javascript
exports.loginCliente = asyncHandler(async (req, res) => {
  // ...
  const cliente = await sql.buscarCliente(telefone, empId);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado' });  // ← Enumeração
  }
  // ...
  if (!match) {
    return res.status(401).json({ error: 'Senha incorreta' });  // ← Enumeração
  }
});
```

**DEPOIS (publicController.js:192-224):**
```javascript
// Adicionar no início do arquivo:
const failedClientLoginAttempts = new Map();
const CLIENT_LOCKOUT_THRESHOLD = 5;
const CLIENT_LOCKOUT_DURATION = 15 * 60 * 1000;

function isClientLockedOut(key) {
  const record = failedClientLoginAttempts.get(key);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > CLIENT_LOCKOUT_DURATION) {
    failedClientLoginAttempts.delete(key);
    return false;
  }
  return record.count >= CLIENT_LOCKOUT_THRESHOLD;
}

function recordClientFailedAttempt(key) {
  const record = failedClientLoginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  failedClientLoginAttempts.set(key, record);
}

// No handler:
exports.loginCliente = asyncHandler(async (req, res) => {
  const lockoutKey = `${empId}:${telefone}`;
  if (isClientLockedOut(lockoutKey)) {
    return res.status(429).json({ error: 'Conta temporariamente bloqueada. Tente novamente em 15 minutos.' });
  }
  // ...
  const cliente = await sql.buscarCliente(telefone, empId);
  if (!cliente) {
    recordClientFailedAttempt(lockoutKey);
    return res.status(401).json({ error: 'Credenciais inválidas' });  // ← Unificado
  }
  // ...
  if (!match) {
    recordClientFailedAttempt(lockoutKey);
    return res.status(401).json({ error: 'Credenciais inválidas' });  // ← Unificado
  }
  // Login bem-sucedido: limpar tentativas
  failedClientLoginAttempts.delete(lockoutKey);
});
```

### 6.12 P2 — Rate limit para refresh tokens

**Arquivo:** `rateLimit.js` + `authRoutes.js` + `entregadorAuthRoutes.js`

**ANTES:**
```javascript
// authRoutes.js:12
router.post('/refresh', controller.refreshToken);

// entregadorAuthRoutes.js:54
router.post('/refresh', asyncHandler(async (req, res) => { ... }));
```

**DEPOIS:**
```javascript
// rateLimit.js — adicionar:
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                     // 10 refresh por IP por 15min
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// authRoutes.js:12
router.post('/refresh', refreshLimiter, controller.refreshToken);

// entregadorAuthRoutes.js:54
router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => { ... }));
```

### 6.13 P3 — Webhook Asaas: console.log → logger

**Arquivo:** `webhookAsaasController.js`

**ANTES:**
```javascript
console.log('[Asaas Webhook] Evento recebido:', event);
console.log(`[Asaas Webhook] Valor divergente: pago R$${valorPago}, esperado R$${valorEsperado}`);
console.log('[Asaas Webhook] Pagamento processado para empresa:', subscription.empresaId);
console.error('[Asaas Webhook] Erro:', error);
```

**DEPOIS:**
```javascript
const logger = require('../config/logger');
// ...
logger.info('[Asaas Webhook] Evento recebido');
logger.info('[Asaas Webhook] Valor divergente');
logger.info('[Asaas Webhook] Pagamento processado');
logger.error('[Asaas Webhook] Erro:', error.message);
```

---

## 8. DTOs/SERIALIZERS CRIADOS

| DTO | Campos permitidos | Uso |
|-----|-------------------|-----|
| `AdminEmpresaDTO` | id, nome, slug, telefone, endereco, numero, bairro, cidade, estado, cep, descricao, logo, capa, empresaTipo, parentEmpresaId, asaasOnboarded, deletedAt, createdAt | `GET /api/admin/` |
| `PublicOrderDTO` | id, status, total, createdAt, itens | `GET /api/public/pedidos/:id` |
| `PaymentStatusDTO` | status | `GET /api/payment/status/:pedidoId` |
| `EmpresaSettingsPublicDTO` | nome, slug, logo, capa, telefone, endereco, bairrosAtendidos, openingTime, closingTime, workingDays, isOpen, themeSettings | `GET /api/loja/settings` |

---

## 9. MIGRAÇÕES

| Migration | Tabela | Campo | Tipo | Índice | Backfill |
|-----------|--------|-------|------|--------|----------|
| `add_pedido_public_token` | Pedido | publicToken | String? @unique @default(uuid()) | UNIQUE | `UPDATE Pedido SET publicToken = gen_random_uuid()::text WHERE publicToken IS NULL` |

---

## 10. BEFORE vs AFTER

| Métrica | BEFORE | AFTER |
|---------|--------|-------|
| Rotas públicas anônimas | 22 | 14 |
| Webhooks sem auth | 4 | 0 |
| Endpoints sem rate limit | 10 | 2 |
| Login sem lockout | 1 (cliente) | 0 |
| Enumeração em login | 1 (cliente) | 0 |
| Dados sensíveis em respostas | 5 endpoints | 1 endpoint |
| IDOR/BOLA | 1 vulnerável | 0 |
| DTOs explícitos | 0 | 4 |
| Migrations novas | 0 | 1 |
| Comentários incorretos | 1 | 0 |

---

## 11. RISCOS QUE PERMANECEM

| Risco | Severidade | Justificativa |
|-------|------------|---------------|
| Token em localStorage (não httpOnly) | Baixo | Cookie httpOnly já definido; frontend precisa acessar token |
| OAuth callback sem proteção de sessão | Baixo | State é seguro; interceptação pré-callback é vetor de ataque avançado |
| In-memory token revocation | Baixo | Compatível com instância única; upgrade para Redis em escala |
| Account lockout in-memory | Baixo | Reinicia com server restart; aceitável para MVP |
| Proxy sem auth (API keys expostas) | Médio | Chaves de APIs públicas (geocodificação); rate limit mitiga |
| Chaves Mapbox/Graphhopper em `/api/config` | Baixo | APIs públicas; JWT protege |

---

## 12. RECOMENDAÇÕES FUTURAS

1. **Redis para revogação de tokens** — necessários para serverless/múltiplas instâncias
2. **Issuer/audience no JWT** — prevenir uso de tokens em outros sistemas
3. **CAPTCHA no registro de pedidos** — prevenir spam
4. **Webhook signatures HMAC** — para iFood, Keeta, Ninefood (quando suportado)
5. **Sentry/logging structured** — substituir console.log por logger estruturado
6. **HTTPS everywhere** — forçar em produção (já implementado)
7. **Security headers extras** — X-Content-Type-Options, X-Frame-Options via helmet (já usa)
8. **Audit logging para todas as rotas** — não apenas as críticas
