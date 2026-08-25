# Spec: Sistema Multi-Tenant

**Data:** 2026-08-23
**Status:** Aprovado
**Escopo:** Tornar o sistema SIC-IA completamente multi-tenant com isolamento por empresa via subdomínio

---

## Visão Geral

Transformar o sistema single-tenant atual (hardcoded `empresaId: 1`) em multi-tenant completo. Cada empresa opera em subdomínio exclusivo (`{slug}.sua-app.com`), com isolamento total de dados, autenticação por JWT, e Prisma queries sempre filtradas por `empresaId`.

**Estado atual:**
- Schema Prisma já tem `empresaId` em todos os modelos + unique constraints compostos
- JWT já carrega `empresaId` no payload
- Ownership middleware já valida `resource.empresaId === req.user.empresaId`
- **Mas código inteiro hardcodes `empresaId: 1`** — sqlRepository, services, controllers, public routes

---

## Seção 1: Cadeia de Auth (middleware)

```
Frontend → Bearer JWT
    ↓
[1] JWT Middleware (auth.js)
    → verificar assinatura, exp, iss, aud
    → decodificar: { userId, empresaId, role }
    → anexar em req.user
    ↓
[2] Auth Context (context.js)
    → extrair userId, empresaId, role de req.user
    → anexar em req.ctx
    ↓
[3] Authorization (ownership.js + authorize())
    → verificar empresa pertence ao usuário (match empresaId)
    → verificar role permite (superadmin > admin > user)
    ↓
[4] Prisma queries
    → WHERE empresaId = req.ctx.empresaId
    → superadmin ignora filtro empresaId
```

**Mudanças necessárias:**

| Arquivo | Mudança |
|---------|---------|
| `authService.js` | `login()` → lê `user.empresaId` do DB (não hardcoded) |
| `authService.js` | `criarConta()` → requer `empresaId` no body |
| `sqlRepository.js` | Remove `const EMPRESA_ID = 1`, cada método recebe `empresaId` |
| `context.js` | Adiciona `empresaId` em `req.ctx` |
| `ownership.js` | Já correto (valida match empresaId) |
| Novo: `requireEmpresa()` | Middleware que bloqueia se `req.ctx.empresaId` ausente/inválido |

---

## Seção 2: Roteamento por Subdomínio

**Extração do subdomínio:**
```
salgadoscosta.sua-app.com  →  hostname.split('.')[0]  →  "salgadoscosta"
pizzariax.sua-app.com      →  hostname.split('.')[0]  →  "pizzariax"
sua-app.com (root)         →  sem subdomínio          →  landing page ou erro
```

**Middleware `resolveEmpresa`:**
```javascript
function resolveEmpresa(req, res, next) {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];

  if (!subdomain || subdomain === 'www' || subdomain === 'api') {
    return next(); // rota genérica, sem empresa
  }

  const empresa = getEmpresaFromCache(subdomain);
  if (!empresa) {
    return res.status(404).json({ error: 'Loja não encontrada' });
  }

  req.ctx = req.ctx || {};
  req.ctx.empresaId = empresa.id;
  req.ctx.empresa = empresa;
  next();
}
```

**Vercel Config:**
- `vercel.json` → wildcard route `"*"` para SPA
- DNS → `*.sua-app.com` aponta para Vercel (wildcard CNAME)
- Vercel repassa `Host` header automaticamente

**Cache:**
- `Map<slug, { empresa, expirouEm }>` em memória
- TTL 5 minutos
- `invalidateEmpresaCache(slug)` ao atualizar settings

---

## Seção 3: Painel Admin (subdomínio-aware)

**Acesso por subdomínio:**
```
admin.sua-app.com                  →  superadmin (gerencia todas empresas)
{slug}.sua-app.com/admin           →  admin da empresa
{slug}.sua-app.com/{pagina}.html   →  user operacional
```

**Páginas por papel:**

| Página | URL multi-tenant | Acesso |
|--------|------------------|--------|
| Pedidos (recebidos) | `{slug}.sua-app.com/painelLoja.html` | `user`, `admin` |
| Caixa | `{slug}.sua-app.com/caixa.html` | `admin` |
| Balcão | `{slug}.sua-app.com/balcao.html` | `user`, `admin` |
| Entregador | `{slug}.sua-app.com/entregador.html` | `user`, `admin` |
| Relatórios | `{slug}.sua-app.com/relatorios.html` | `admin` |
| Rel. Entregadores | `{slug}.sua-app.com/relatorios-entregadores.html` | `admin` |
| Alterar Senha | `{slug}.sua-app.com/alterar-senha.html` | `user`, `admin` |

**Resumo por papel:**
```
user:    pedidos, balcao, entregador, alterar-senha (4 páginas)
admin:   todas as 7 páginas
superadmin: admin.sua-app.com (todas empresas) + qualquer {slug} (override)
```

**Fluxo de login admin/user:**
```
1. Usuário acessa {slug}.sua-app.com/{pagina}.html
2. Middleware resolveEmpresa extrai subdomínio → empresaId
3. Tela de login: username + password
4. POST /api/auth/login { username, password }
5. Backend:
   a. Busca usuário: WHERE empresaId = X AND username = Y
   b. Se não encontrado → 401
   c. JWT: { userId, empresaId, role, lojaNome }
6. Frontend decodifica JWT, carrega páginas normais
```

**Fluxo de login superadmin:**
```
1. Acessa admin.sua-app.com
2. POST /api/auth/login { username, password }
3. Busca: WHERE role = 'superadmin' AND username = Y
4. JWT: { userId, empresaId: null, role: 'superadmin', lojaNome: null }
```

---

## Seção 4: Loja Pública (storefront)

**Acesso:** `{slug}.sua-app.com`

**Rotas públicas (escopadas por subdomínio):**

| Rota | Multi-tenant |
|------|--------------|
| `GET /api/public/produtos` | extrai empresaId do subdomínio |
| `GET /api/public/categorias` | extrai empresaId do subdomínio |
| `GET /api/public/loja/status` | busca por slug do subdomínio |
| `GET /api/public/loja/settings` | busca por empresaId do subdomínio |
| `POST /api/public/clientes/register` | empresaId do subdomínio no token |
| `POST /api/public/clientes/login` | empresaId do subdomínio no token |
| `GET /api/public/pedidos` | extrai empresaId do subdomínio |
| `POST /api/public/pedidos` | injeta empresaId do subdomínio |

**Fluxo do cliente:**
```
1. Acessa salgadoscosta.sua-app.com
2. Frontend extrai subdomínio → "salgadoscosta"
3. GET /api/public/loja/status (middleware resolve empresa pelo Host)
4. Carrega tema, produtos, categorias da empresa
5. Faz pedido → POST /api/public/pedidos
6. Backend injeta empresaId do subdomínio (nunca do body)
7. Token: { id, empresaId: 1, telefone, nome }
```

**Regra de segurança:** cliente **nunca** envia `empresaId` — sempre resolvido pelo Host header.

---

## Mitigação IDOR

**Regra de ouro:** subdomínio **jamais** vem do body, query param ou path. Sempre do `Host` header.

**Controles:**
1. Não existe `?slug=` query param — removido
2. Frontend **nunca** envia empresaId — resolvido server-side
3. Host header definido pelo browser + DNS — attacker não controla
4. Token JWT carrega empresaId; middleware valida `token.empresaId == Host.empresaId`

**Validação no auth.js:**
```javascript
if (req.user.empresaId && req.ctx.empresaId) {
  if (req.user.empresaId !== req.ctx.empresaId) {
    return res.status(403).json({ error: 'Acesso negado: empresa não corresponde' });
  }
}
```

**Exceção superadmin:**
- `admin.sua-app.com` → `req.ctx.empresaId = null` (acesso global)
- `{slug}.sua-app.com/admin` → `req.ctx.empresaId = empresa.id` (override)
- `if (req.user.role === 'superadmin') → bypass empresaId check`

**Ataques mitigados:**

| Ataque | Bloqueio |
|--------|----------|
| IDOR via `?slug=` | Query param ignorado, Host é fonte única |
| Host header injection | Validação: subdomínio deve resolver para empresa existente |
| Request spoofing | Vercel/Express repassam Host original |
| Cross-empresa token | Token empresaId validado contra Host empresaId |

---

## Seção 5: Prisma Queries — escopo por empresa

**Helper `scopedWhere`:**
```javascript
function scopedWhere(ctx, extra = {}) {
  if (ctx.role === 'superadmin' && !ctx.empresaId) {
    return extra; // superadmin vê tudo
  }
  return { empresaId: ctx.empresaId, ...extra };
}
```

**sqlRepository — métodos que mudam:**

| Método | Atual | Novo |
|--------|-------|------|
| `listarProdutos()` | `empresaId: 1` | recebe `empresaId` param |
| `buscarProduto(id)` | `empresaId: 1` | recebe `empresaId` param |
| `criarProduto(data)` | `empresaId: 1` | `empresaId` do ctx |
| `listarPedidos()` | `empresaId: 1` | recebe `empresaId` param |
| `buscarPedido(id)` | sem filtro empresa | adiciona `empresaId` |
| `listarEntregadores()` | `empresaId: 1` | recebe `empresaId` param |
| `buscarCaixaHoje()` | `empresaId: 1` | recebe `empresaId` param |
| `listarClientes()` | `empresaId: 1` | recebe `empresaId` param |
| `buscarUsuario()` | `empresaId: 1` | recebe `empresaId` param |
| `listarCategorias()` | `empresaId: 1` | recebe `empresaId` param |
| `nextPedidoId()` | `empresaId: 1` | recebe `empresaId` param |
| `buscarCupom()` | `empresaId: 1` | recebe `empresaId` param |
| `listarWhatsAppInstances()` | `empresaId: 1` | recebe `empresaId` param |
| `listarEmpresas()` | sem filtro | só superadmin |

**Serviços que mudam:**

| Serviço | Mudança |
|---------|---------|
| `entregaService.js` | `empresaId: 1` → recebe `empresaId` |
| `userService.js` | `empresaId: 1` → recebe `empresaId` |
| `lojaService.js` | `buscarEmpresa(1)` → recebe `empresaId` |
| `paymentService.js` | `empresaId: 1` → recebe `empresaId` do pedido |
| `publicController.js` | `empresaId: 1` → extrai de `req.ctx.empresaId` |
| `whatsappInstanceService.js` | `empresaId: 1` → recebe `empresaId` do ctx |

**Regra:** `empresaId` nunca mais é constante. Sempre vem de `req.ctx.empresaId`.

### Regras de Negócio — WhatsApp Instance

| Regra | Detalhe |
|-------|---------|
| Máximo 1 instância por empresa | `listar()` retorna array; se `length >= 1`, botão "criar" desabilitado no frontend |
| Isolamento por empresa | `listarWhatsAppInstances(empresaId)` filtra por `empresaId`; empresa X nunca vê instância empresa Y |
| Criação com empresaId do ctx | `criar()` usa `req.ctx.empresaId` (não body) |
| Superadmin vê todas | `admin.sua-app.com` → `listarWhatsAppInstances()` sem filtro (empresaId = null) |
| Busca por ID valida empresa | `buscarWhatsAppInstance(id)` → valida `instance.empresaId === req.ctx.empresaId` |
| Delete valida empresa | `deletar(id)` → valida `instance.empresaId === req.ctx.empresaId` |

**Fluxo criação (admin da empresa):**
```
1. Admin acessa {slug}.sua-app.com/admin → WhatsApp
2. Frontend GET /api/admin/whatsapp → lista instâncias da empresa
3. Se array.length >= 1 → mostrar mensagem "Máximo 1 instância"
4. Se array.length === 0 → botão "Criar instância" habilitado
5. POST /api/admin/whatsapp { instanceName, phoneNumber }
6. Backend: valida empresaId do ctx, cria com empresaId do ctx
```

**Fluxo superadmin (admin.sua-app.com):**
```
1. Superadmin acessa admin.sua-app.com → WhatsApp
2. GET /api/admin/whatsapp → lista TODAS instâncias (sem filtro)
3. Pode gerenciar qualquer instância de qualquer empresa
```

---

## Seção 6: JWT — payload e login

**Payload admin/user (empresa específica):**
```javascript
{ id: 1, username: 'djesus', role: 'admin', empresaId: 1, lojaNome: 'Salgados Costa' }
```

**Payload superadmin (acesso global):**
```javascript
{ id: 1, username: 'superadmin', role: 'superadmin', empresaId: null, lojaNome: null }
```

**Payload cliente (empresa específica):**
```javascript
{ id: 42, empresaId: 1, telefone: '11999999999', nome: 'João' }
```

**Login admin/user:**
```
1. POST /api/auth/login { username, password }
2. Host header → extrair subdomínio → empresaId
3. Buscar: WHERE empresaId = X AND username = Y
4. Se não encontrado → 401
5. JWT com empresaId do subdomínio
```

**Login superadmin:**
```
1. POST /api/auth/login em admin.sua-app.com
2. Sem empresaId (acesso global)
3. Buscar: WHERE role = 'superadmin' AND username = Y
4. JWT com empresaId: null
```

**Login cliente:**
```
1. POST /api/public/clientes/login { telefone, password }
2. Host header → empresaId
3. Buscar: WHERE empresaId = X AND telefone = Y
4. JWT com empresaId do subdomínio
```

---

## Seção 7: Migração — plano de execução

**Fase 1: Infraestrutura (sem quebrar nada)**
1. Criar middleware `resolveEmpresa` (Host → empresaId)
2. Criar helper `scopedWhere(ctx, extra)` para queries
3. Atualizar `context.js` para incluir `empresaId` em `req.ctx`
4. Atualizar `auth.js` para validar empresaId do token vs Host
5. Cache de empresas (Map com TTL)

**Fase 2: sqlRepository (core)**
1. Remover `const EMPRESA_ID = 1`
2. Cada método recebe `empresaId` como parâmetro
3. `buscarPedido`/`buscarProduto` → adiciona filtro `empresaId` (previne IDOR)
4. `nextPedidoId` → recebe `empresaId`
5. `listarEmpresas` → só acessível por superadmin

**Fase 3: Services**
1. `orderService` → empresaId do ctx
2. `entregaService` → empresaId param
3. `userService` → empresaId param
4. `lojaService` → empresaId param
5. `paymentService` → empresaId do pedido
6. `productService` → empresaId do ctx
7. `authService` → empresaId do user (login) ou ctx (criarConta)
8. `whatsappInstanceService` → empresaId do ctx

**Fase 4: Controllers + Rotas**
1. `productController` → empresaId do ctx
2. `orderController` → empresaId do ctx
3. `publicController` → empresaId do resolveEmpresa
4. `adminRoutes` → empresaId do ctx (superadmin bypass)
5. Todas rotas admin → empresaId obrigatório no ctx

**Fase 5: Frontend**
1. `apiHelper.js` → empresaId extraído do subdomínio (auto)
2. `admin.html` → detecta subdomínio, ajusta menu
3. Páginas user → não precisam mudar (empresaId via JWT)
4. Login → empresaId automático pelo Host

**Fase 6: Configuração**
1. Vercel → wildcard DNS (`*.sua-app.com`)
2. `vercel.json` → rotas SPA
3. Seed empresa "Salgados Costa" com slug `salgadoscosta`
4. Usuário admin existente → mantido na empresa 1

---

## Seção 8: Testes e Validação

**Testes existentes:** 23/23 passando — devem continuar passando após migração.

**Testes de integração novos:**

1. `resolveEmpresa` middleware
   - subdomínio válido → empresaId no ctx
   - subdomínio inválido → 404
   - sem subdomínio → next() sem empresaId

2. Auth middleware
   - token empresaId == Host empresaId → next()
   - token empresaId ≠ Host empresaId → 403
   - superadmin → bypass empresaId check

3. Queries Prisma
   - empresa 1 não vê dados empresa 2
   - superadmin vê todas empresas
   - cliente não vê dados de outra empresa

4. Cross-tenant isolation
   - cliente empresa A não acessa produtos empresa B
   - admin empresa A não acessa pedidos empresa B
   - token empresa 1 rejeitado em empresa 2

**Checklist de validação:**
- [ ] `npx vitest run` → 23/23 passando
- [ ] Login admin em `salgadoscosta.sua-app.com` → empresaId = 1
- [ ] Login admin em `pizzariax.sua-app.com` → empresaId = 2
- [ ] Token empresa 1 rejeitado em empresa 2 → 403
- [ ] Superadmin vê todas empresas em `admin.sua-app.com`
- [ ] Pedidos empresa 1 não aparecem para empresa 2
- [ ] Settings empresa 2 não afetam empresa 1

---

## Decisões de Design

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Roteamento | Subdomínio (`{slug}.sua-app.com`) | Limpo, profissional, Vercel suporta nativamente |
| Empresa resolution | Host header (nunca query param) | Previne IDOR |
| Admin panel | Mesmo painel, subdomínio-aware | Menos manutenção, JWT determina escopo |
| Storefront | Subdomínio exclusivo, sem landing page | Cada empresa é seu próprio site |
| Tenant isolation | `empresaId` em toda query Prisma | Isolamento completo, padrão Prisma |
| Superadmin | `empresaId: null` no token | Acesso global sem restrição |
| Cache | In-memory Map, TTL 5min | Simples, empresa não muda frequentemente |

---

## Arquivos Afetados

**Backend (modificação):**
- `backend/src/middleware/auth.js`
- `backend/src/middleware/context.js`
- `backend/src/middleware/ownership.js`
- `backend/src/repositories/sqlRepository.js`
- `backend/src/services/authService.js`
- `backend/src/services/orderService.js`
- `backend/src/services/entregaService.js`
- `backend/src/services/userService.js`
- `backend/src/services/lojaService.js`
- `backend/src/services/paymentService.js`
- `backend/src/services/productService.js`
- `backend/src/controllers/productController.js`
- `backend/src/controllers/orderController.js`
- `backend/src/controllers/publicController.js`
- `backend/src/controllers/lojaController.js`
- `backend/src/routes/adminRoutes.js`

**Backend (novo):**
- `backend/src/middleware/resolveEmpresa.js`
- `backend/src/config/empresaCache.js`

**Frontend (modificação):**
- `js/apiHelper.js`
- `superadmin.html`
- `login.html`

**Config:**
- `vercel.json`
- DNS wildcard
