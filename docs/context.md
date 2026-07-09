# Contexto Técnico — SIC D'Jesus

> **Objetivo:** Mapear a arquitetura, fluxos de dados, entrypoints, integrações e configurações do sistema para referência de desenvolvimento.

---

## 1. Arquitetura Geral

### 1.1 Diagrama de Camadas

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENTE (Browser)                                               │
│                                                                  │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐   │
│  │  PÚBLICO             │  │  ADMIN                           │   │
│  │  index.html          │  │  dashboard.html (shell + iframe) │   │
│  │  view/cart.html      │  │  ├─ admin.html (pedidos)         │   │
│  │                      │  │  ├─ painelLoja.html (config)     │   │
│  │  js/menu.js          │  │  ├─ balcao.html (PDV)            │   │
│  │  js/cart.js          │  │  ├─ caixa.html                   │   │
│  │  js/apiHelper.js     │  │  ├─ entregador.html              │   │
│  │  js/theme.js         │  │  ├─ relatorios.html              │   │
│  │  js/utils.js         │  │  ├─ superadmin.html              │   │
│  │  js/navbar.js        │  │  ├─ whatsapp.html                │   │
│  │                      │  │  └─ alterar-senha.html           │   │
│  │  css/style.css       │  │                                  │   │
│  │  css/cart.css        │  │  js/core/api.js (ES module)      │   │
│  │                      │  │  js/core/auth.js (ES module)     │   │
│  └─────────────────────┘  │  js/services/*.js (ES modules)    │   │
│                            │  js/painel.js (IIFE)              │   │
│                            │  js/theme.js (IIFE)               │   │
│                            │  js/utils.js (IIFE)               │   │
│                            │                                   │   │
│                            │  css/painelstyle.css              │   │
│                            │  css/login.css                    │   │
│                            └──────────────────────────────────┘   │
│                                                                  │
│  localStorage: clientToken, userLogged, cart, authUser,          │
│                authToken, themeCache, userPhone                  │
└──────────────────────┬───────────────────────────────────────────┘
                       │ REST HTTP (JSON)
                       │ Bearer Token (Authorization header)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  BACKEND (Node.js + Express v5)                                  │
│                                                                  │
│  server.js  ou  api.js (Vercel)                                  │
│       └── src/app.js                                             │
│            ├── helmet()                                          │
│            ├── cors({ origin: CORS_ORIGIN || '*' })              │
│            ├── express.json()                                     │
│            ├── apiLimiter (60 req/min em /api/*)                 │
│            ├── authLimiter (10 req/15min em /api/auth/*)         │
│            ├── 15 grupos de rotas (/api/*)                       │
│            └── errorHandler global                               │
│                                                                  │
│  src/routes/      → 15 arquivos (Express Router)                 │
│  src/controllers/ → 10 controllers                               │
│  src/services/    → 10 services                                  │
│  src/repositories/→ sqlRepository.js (Prisma wrapper)            │
│                                                                  │
│  Autenticação:                                                   │
│   ├─ Admin: middleware auth.js → token base64url (sem assinatura)│
│   └─ Cliente: JWT (jsonwebtoken lib, HMAC, 7 dias)              │
│                                                                  │
│  Rate Limit:                                                     │
│   ├─ Global API: 60 requisições/minuto                          │
│   └─ Auth: 10 requisições/15 minutos                            │
└──────────────────────┬───────────────────────────────────────────┘
                       │ Prisma ORM
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  DATABASE (PostgreSQL — NEON Serverless)                        │
│                                                                  │
│  13 tabelas (Prisma schema):                                    │
│                                                                  │
│  empresas ──┬── usuarios                   Unique: [empresaId, username]│
│             ├── categorias                 Unique: [empresaId, nome]   │
│             ├── produtos                                           │
│             ├── pedidos ─── itens_pedido    Cascade delete         │
│             ├── entregadores                                       │
│             ├── entregas_diarias                                   │
│             ├── caixa_diario                                       │
│             ├── horarios                   Unique: empresaId (1:1) │
│             ├── counters                   PK composta: nome+empresaId│
│             ├── clientes                   Unique: [empresaId, telefone]│
│             ├── cupons                     PK: codigo              │
│             └── whatsapp_instances         Unique: [empresaId, instanceId]│
│                                                                  │
│  Migrations: 5 (prisma/migrations/)                              │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Multi-tenant por `empresaId`

Todas as entidades são escopadas por `empresaId`. O middleware `authenticate` extrai `empresaId` do token do usuário e injeta em `req.user.empresaId`. Os services/controllers filtram todas as queries por este campo.

---

## 2. Entrypoints

### 2.1 Servidor Node (Desenvolvimento)

| Arquivo | Comando | Porta |
|---|---|---|
| `backend/server.js` | `npm run dev` (nodemon) ou `node server.js` | 3000 |

```js
// server.js — carrega app Express e inicia listen
const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/config/logger');
app.listen(config.port, () => logger.info(`Servidor na porta ${config.port}`));
```

### 2.2 Vercel Serverless (Produção)

| Arquivo | Roteado por | Handler |
|---|---|---|
| `backend/api.js` | `vercel.json` → `/api/(.*)` → `backend/api.js` | `module.exports = app` |

```js
// api.js — exporta app Express como handler serverless
const app = require('./src/app');
module.exports = app;
```

### 2.3 Vite Dev Server

| Comando | Porta | Proxy |
|---|---|---|
| `npx vite --port 5173` | 5173 | `/api` → `localhost:3000`, `/img` → `localhost:3000` |

---

## 3. Fluxos de Dados Críticos

### 3.1 Fluxo de Pedido (Cliente → Backend → DB)

```
Cliente (index.html)
  │
  ├─ 1. Navega no cardápio
  │     menu.js → GET /api/public/produtos?slug=salgadoscosta
  │     → apiHelper.js → fetch()
  │     ← JSON: [{ id, name, price, img, type, ... }]
  │
  ├─ 2. Adiciona ao carrinho
  │     localStorage.setItem('cart', JSON.stringify(itens))
  │
  ├─ 3. Finaliza pedido (view/cart.html)
  │     cart.js → POST /api/public/pedidos
  │     Body: { clienteNome, clienteWhatsapp, itens,
  │             tipoEntrega, formaPagamento, troco,
  │             endereco, lat, lon, cupomCodigo }
  │     → apiHelper.js → fetch() com clientToken
  │
  ├─ 4. Backend cria pedido:
  │     publicController → publicService
  │       ├─ Valida itens (produtos existentes, estoque)
  │       ├─ Calcula valores (subtotal, taxa entrega, taxa cartão, desconto cupom)
  │       ├─ Cria Pedido + ItensPedido (transação Prisma)
  │       ├─ Atualiza estoque
  │       ├─ Gera ID sequencial via Counter
  │       └─ Retorna { pedidoId, total }
  │
  └─ 5. Admin vê pedido (admin.html)
       polling GET /api/pedidos a cada 10s
       → card na esteira "Aceitos"
```

### 3.2 Fluxo de Autenticação Admin

```
login.html
  │
  ├─ usuario: senha
  │  POST /api/auth/login
  │  Body: { username, password }
  │
  ├─ authController → authService
  │   ├─ Busca usuario no DB (Prisma: usuarios)
  │   ├─ bcrypt.compare(senha, passwordHash)
  │   ├─ Gera token base64url:
  │   │   Buffer.from(JSON.stringify({
  │   │     id, username, role, empresaId, lojaNome
  │   │   })).toString('base64url')
  │   └─ Retorna { token, user: { username, role, lojaNome } }
  │
  └─ Frontend salva no localStorage:
     authUser = { token, username, role, lojaNome, _expiry: Date.now() + 86400000 }
     Redireciona para dashboard.html
```

### 3.3 Fluxo de Theming

```
1. Página carrega theme.js (IIFE auto-executável)
2. init() detecta contexto:
   ├─ Pública: lê data-slug do <body> → GET /api/loja/settings?slug=...
   └─ Admin: lê authUser do localStorage → GET /api/loja/settings-admin
3. applyTheme(themeSettings):
   Injeta no :root: --primary, --primary-bg, --secondary, --surface, --text, etc.
4. Fallback: localStorage themeCache (TTL 5 min)
5. menu.js:carregarConfigLoja() reaplica tema (duplicação)
```

### 3.4 Fluxo de Notificação WhatsApp

```
Pedido muda de status (admin.html)
  │
  ├─ PATCH /api/pedidos/:id/status
  │  Body: { status: "em_rota" }
  │
  ├─ orderController → orderService
  │   ├─ Atualiza status no DB
  │   ├─ Se status = "em_rota":
  │   │   POST /api/pedidos/:id/finalizar
  │   │   → EntregaService registra entrega
  │   └─ Notificação WhatsApp:
  │       → whatsappService.sendStatusNotification(empresaId, pedido)
  │           ├─ Busca instância ativa da empresa
  │           ├─ Busca Evolution API: POST /message/sendText/{instanceId}
  │           │   Body: { number: "55<telefone>", text: "Seu pedido está pronto!" }
  │           └─ catch silencioso (não quebra fluxo principal)
  │
  └─ Frontend atualiza polling
```

### 3.5 Fluxo de Rastreamento (Entregador)

```
entregador.html
  │
  ├─ WebSocket: wss://costasalgados-1.onrender.com
  │  Conecta com query param: ?entregadorId=entregador_1_1
  │
  ├─ Iniciar Corrida:
  │   navigator.geolocation.watchPosition(success, error, {
  │     enableHighAccuracy: true
  │   })
  │   A cada posição → POST /api/entregas
  │     Body: { entregadorId, pedidoId, data, valor }
  │   WebSocket envia posição para mapa
  │
  └─ Finalizar Corrida:
      navigator.geolocation.clearWatch(watchId)
      POST /api/entregas (registro final)
```

### 3.6 Fluxo de Caixa

```
caixa.html
  │
  ├─ Abrir caixa: POST /api/caixa/abrir → { valorInicial }
  │
  ├─ Carregar dia: GET /api/caixa/hoje
  │   + GET /api/pedidos?createdAtFrom=...&createdAtTo=...
  │   → Calcula totais por forma de pagamento no frontend
  │   → Renderiza gráfico Chart.js (doughnut)
  │
  └─ Fechar caixa: POST /api/caixa/fechar
      Body: { totalDinheiro, totalPix, totalDebito, totalCredito,
              totalPedidos, quantidadePedidos }
```

---

## 4. Integrações Externas

### 4.1 Evolution API (WhatsApp)

| Item | Detalhe |
|---|---|
| URL | `EVOLUTION_URL` (ex: `https://evolution-api-production-2837.up.railway.app`) |
| Autenticação | Header `apikey` |
| Instância | Gerenciada por empresa (1 por empresa, exceto superadmin) |
| Uso | Notificar cliente sobre status do pedido |
| Endpoints | `POST /message/sendText/{instanceId}` |
| Proxy | Via `POST /api/whatsapp` |

### 4.2 Mapbox GL JS (Mapas)

| Item | Detalhe |
|---|---|
| Versão | v3.3.0 (CDN) |
| Token | Carregado via `GET /api/config` (retorna `mapboxToken`) |
| Uso | Renderizar mapa de entregas, marcar posição do entregador |
| Proxy | `GET /api/proxy/mapbox?path=...&params...` |

### 4.3 GraphHopper (Rotas)

| Item | Detalhe |
|---|---|
| Chave | `GRAPHHOPPER_KEY` |
| Uso | Calcular rota otimizada entre entregador e cliente |
| Proxy | `GET /api/proxy/graphhopper?path=...` |
| Base URL | `https://graphhopper.com/api/1` |

### 4.4 Geoapify (Geocoding)

| Item | Detalhe |
|---|---|
| Chave | `GEOAPIFY_KEY` |
| Uso | Obter coordenadas a partir do endereço/CEP |
| Proxy | `GET /api/proxy/geoapify?path=...` |
| Chama de | `cart.js:getLatLon()` |

### 4.5 ViaCEP (CEP)

| Item | Detalhe |
|---|---|
| URL | `https://viacep.com.br/ws/{CEP}/json/` |
| Uso | Auto-preenchimento de endereço a partir do CEP |
| Chama de | `cart.js:buscarCEP()` |
| Proxy | Direto do frontend (sem proxy backend) |

### 4.6 BrasilAPI (CEP)

| Item | Detalhe |
|---|---|
| URL | `https://brasilapi.com.br/api/cep/v2/{CEP}` |
| Uso | Auto-preenchimento de endereço |
| Chama de | `menu.js:buscarEnderecoPorCEP()` |

---

## 5. Variáveis de Ambiente

### 5.1 Backend (`.env`)

| Variável | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `PORT` | Não | `3000` | Porta do servidor |
| `DATABASE_URL` | **Sim** | — | PostgreSQL connection string (Neon) |
| `CORS_ORIGIN` | Não | `*` | Origens permitidas (separadas por vírgula) |
| `JWT_SECRET` | **Sim** | `fallback-dev-secret-do-not-use-in-prod` | Chave para assinar tokens JWT |
| `EVOLUTION_URL` | **Sim** | — | URL base da Evolution API |
| `EVOLUTION_API_KEY` | **Sim** | — | API key Evolution |
| `EVOLUTION_INSTANCE` | Não | `costasalgados-testedev` | Nome da instância (legado) |
| `MAPBOX_TOKEN` | **Sim** | — | Token Mapbox |
| `GRAPHHOPPER_KEY` | Não | — | Chave GraphHopper |
| `GEOAPIFY_KEY` | Não | — | Chave Geoapify |
| `SUPERADMIN_PASSWORD` | Não | (seed script) | Senha do superadmin para seed |

### 5.2 Frontend (`.env.example`)

| Variável | Obrigatório | Descrição |
|---|---|---|
| `VITE_API_URL` | Não (default `/api`) | URL base da API para dev |

---

## 6. Rotas da API (15 grupos)

### 6.1 Mapa Completo

| Prefixo | Autenticação | Acesso | Endpoints |
|---|---|---|---|
| `GET/POST /api/auth` | Rate-limit (10/15min) | Público | login, register (superadmin), register-public, change-password |
| `GET/POST/PUT/DEL /api/produtos` | auth + role | Admin+ | CRUD produtos |
| `GET/POST/PATCH/DEL /api/pedidos` | auth (público no POST) | Misto | CRUD pedidos, status, finalizar, notificações WhatsApp |
| `GET/POST/PUT/PATCH/DEL /api/entregadores` | auth + role | Admin+ | CRUD entregadores, toggle ativo |
| `GET/POST /api/caixa` | auth | Admin | hoje, abrir, fechar, relatorios |
| `GET/PUT /api/horarios` | auth (PUT: admin+) | Admin | GET/PUT horários |
| `GET/POST /api/proxy/:service` | **NENHUMA** | Público | Proxy Mapbox, GraphHopper, Geoapify |
| `GET/POST /api/admin` | auth + superadmin | Superadmin | Listar/criar empresas |
| `GET/POST/PUT/DEL /api/categorias` | auth + role | Admin+ | CRUD categorias |
| `GET/POST/DEL /api/whatsapp` | auth + role | Admin+ | Instâncias WhatsApp, QR code, reconectar, teste |
| `GET/PUT /api/loja` | Misto | Público/Admin | status (público), settings (público), settings-admin (auth) |
| `POST /api/upload` | **NENHUMA** | Público | Upload de imagens (multer, 5MB, apenas imagens) |
| `GET/POST/PUT /api/public` | **NENHUMA** (JWT opcional) | Público | Produtos, categorias, loja, clientes (register/login/me), pedidos, cupons |
| `GET/POST/DEL/PUT /api/usuarios` | auth + superadmin | Superadmin | CRUD usuários admin |
| `GET/POST/DEL /api/entregas` | auth | Admin | Registro de entregas por dia |
| `GET /health` | NENHUMA | Público | `{ status: 'ok' }` |
| `GET /` | NENHUMA | Público | `{ status: 'online', sistema: 'Backend SalgadosCosta' }` |
| `GET /api/config` | NENHUMA | Público | `{ mapboxToken, graphhopperKey }` |
| `GET /img/*` | NENHUMA | Público | Arquivos estáticos de imagem |

### 6.2 Rotas Públicas sem Autenticação (Risco)

| Rota | Risco |
|---|---|
| `GET /api/config` | Expõe tokens Mapbox e GraphHopper |
| `GET/POST /api/proxy/:service` | Qualquer um pode usar seus tokens via proxy |
| `POST /api/upload` | Upload anônimo de imagens (limitado a 5MB e tipos imagem) |
| `GET /api/public/*` | Dados públicos do cardápio (desejado) |

---

## 7. Banco de Dados

### 7.1 Resumo dos Modelos

| Tabela | PK | FKs | Uniques | Uso principal |
|---|---|---|---|---|
| empresas | id (Int) | — | slug | Tenant raiz |
| usuarios | id (Int) | empresaId | [empresaId, username] | Funcionários admin |
| categorias | id (Int) | empresaId | [empresaId, nome] | Agrupamento de produtos |
| produtos | id (Int) | empresaId, categoryId | — | Itens do cardápio |
| pedidos | id (String UUID) | empresaId | — | Pedidos de clientes |
| itens_pedido | id (Int) | pedidoId, produtoId | — | Itens de cada pedido |
| entregadores | id (Int) | empresaId | — | Cadastro de entregadores |
| entregas_diarias | id (Int) | empresaId | — | Registro diário de entregas |
| caixa_diario | id (Int) | empresaId | — | Abertura/fechamento de caixa |
| horarios | id (Int) | empresaId (unique) | empresaId (1:1) | Horários de funcionamento |
| clientes | id (Int) | empresaId | [empresaId, telefone] | Clientes cadastrados |
| cupons | codigo (String PK) | empresaId | codigo | Cupons de desconto |
| whatsapp_instances | id (Int) | empresaId | [empresaId, instanceId] | Sessões WhatsApp |
| counters | nome+empresaId (PK composta) | empresaId | PK composta | Geradores de ID sequencial |

### 7.2 Migrações Existentes

| Migration | Data | Conteúdo |
|---|---|---|
| `init` | 2026-06-20 | Schema inicial |
| `loja_v2` | 2026-06-23 | Campos de loja v2 |
| `add_store_config_fields` | 2026-06-25 | Campos de configuração |
| `add_cliente_and_cupom` | 2026-06-25 | Clientes, cupons, empresaId |
| `add_theme_settings` | 2026-07-07 | Configurações de tema |

---

## 8. Autenticação e Autorização

### 8.1 Token Admin (base64url — SEM ASSINATURA)

```js
// Geração (authService.js)
const token = Buffer.from(JSON.stringify({
  id: user.id,
  username: user.username,
  role: user.role,
  empresaId: user.empresaId,
  lojaNome: user.loja_nome
})).toString('base64url');

// Verificação (auth middleware.js)
const decoded = JSON.parse(
  Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
);
req.user = decoded;
```

**⚠ Vulnerabilidade:** Sem assinatura HMAC, sem expiração, sem revogação. Qualquer um que conheça a estrutura pode forjar tokens.

### 8.2 Token Cliente (JWT — jsonwebtoken, HMAC SHA256)

```js
// Geração (tokenService.js)
const token = jwt.sign(
  { id: cliente.id, empresaId: cliente.empresaId, telefone, nome },
  config.jwtSecret,
  { expiresIn: '7d' }
);

// Verificação
const decoded = jwt.verify(token, config.jwtSecret);
```

### 8.3 Roles

| Role | Acesso |
|---|---|
| `superadmin` | Tudo (incluindo criar empresas, gerenciar usuários) |
| `admin` | CRUD produtos, categorias, entregadores; gerenciar pedidos |
| `user` | Visualizar pedidos, alterar própria senha |

---

## 9. Segurança — Pontos Críticos Conhecidos

| ID | Problema | Severidade |
|---|---|---|
| C1 | `.env` versionado no Git com todas as credenciais | 🔴 Crítico |
| C2 | Backdoor superadmin via `?superadmin=true` no dashboard | 🔴 Crítico |
| C3 | Token admin base64url sem assinatura (forjável) | 🔴 Crítico |
| C4 | Senha superadmin (`tsa110594`) hardcoded no `login.html` | 🔴 Crítico |
| C5 | bcrypt no client-side (`alterar-senha.html`) | 🔴 Crítico |
| C6 | CORS fallback para `*` se `CORS_ORIGIN` não definido | 🔴 Crítico |
| A1 | JWT em localStorage (vulnerável a XSS) | 🟡 Alto |
| A2 | Ausência de Content Security Policy (CSP) | 🟡 Alto |
| A3 | CDNs sem `integrity` hash | 🟡 Alto |
| A4 | Senha em texto plano no corpo HTTP | 🟡 Alto |

---

## 10. Configurações de Build e Deploy

### 10.1 Vite (`vite.config.js`)

```js
export default defineConfig({
  root: '.',              // Raiz do projeto
  publicDir: 'public',    // PWA assets
  build: { outDir: 'dist' },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/img': 'http://localhost:3000'
    }
  }
})
```

**Multi-page entries (13):**
```js
rollupOptions: {
  input: {
    index: 'index.html', admin: 'admin.html', balcao: 'balcao.html',
    caixa: 'caixa.html', dashboard: 'dashboard.html',
    entregador: 'entregador.html', login: 'login.html',
    painelLoja: 'painelLoja.html', relatorios: 'relatorios.html',
    superadmin: 'superadmin.html', 'alterar-senha': 'alterar-senha.html',
    cart: 'view/cart.html', whatsapp: 'whatsapp.html'
  }
}
```

### 10.2 Vercel (`vercel.json`)

```json
{
  "version": 2,
  "builds": [
    { "src": "backend/api.js", "use": "@vercel/node" },
    { "src": "*.html", "use": "@vercel/static" },
    { "src": "js/**/*.js", "use": "@vercel/static" },
    { "src": "css/**/*.{css,scss}", "use": "@vercel/static" },
    { "src": "img/**/*", "use": "@vercel/static" },
    { "src": "public/**/*", "use": "@vercel/static" },
    { "src": "view/**/*", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "backend/api.js" },
    { "src": "/api/config", "dest": "backend/api.js" },
    { "src": "/health", "dest": "backend/api.js" },
    { "src": "/", "dest": "/index.html" },
    { "src": "/([^/.]+)$", "dest": "/$1.html" },
    { "src": "/(.*)", "dest": "/$1" }
  ]
}
```

**Build command:** `npx prisma generate --schema=prisma/schema.prisma && npx prisma db push --schema=prisma/schema.prisma --accept-data-loss`

### 10.3 Vitest (`vitest.config.js`)

```js
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
})
```

---

## 11. Testes

| Arquivo | Testes | Cobertura |
|---|---|---|
| `tests/utils.test.js` | 8 | escapeHtml (3), fmtMoeda (3), debounce (2) |
| `tests/backend.test.js` | 6 | Logger (1), auth middleware (3), errorHandler (2) |
| `backend/tests/` | 0 | Vazio |

**Lacunas:** Nenhum teste de controllers, services, repositories, fluxo de pedido, integração ou E2E.

---

## 12. Scripts Auxiliares

| Script | Função |
|---|---|
| `backend/scripts/seed.js` | Popula banco com empresa `salgadoscosta` + superadmin `djesus` |
| `backend/scripts/exportFirestore.js` | Exporta dados do Firestore legado para JSON |
| `backend/scripts/transformToSql.js` | Converte JSON exportado em INSERTs SQL |
| `start-servers.bat` | Inicia backend + frontend em janelas cmd (caminhos absolutos, não portável) |
| `vercel-build` | Gera Prisma Client + `db push` no deploy |

---

## 13. Dependências

### 13.1 Frontend (`package.json` raiz)

#### Produção
| Pacote | Versão | Uso |
|---|---|---|
| `firebase` | ^8.10.1 | SDK legado (não usado ativamente, exceto alterar-senha.html) |

#### Desenvolvimento
| Pacote | Versão | Uso |
|---|---|---|
| `vite` | ^6.0.0 | Build tool e dev server |
| `vitest` | ^2.0.0 | Test runner |

### 13.2 Backend (`backend/package.json`)

#### Produção
| Pacote | Versão | Uso |
|---|---|---|
| `@prisma/client` | ^6.5.0 | ORM PostgreSQL |
| `axios` | ^1.17.0 | HTTP client (Evolution API, geocoding) |
| `bcryptjs` | ^2.4.3 | Hash de senhas |
| `cors` | ^2.8.6 | CORS middleware |
| `dotenv` | ^17.4.2 | Variáveis de ambiente |
| `express` | ^5.2.1 | Framework web |
| `express-rate-limit` | ^7.5.0 | Rate limiting |
| `helmet` | ^8.0.0 | Headers de segurança HTTP |
| `jsonwebtoken` | ^9.0.3 | JWT para clientes |
| `multer` | ^2.2.0 | Upload de arquivos |

#### Desenvolvimento
| Pacote | Versão | Uso |
|---|---|---|
| `nodemon` | ^3.1.0 | Hot-reload |
| `prisma` | ^6.5.0 | CLI Prisma (migrations, studio) |
| `vitest` | ^2.0.0 | Test runner (pasta tests vazia) |

---

## 14. CDNs Externas (carregadas no frontend)

| CDN | Uso | Páginas |
|---|---|---|
| `cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css` | Ícones | Todas admin |
| `fonts.googleapis.com/css2?family=Plus+Jakarta+Sans` | Tipografia | Todas |
| `cdn.jsdelivr.net/npm/chart.js` | Gráficos | caixa.html, relatorios.html |
| `cdnjs.cloudflare.com/ajax/libs/mapbox-gl/3.3.0/mapbox-gl.js` | Mapas | entregador.html |
| `cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js` | Hash client-side | alterar-senha.html, superadmin.html |
| `code.iconify.design/2/2.2.1/iconify.min.js` | Ícones SVG | index.html, view/cart.html |

> **⚠ Risco:** Nenhum CDN tem atributo `integrity` para verificação de hash.
