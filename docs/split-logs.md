# Análise Profunda — Sistema de Audit Logs e Application Logs

> **Escopo:** análise completa da codebase para projetar uma camada centralizada de logs (Audit Logs + Application Logs), desacoplada da lógica de negócio.
> **Data:** 2026-08-04
> **Branch:** `feature/hierarquia-usuarios`
> **Nenhuma alteração de código foi feita.** Este documento é exclusivamente o relatório técnico da análise.

---

## 1. Resumo da Arquitetura Atual

### 1.1 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JS vanilla + Vite (multi-page, 13 entradas) + Chart.js CDN |
| Backend | Node.js + Express v5 (CommonJS) |
| ORM | Prisma v6.5 (`prisma-client-js`) |
| Banco | PostgreSQL — Supabase pooler (`lfuhqoujzgenwwvuabez`), Neon como backup |
| Auth Admin | JWT HMAC (jsonwebtoken, 7 dias) — payload `{ id, username, role, empresaId, lojaNome }` |
| Auth Cliente | JWT HMAC (7 dias) — payload `{ id, empresaId, telefone, nome }` |
| Integrações | Evolution API (WhatsApp), Mapbox GL, GraphHopper, Geoapify, ViaCEP, BrasilAPI, Supabase Storage |
| Deploy | Node local (porta 3000) e Vercel serverless (`backend/api.js`) |

### 1.2 Estrutura de Pastas (Backend)

```
backend/
├── server.js              # Entrypoint dev (listen)
├── api.js                 # Entrypoint Vercel (module.exports = app)
├── deploy_db.js           # Deploy migrations + seed via pg
├── prisma/
│   ├── schema.prisma      # 14 modelos
│   └── migrations/        # 5 migrations
├── src/
│   ├── app.js             # Config Express (helmet, cors, json, rate limit, 15 routers)
│   ├── config/            # env.js, logger.js, prisma.js
│   ├── controllers/       # 10 controllers
│   ├── services/          # 10 services
│   ├── repositories/      # sqlRepository.js (wrapper Prisma)
│   ├── middleware/        # auth.js, errorHandler.js, rateLimit.js
│   └── routes/            # 15 routers
├── scripts/               # seed.js, exportFirestore.js, transformToSql.js
└── tests/                 # vazio
```

### 1.3 Modelo de Dados (14 tabelas)

| Modelo | Tabela | Papel |
|---|---|---|
| Empresa | `empresas` | Tenant raiz (single-tenant hoje, `EMPRESA_ID = 1` hardcoded) |
| Usuario | `usuarios` | Funcionários (roles: superadmin/admin/user) |
| Categoria | `categorias` | Agrupamento de produtos |
| Produto | `produtos` | Itens do cardápio (estoque, preço, status) |
| Pedido | `pedidos` | Pedidos de clientes |
| ItensPedido | `itens_pedido` | Itens de cada pedido |
| Entregador | `entregadores` | Cadastro de entregadores |
| EntregaDiaria | `entregas_diarias` | Entregas por dia |
| CaixaDiario | `caixa_diario` | Abertura/fechamento de caixa |
| Horario | `horarios` | Horários de funcionamento (1:1 com empresa) |
| Counter | `counters` | Gerador de IDs sequenciais (pedidoId) |
| Cliente | `clientes` | Clientes cadastrados |
| Cupom | `cupons` | Cupons de desconto |
| LoginLog | `login_logs` | **ÚNICO log existente** — login de usuários admin |
| WhatsAppInstance | `whatsapp_instances` | Sessões WhatsApp |

> **Atenção:** `LoginLog` é um modelo de auditoria já existente, mas é usado **apenas** para logins admin, sem relação FK com `Usuario`, sem empresaId, e gravado com `.catch(() => {})` silencioso.

---

## 2. Fluxo Completo da Aplicação

### 2.1 Ciclo de Vida de uma Requisição Admin

```
Browser (login.html)
  │
  ├─ POST /api/auth/login (authLimiter: 10/15min)
  │     authController.login → authService.login
  │       ├─ sql.buscarUsuario(username)           [LEITURA]
  │       ├─ bcrypt.compare(senha, hash)
  │       ├─ tokenService.gerarToken(payload)      [JWT]
  │       └─ prisma.loginLog.create(...)           [ÚNICO LOG HOJE]
  │
  ├─ Requisições autenticadas (Bearer JWT)
  │     middleware/auth.js authenticate:
  │       tokenService.verificarToken → req.user = { id, username, role, empresaId, lojaNome }
  │
  └─ Controller → Service → sqlRepository (Prisma) → PostgreSQL
       Ex.: POST /api/produtos
         productController.criar → productService.criar → sql.criarProduto
```

### 2.2 Ciclo de Vida de uma Requisição Pública

```
Browser (index.html / view/cart.html)
  │
  ├─ GET /api/public/produtos            [sem auth]
  ├─ POST /api/public/clientes/register  [sem auth]
  ├─ POST /api/public/pedidos            [sem auth!]
  │     publicController.criarPedido:
  │       - valida body básico
  │       - sql.nextPedidoId() (counter)
  │       - loop itens → sql.buscarProduto (valida preço server-side)
  │       - prisma.pedido.create({ itens: { create } })
  │
  └─ GET /api/public/clientes/me         [authenticatePublic — JWT cliente]
```

### 2.3 Fluxo de Erro

```
Qualquer controller (asyncHandler) → erro é lançado
  → errorHandler (app.js):
      logger.error(err.stack)
      res.status(err.status || 500).json({ error: err.message, stack? })
```

### 2.4 Pontos de Escrita no Banco (MUTAÇÕES)

| Operação | Rota | Arquivo | Função |
|---|---|---|---|
| Criar produto | POST /api/produtos | productService.criar | `sql.criarProduto` |
| Atualizar produto | PUT /api/produtos/:id | productService.atualizar | `sql.atualizarProduto` |
| Deletar produto | DELETE /api/produtos/:id | productService.deletar | `sql.deletarProduto` |
| Criar categoria | POST /api/categorias | categoriaService.criar | `sql.criarCategoria` |
| Atualizar categoria | PUT /api/categorias/:id | categoriaService.atualizar | `sql.atualizarCategoria` |
| Deletar categoria | DELETE /api/categorias/:id | categoriaService.deletar | `sql.deletarCategoria` |
| Criar pedido | POST /api/public/pedidos | publicController.criarPedido | `prisma.pedido.create` |
| Mudar status pedido | PATCH /api/pedidos/:id/status | orderService.atualizarStatus | `sql.atualizarPedido` |
| Finalizar pedido | POST /api/pedidos/:id/finalizar | orderService.finalizarPedido | `sql.atualizarPedido` |
| Deletar pedido | DELETE /api/pedidos/:id | orderService.deletarPedido | `prisma.itensPedido.deleteMany` + `prisma.pedido.delete` |
| Baixa estoque | (interno) | orderService.darBaixaEstoque | `sql.atualizarProduto` |
| Criar entregador | POST /api/entregadores | driverController.criar | `sql.criarEntregador` |
| Atualizar entregador | PUT /api/entregadores/:id | driverController.atualizar | `sql.atualizarEntregador` |
| Toggle entregador | PATCH /api/entregadores/:id/toggle | driverController.toggle | `sql.toggleEntregador` |
| Deletar entregador | DELETE /api/entregadores/:id | driverController.deletar | `sql.deletarEntregador` |
| Abrir caixa | POST /api/caixa/abrir | cashierController.abrir | `sql.criarCaixa` |
| Fechar caixa | POST /api/caixa/fechar | cashierController.fechar | `sql.atualizarCaixa` |
| Atualizar settings loja | PUT /api/loja/settings | lojaService.updateSettings | `sql.atualizarEmpresa` |
| Registrar entrega | POST /api/entregas | entregaService.registrarEntrega | `prisma.entregaDiaria.create` |
| Remover entrega | DELETE /api/entregas/:pedidoId | entregaService.removerEntrega | `prisma.entregaDiaria.delete` |
| Criar usuário admin | POST /api/usuarios | userRoutes (inline) | `prisma.usuario.create` |
| Deletar usuário | DELETE /api/usuarios/:id | userRoutes (inline) | `prisma.usuario.delete` |
| Reset senha (admin) | PUT /api/usuarios/:id/password | userRoutes (inline) | `prisma.usuario.update` |
| Criar conta (público) | POST /api/auth/register-public | authService.criarConta | `sql.criarUsuario` |
| Alterar senha (própria) | PUT /api/auth/change-password | authService.alterarSenha | `sql.atualizarUsuario` |
| Login admin | POST /api/auth/login | authService.login | `prisma.loginLog.create` |
| Registrar cliente | POST /api/public/clientes/register | publicController.registrarCliente | `sql.criarCliente` |
| Atualizar cliente | PUT /api/public/clientes/me | publicController.atualizarCliente | `sql.atualizarCliente` |
| Criar instância WhatsApp | POST /api/whatsapp/criar | whatsappInstanceService.criar | `sql.criarWhatsAppInstance` |
| Deletar instância WhatsApp | DELETE /api/whatsapp/:id | whatsappInstanceService.deletar | `sql.deletarWhatsAppInstance` |
| QR/status/reconectar WhatsApp | POST /api/whatsapp/:id/* | whatsappInstanceService | `sql.atualizarWhatsAppInstance` |
| Enviar msg WhatsApp (teste/contato) | POST /api/whatsapp/:id/teste, /pedido/:id/contato | whatsappController | Chamada Evolution API (não persiste) |

---

## 3. Pontos Críticos Encontrados

### 3.1 Ausência Total de Auditoria (exceto login)

Nenhuma operação de CRUD, mudança de status, alteração de configuração ou ação de usuário é registrada. Não há como saber **quem** fez **o quê**, **quando**, **de onde**.

### 3.2 Logging atual fragmentado e inconsistente

| Local | Forma atual | Problema |
|---|---|---|
| `loginLog` (authService) | `prisma.loginLog.create().catch(() => {})` | Log bem-sucedido é **silenciosamente descartado** em falha; sem FK, sem empresaId |
| `logger.js` | console para stdout | Só `entregaService` usa; resto usa `console.log/error/warn` espalhados |
| `orderService`, `whatsappService`, `whatsappInstanceService` | `console.error('...failed:', err.message)` | Sem estrutura, sem requestId, sem contexto de usuário |
| `errorHandler` | `logger.error(err.stack)` | Sem requestId, sem usuário, sem correlação com o request |
| `whatsappInstanceService.gerarQrCode` | `console.log('[QR debug]' + JSON.stringify(data))` | Vaza payload completo da Evolution API para stdout |

### 3.3 Multi-tenant fragilizado

`EMPRESA_ID = 1` está **hardcoded** em `sqlRepository.js` e espalhado nos controllers (`{ ...req.body, empresaId: 1 }`). Embora o token JWT carregue `empresaId`, ele não é usado na maioria das rotas. Isso impacta a auditoria: **não se pode confiar no `req.user.empresaId` em todos os pontos hoje** (é sempre 1 na prática).

### 3.4 Falhas de segurança que afetam a auditoria

1. **Token admin é JWT com `id` e `role` dentro** — a auditoria pode confiar em `req.user` após `authenticate`, mas o JWT **não tem `iat`/`jti` verificáveis** para correlação de sessão.
2. **`POST /api/public/pedidos` e `POST /api/auth/register-public` não exigem auth** — criações anônimas (pedido, conta pública) precisam de categoria "anon/öffentlich" de log.
3. **`authenticatePublic` é aplicado dentro do controller** (`publicController.clientePerfil`), não na rota — padronização de middleware de contexto precisa considerar isso.
4. **`.env` versionado no git** com todas as credenciais (registrado em docs/AGENTS.md como C1 crítico) — logs não podem gravar valores de secrets, mas os secrets já estão comprometidos.
5. **Rotas legadas de WhatsApp** (`POST /api/pedidos/producao|pronto|em-rota`) **sem autenticação** — qualquer mutação de notificação pode ser disparada anonimamente; merecem auditoria como ação externa não autenticada.

### 3.5 Falta de correlation/request ID

Nenhum `requestId`/`sessionId`/`correlationId` é gerado. Não dá para rastrear um request do middleware ao log final, nem correlacionar logs do mesmo usuário numa sessão.

### 3.6 Operações assíncronas fora do request

- `darBaixaEstoque(...).catch(...)` — fire-and-forget
- `whatsapp.notificarStatus(...).catch(...)` — fire-and-forget
- `whatsappInstanceService.listar()` faz polling na Evolution API e **atualiza o banco** (`atualizarWhatsAppInstance`) sem contexto de usuário

Essas operações precisam de contexto de auditoria próprio (quem disparou o request original).

### 3.7 Sem webhooks/filas/workers/eventos

Não há Event Bus, fila (BullMQ/RabbitMQ), workers ou webhooks no backend. **Isso é uma oportunidade**: não há concorrência a respeitar, mas também não há infraestrutura para desacoplar a gravação de logs do request.

---

## 4. Pontos Ideais para Integração dos Logs

### 4.1 Estratégia de Camadas — "3 camadas de log"

| Camada | O que registra | Onde fica |
|---|---|---|
| **A. Application Log** | Request/Response, erros, desempenho, integrações | Middleware global + errorHandler |
| **B. Audit Log (manual explícito)** | Ações de negócio com semântica (criar/atualizar/deletar X) | Services (ponto único de mutação) |
| **C. Security Log** | Login (sucesso/falha), logout, troca de senha, 403 | authService + middleware authorize |

### 4.2 Ponto ideal: **SERVICES como ponto único**

Todos os CRUDs passam por services (exceto `userRoutes` e alguns controllers que chamam `sql`/`prisma` diretamente). O melhor ponto de instrumentação é **o service**, pois:
- Detém a operação de negócio com semântica
- Tem acesso ao dado **antes** (para `before` em updates)
- O controller já validou/autenticou

**Exceções que exigem instrumentação direta:**
- `userRoutes.js` — cria/deleta/reseta senha **inline** na rota (sem service). Recomenda-se mover para `userService.js` OU instrumentar na rota.
- `cashierController` e `driverController` — chamam `sql`/`prisma` diretamente em alguns handlers.
- `publicController` — pedidos/clientes (fluxo público).

### 4.3 Pontos ONDE registrar (por módulo)

| Módulo | Evento | Onde | Info a registrar |
|---|---|---|---|
| **Auth Admin** | login sucesso | authService.login | username, userId, ip, userAgent, resultado |
| **Auth Admin** | login falha (user não encontrado / senha errada) | authService.login (antes do throw) | username (tentado), ip, userAgent, motivo — **nunca a senha** |
| **Auth Admin** | criar usuário | authService.criarUsuario + userRoutes POST | actor (superadmin), target username, role |
| **Auth Admin** | deletar usuário | userRoutes DELETE | actor, target, motivo |
| **Auth Admin** | reset senha | userRoutes PUT /:id/password | actor, target — nunca o hash/nova senha |
| **Auth Admin** | alterar senha própria | authService.alterarSenha | userId, sucesso/falha |
| **Auth Admin** | 403 (acesso negado) | middleware authorize | user, rota, role requerida |
| **Produtos** | criar/atualizar/deletar | productService | actor, produtoId, name, before/after (price, status, estoque) |
| **Estoque** | baixa de estoque | orderService.darBaixaEstoque | actor (via pedido), produtoId, delta |
| **Categorias** | criar/atualizar/deletar | categoriaService | actor, categoriaId, nome |
| **Pedidos** | criar (público) | publicController.criarPedido | clienteNome/Whatsapp (dados LGPD), itens, total, ip |
| **Pedidos** | mudança de status | orderService.atualizarStatus | actor, pedidoId, **before→after** (ex.: pendente→producao), origem (admin/rotas legadas) |
| **Pedidos** | finalizar | orderService.finalizarPedido | actor, pedidoId |
| **Pedidos** | deletar | orderService.deletarPedido | actor, pedidoId, motivo se houver |
| **Caixa** | abrir/fechar | cashierController | actor, valores totais, status |
| **Entregadores** | CRUD + toggle | driverController | actor, entregadorId, before/after ativo |
| **Entregas** | registrar/remover | entregaService | actor, pedidoId, entregadorId, valor |
| **Loja** | atualizar settings | lojaService.updateSettings | actor, **changed_fields** (quais chaves) — themeSettings pode ser grande |
| **Clientes** | registrar/login/atualizar | publicController | telefone, ação — mascarar senha |
| **WhatsApp** | criar/deletar instância | whatsappInstanceService | actor, instanceId |
| **WhatsApp** | QR/reconnect/teste/envio | whatsappController/service | actor, instanceId, sucesso/falha |
| **Cupons** | (sem rota de mutação — apenas leitura) | — | — |

### 4.4 Pontos ONDE NÃO registrar

| Ponto | Motivo |
|---|---|
| GET /api/public/produtos, categorias, loja/status | Leitura pública, alto volume, sem valor de auditoria |
| GET /api/pedidos (listagem), GET /api/relatorios | Leitura; se necessário, app-log apenas (não audit) |
| Polling do admin (listar pedidos a cada 10s) | Volume alto; geraria ruído |
| /health, /, /api/config | Infra; apenas app-log opcional |
| Requisições de estáticos (express.static) | Irrelevante |
| Chamadas de status da Evolution API (polling interno) | Volume alto, sem ação de usuário — app-log debug apenas |
| Corpo de requisições com senha (qualquer login/change-password) | **NUNCA** gravar senhas nem hashes |

---

## 5. Componentes que Precisarão Ser Criados

### 5.1 Backend

| Componente | Tipo | Descrição |
|---|---|---|
| `src/middleware/context.js` | Middleware | Gera `requestId` (crypto.randomUUID), captura `req.user`/`req.cliente`, ip, userAgent, inicia `req.logger`/`req.audit` com contexto |
| `src/services/auditService.js` | Service | API `audit(entry)` e `appLog(level, msg, meta)`; fila interna; mascaramento; gravação via `auditRepository` |
| `src/services/appLogger.js` (ou extender `config/logger.js`) | Service | Logger estruturado JSON com nível, timestamp, requestId, usuarioId, correlacionado ao audit |
| `src/repositories/auditRepository.js` | Repository | Wrapper Prisma para `AuditLog` / `AppLog` — com inserção em lote e retry |
| `src/routes/auditRoutes.js` | Router | `GET /api/audit` (listar com filtros), `GET /api/audit/usuarios` (para o select do frontend), `GET /api/audit/actions` |
| `src/services/auditQueue.js` | Queue (in-process) | Buffer de logs em memória + flush em lote (intervalo 1s ou a cada 50 itens) + fallback síncrono |
| `src/middleware/auditContext.js` | Middleware (opcional) | Wrapper automático de rotas de mutação (heuristico por método+URL) — recomendado apenas como fallback, com lista de exceções |

### 5.2 Prisma (Schema)

| Modelo | Tabela | Observação |
|---|---|---|
| `AuditLog` | `audit_logs` | Tabela principal de auditoria (ver §8) |
| `AppLog` | `app_logs` | Logs de aplicação (erros, warning, integrações) |
| (reuso) `LoginLog` | `login_logs` | Migrar para usar o novo padrão (ou fundir no AuditLog) |

### 5.3 Frontend

| Componente | Arquivo | Descrição |
|---|---|---|
| Página de registros | `registros.html` (nova) ou seção em `superadmin.html` | Tela com `<select>` de usuários + timeline de ações |
| `js/core/auditApi.js` | JS | Wrapper de fetch para `/api/audit*` |
| Filtros | — | Por usuário, período, tipo de ação, módulo |

---

## 6. Componentes que Precisarão Ser Modificados

| Arquivo | Mudança necessária |
|---|---|
| `backend/prisma/schema.prisma` | Adicionar modelos `AuditLog`, `AppLog` (+ migration) |
| `backend/src/app.js` | Registrar `context` middleware (primeiro), `auditRoutes` |
| `backend/src/middleware/errorHandler.js` | Incluir `requestId` e `usuarioId` no log; não vazar stack em produção |
| `backend/src/config/logger.js` | Adicionar API `logger.child({requestId})`, suporte a JSON estruturado |
| `backend/src/services/authService.js` | Logs de login sucesso/falha; `alterarSenha` |
| `backend/src/services/orderService.js` | Audit de status/finalizar/deletar + baixa estoque |
| `backend/src/services/productService.js` | Audit CRUD com before/after |
| `backend/src/services/categoriaService.js` | Audit CRUD |
| `backend/src/services/lojaService.js` | Audit de settings com changed_fields |
| `backend/src/services/entregaService.js` | Audit registrar/remover |
| `backend/src/services/whatsappInstanceService.js` | Audit criar/deletar instância; trocar console por appLogger |
| `backend/src/routes/userRoutes.js` | Mover lógica para service (ou instrumentar inline); audit de CRUD de usuários e reset de senha |
| `backend/src/controllers/cashierController.js` | Audit abrir/fechar |
| `backend/src/controllers/driverController.js` | Audit CRUD + toggle |
| `backend/src/controllers/publicController.js` | Audit pedido criado, cliente registrado/atualizado, login cliente |
| `backend/src/controllers/whatsappController.js` | Audit envio de teste/contato; appLogger |
| `backend/src/routes/orderRoutes.js` | Rotas legadas WhatsApp: logar como ação não autenticada (pelo menos app-log) |
| Frontend `superadmin.html` / dashboard | Ponto de entrada para a nova página de registros |

---

## 7. Estrutura Recomendada da Camada de Logs

### 7.1 Fluxo Completo de Gravação

```
Request entra
  │
  ├─ [middleware/context.js]
  │     requestId = crypto.randomUUID()
  │     contexto = { requestId, ip, userAgent, method, path, ... }
  │     req.context = contexto
  │     req.user / req.cliente → injeta usuarioId/username quando houver auth
  │
  ├─ [middleware/auth.js / authorize]  (já existe)
  │     req.user definido; authorize grava SecurityLog em 403
  │
  ├─ Controller → Service
  │     Service chama auditService.log({
  │       action: 'produto.atualizar',       // enum de ações
  │       module: 'produtos',
  │       actor: { id, username, role },
  │       target: { type: 'produto', id, name },
  │       before: { price, status, estoqueAtual },   // quando aplicável
  │       after:  { price, status, estoqueAtual },
  │       changedFields: ['price', 'status'],
  │       metadata: { ip, userAgent, requestId },
  │       severity: 'info' | 'warning' | 'critical',
  │       reason: '...'                       // opcional
  │     })
  │
  ├─ auditService → fila em memória (auditQueue)
  │     - buffer com debounce (flush a cada 1s ou 50 itens)
  │     - INSERT em lote (prisma.createMany)
  │     - se fila cheia/falhar → fallback síncrono + appLog de erro
  │
  ├─ errorHandler (se erro)
  │     appLogger.error({ requestId, usuarioId, stack, status })
  │
  └─ Resposta enviada
        context middleware (após resposta) → appLogger do request completo (status, duração) — opcional
```

### 7.2 Padrões de Ação (enum de `action`)

Usar namespacing por módulo para facilitar filtro e agregação:

```
auth.login, auth.login_failed, auth.register, auth.change_password,
auth.reset_password (admin), auth.logout (futuro)
user.create, user.delete, user.update_role
produto.create, produto.update, produto.delete, produto.stock_update
categoria.create, categoria.update, categoria.delete
pedido.create (público), pedido.status_change, pedido.finalizar, pedido.delete
caixa.abrir, caixa.fechar
entregador.create, entregador.update, entregador.toggle, entregador.delete
entrega.registrar, entrega.remover
loja.settings_update
cliente.register, cliente.login, cliente.update
whatsapp.instance_create, whatsapp.instance_delete, whatsapp.test_send, whatsapp.contact_send
```

### 7.3 Desacoplamento da Lógica de Negócio

- Services **não chamam Prisma para logs** — chamam `auditService.log()` (fachada).
- `auditService` não conhece regras de negócio; recebe payload já estruturado.
- Mascaramento acontece dentro do `auditService` (camada única) — nunca no business service.
- O request nunca espera a gravação do log (assíncrono por fila), exceto para ações críticas configuráveis (`severity: critical` → gravação síncrona com await).

---

## 8. Modelo do Banco de Dados para Auditoria

### 8.1 `AuditLog` (`audit_logs`)

```prisma
model AuditLog {
  id            BigInt   @id @default(autoincrement())
  requestId     String   @map("request_id")      // UUID de correlação
  sessionId     String?  @map("session_id")      // futuro
  empresaId     Int      @default(1) @map("empresa_id")
  actorType     String   @default("admin") @map("actor_type")  // admin | cliente | anon | sistema
  actorId       Int?     @map("actor_id")
  actorUsername String?  @map("actor_username")
  actorRole     String?  @map("actor_role")
  action        String                            // ex.: produto.update
  module        String                            // produtos, pedidos, auth...
  targetType    String?  @map("target_type")
  targetId      String?  @map("target_id")
  before        Json?
  after         Json?
  changedFields Json?   @map("changed_fields")    // ["price","status"]
  severity      String   @default("info")         // info|warning|critical
  reason        String?
  ip            String?
  userAgent     String?  @map("user_agent")
  metadata      Json?                             // extras (url, method, navegador, OS)
  createdAt     DateTime @default(now()) @map("criado_em")

  @@index([empresaId, action])
  @@index([empresaId, actorId, createdAt])
  @@index([empresaId, createdAt])
  @@index([requestId])
  @@map("audit_logs")
}
```

### 8.2 `AppLog` (`app_logs`)

```prisma
model AppLog {
  id         BigInt   @id @default(autoincrement())
  requestId  String   @map("request_id")
  level      String                            // debug|info|warn|error
  message    String
  module     String?
  stack      String?
  meta       Json?
  empresaId  Int      @default(1) @map("empresa_id")
  createdAt  DateTime @default(now()) @map("criado_em")

  @@index([empresaId, level, createdAt])
  @@index([requestId])
  @@map("app_logs")
}
```

### 8.3 `LoginLog` — evolução

Recomendação: **manter** `login_logs` (compatibilidade) e passar a gravar também no `AuditLog` (ação `auth.login`), ou fundir. Decisão sugerida: fundir no AuditLog e manter LoginLog como visão legada do endpoint `/api/usuarios/logs`.

### 8.4 Estrutura do `before`/`after`

- `before`/`after` devem conter **somente os campos alterados** (não o objeto inteiro) — especialmente `themeSettings` e pedidos com itens.
- Para `pedido.status_change`, `changedFields: ["status"]`, `before: { status: "pendente" }`, `after: { status: "producao" }`.
- Para `loja.settings_update`, `changedFields` = chaves presentes no payload, `before/after` = valores daquelas chaves.

---

## 9. Estratégia de Implementação em Etapas

### Etapa 0 — Fundação (sem mudança de comportamento)
1. Adicionar modelos `AuditLog`/`AppLog` ao schema + migration (`npx prisma migrate dev --name add_audit_logs`).
2. Criar `middleware/context.js` (requestId + contexto) e registrá-lo em `app.js`.
3. Criar `auditService` + `auditQueue` (in-process) + `auditRepository`.
4. Estender `config/logger.js` (JSON + child context).
5. Criar `auditRoutes.js` (GET com filtros) + endpoint de usuários/actions.
6. **Zero impacto:** nenhuma rota de negócio alterada nesta etapa.

### Etapa 1 — Security Logs (autenticação)
7. Instrumentar `authService.login` (sucesso + falha), `alterarSenha`, `criarConta`.
8. Instrumentar `authorize` (403) no middleware/auth.js.
9. Instrumentar `userRoutes` (create/delete/reset password) — preferencialmente extraindo para `userService.js`.

### Etapa 2 — Audit de Mutações Core
10. `productService`, `categoriaService` (CRUD com before/after).
11. `orderService` (status, finalizar, deletar, baixa estoque).
12. `cashierController` (abrir/fechar) e `driverController` (CRUD+toggle).
13. `entregaService` (registrar/remover), `lojaService` (settings).

### Etapa 3 — Fluxo Público e WhatsApp
14. `publicController` (pedido criado, cliente register/login/update).
15. `whatsappController`/`whatsappInstanceService` (criar/deletar/teste/contato).
16. Rotas legadas `orderRoutes` (producao/pronto/em-rota) — app-log + audit anônimo.

### Etapa 4 — Frontend de Registros
17. Nova página `registros.html` (ou seção em superadmin) com:
    - `<select>` de usuários (carregado de `GET /api/audit/usuarios` — distinto por `actorId`/`actorUsername`)
    - Ao selecionar: timeline de ações daquele usuário (filtro `actorId`)
    - Filtros: módulo, ação, período, severidade
    - Troca de usuário sem reload (re-render via JS)
18. Link na dashboard/superadmin.

### Etapa 5 — Hardening
19. Retenção/expurgo (job agendado para apagar logs > N dias — sugerido 90/180).
20. Métricas de volume (contagem por dia) e alerta de crescimento.
21. Opcional: tabela separada/arquivamento (export CSV).

---

## 10. Impactos na Performance

| Cenário | Impacto | Mitigação |
|---|---|---|
| Gravação síncrona (await prisma.create por log) | Alto — adiciona 1-3ms por operação e +1 query | **Evitar**; usar fila assíncrona |
| Fila in-process com batch (`createMany`) | Baixo — 1 query a cada 50 logs ou 1s | Padrão recomendado; perda tolerável de último batch em crash |
| Gravação por request (app-log de GETs públicos) | Alto volume — 60 req/min de limite hoje, mas público pode crescer | Logar GETs apenas em `debug` ou omitir; audit só para mutações |
| Polling admin (10s) | Volume multiplica logs | Não auditar listagens |
| `before` com objetos grandes (themeSettings, pedidos) | Aumenta payload JSON do log | Restringir `before/after` aos campos alterados |
| `LoginLog` legado duplicado com AuditLog | Redundância de escrita | Fundir na migração (Etapa 0) |

**Recomendação de desempenho final:** ~95% dos audit logs via fila assíncrona com batch; apenas `severity: critical` (ex.: deleção de usuário, reset de senha) com gravação síncrona `await`.

---

## 11. Riscos Técnicos da Implementação

| # | Risco | Mitigação |
|---|---|---|
| 1 | **Perda de logs em crash** (fila em memória) | Aceitar (logs são não-críticos ao negócio) ou usar gravação síncrona para critical; documentar trade-off |
| 2 | **Regressão em fluxos existentes** (ex.: pedido público) | Instrumentação apenas em services, nunca mudar payloads/retornos; testes existentes de auth/errorHandler |
| 3 | **Vazamento de dados LGPD nos logs** (telefone, endereço, nome completo em before/after) | Camada de mascaramento única no auditService (ver §12) |
| 4 | **Volume de armazenamento** (pedidos + clientes + admin) | Retenção + expurgo; índice por `createdAt` |
| 5 | **Instrumentação duplicada** (rota e service ambos logam) | Convenção: **logar apenas em services**; para controllers sem service, logar no controller; revisar em code review |
| 6 | **JWT sem jti/session** limita rastreio de sessão | Usar `requestId` como correlação primária; `sessionId` futuro |
| 7 | **Rotas legadas WhatsApp sem auth** | Logar como `actor_type: anon`; considerar autenticá-las depois |
| 8 | **Vercel serverless** (api.js) — fila em memória inútil entre invocations | Em serverless, gravação síncrona com `await` (ou fire-and-forget com Promise); detectar `process.env.VERCEL` e alternar modo |
| 9 | **Multi-tenant futuro** — empresaId hardcoded 1 hoje | Gravar `empresaId` sempre; extrair de `req.user?.empresaId ?? 1` |
| 10 | **`catch(() => {})` no LoginLog atual** mascara falhas | Substituir por appLog de erro no novo padrão |

---

## 12. LGPD e Segurança

### 12.1 Dados que PODEM ser registrados
- IP (para fins de auditoria de segurança — legitimação: interesse legítimo)
- User-Agent (navegador/OS derivado)
- Username (admin) e nome/telefone de cliente (em ações de negócio)
- Timestamps, IDs de entidades, valores de pedidos
- Roles e permissões
- Endereço/logradouro (apenas quando alterado — mínimo necessário)

### 12.2 Dados que NUNCA devem ser registrados
| Dado | Motivo |
|---|---|
| Senhas (qualquer forma) | Secreto; nunca em texto claro nem hash completo |
| `passwordHash` completo | Permite offline brute-force |
| Tokens JWT / headers Authorization | Compromete sessões |
| Secrets de ambiente (EVOLUTION_API_KEY, SUPABASE keys, JWT_SECRET) | Credenciais |
| QR codes / pairing codes da Evolution API | Dado sensível de sessão |
| Corpo completo de requisições de login | Pode conter senha |
| CPF/CNPJ (se houver no futuro) | Dado sensível LGPD — requer justificativa |

### 12.3 Mascaramento (camada única no `auditService`)
```js
function mask(v) {
  if (typeof v !== 'string') return v;
  if (/^\+?\d{10,14}$/.test(v)) return v.slice(0, 2) + '****' + v.slice(-2); // telefone
  if (/^\w+@/.test(v)) return v[0] + '***@' + v.split('@')[1];              // email
  if (/password|senha|hash/i.test(v)) return '[REDACTED]';                  // chaves sensíveis
  return v;
}
```
- Aplicado a `before/after/metadata` recursivamente.
- Chaves que disparam redação: `password`, `passwordHash`, `token`, `secret`, `apikey`, `qrCode`, `pairingCode`.

### 12.4 Conformidade com a LGPD
- **Base legal:** legítimo interesse do controlador (auditoria e segurança) — art. 7º, IX LGPD.
- **Minimização:** gravar apenas campos alterados; mascarar telefones parciais.
- **Finalidade:** logs de auditoria com finalidade declarada; política de retenção (sugerido 180 dias) com expurgo automático.
- **Portaria de acesso:** endpoint `GET /api/audit` restrito a `superadmin` (já existe padrão `authorize`).
- **Direitos do titular:** se cliente pedir portabilidade/eliminação, os logs de pedido contendo dados pessoais precisam ser tratáveis — por isso `actorType: cliente` e `targetId` indexados.

---

## 13. Recomendações de Melhorias Arquiteturais Relacionadas

1. **Extrair `userRoutes` para `userService` + `userController`** — hoje CRUD de usuários (operação mais sensível) está inline na rota; sem service não há ponto único de auditoria.
2. **Padronizar `empresaId`** — substituir hardcoded `1` por `req.user.empresaId` com fallback, para o log e para o negócio (prepara multi-tenant).
3. **Centralizar console.log/error** — todos os `console.*` espalhados devem virar `appLogger` (whatsappInstanceService, orderService, whatsappService, controllers).
4. **Adicionar `jti`/`sessionId` ao JWT** — habilita revogação e correlação de sessão (futuro).
5. **Aplicar `authenticatePublic` nas rotas** (hoje está dentro do controller) — padroniza o middleware de contexto.
6. **`errorHandler` não vazar stack em produção** — já condicional via NODE_ENV; logar stack apenas no appLogger.
7. **Rotas legadas WhatsApp sem auth** — autenticar ou registrar explicitamente como ação anônima.
8. **Mover logging de GETs de polling para debug** — evitar ruído.
9. **Documentar enum de ações** (`docs/` ou constante central `auditActions.js`) — para consistência entre backend e frontend de filtros.
10. **Futuro:** se volume crescer, mover logs para tabela separada no mesmo banco ou para armazenamento externo (Supabase bucket / arquivo) com export periódico.

---

## 14. Atendimento aos Requisitos da Tela de Registros (Feature solicitada)

> "Separar logs por select — clicar em 'registro de logs' mostra um select com todos os usuários; ao selecionar, mostrar todas as ações daquele usuário; alternar usuários pelo mesmo select."

### Fluxo proposto (backend)
- `GET /api/audit/usuarios` → lista distinta de `(actorId, actorUsername, actorRole, última atividade)` — popula o `<select>`.
- `GET /api/audit?actorId=X&page=1&limit=50&module=&action=&dataInicio=&dataFim=` → ações do usuário, paginadas, mais recentes primeiro.
- Alternância de usuário: o frontend re-chama o endpoint com `actorId` trocado e re-renderiza (sem reload).

### Fluxo proposto (frontend)
- `registros.html` (ou seção na superadmin):
  - `<select id="selectUsuario">` — carregado de `/api/audit/usuarios`
  - Timeline: cards/list agrupados por data, com ícone por módulo, badge de severity
  - Filtros adicionais: módulo, ação, período, texto
  - Detalhe expandível: before/after (diff), ip, userAgent, requestId
- Sem reload ao trocar usuário (fetch + re-render).

### Requisitos adicionais atendidos
- Ações de usuário com `actorId` gravado em **todas** as mutações (Etapas 1-3).
- `action` e `module` indexados → filtros rápidos.
- Ações de clientes (`actorType: cliente`) e anônimas (pedido público) também aparecem, permitindo auditoria de pedidos por telefone.

---

## 15. Conclusão

A aplicação tem arquitetura Controller → Service → Repository consistente para a maioria dos módulos, o que torna a instrumentação de auditoria **barata e localizada** (services são o ponto único de mutação). A ausência de filas/workers é contornável com uma fila in-process simples + batch, com fallback síncrono para ambiente serverless (Vercel).

O maior risco não é técnico, mas de **vazamento de dados pessoais** (LGPD) em `before/after` e o **volume** de logs. Ambos são mitigados com mascaramento centralizado e retenção programada.

**Prioridade de implementação:** Etapa 0 (fundação) → Etapa 1 (auth) → Etapa 2 (core) → Etapa 4 (tela de registros) — a tela de registros pode ser entregue assim que as Etapas 0-1 estiverem prontas, pois já haverá dados de login para exibir, e o `select` de usuários se encherá progressivamente conforme os módulos forem instrumentados.

---

*Documento gerado por análise estática completa da codebase (controllers, services, repositories, middleware, routes, schema Prisma, config). Nenhum arquivo de código foi alterado.*
