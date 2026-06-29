# Analyser 2 — Análise Arquitetural Completa

> **Projeto**: Sistema de gerenciamento de restaurantes 
> **Tipo**: Cardápio Online + Gestão de Pedidos + Rastreamento de Entregas  
> **Data da análise**: 2026-06-17  
> **Escopo**: Full repository scan (frontend + backend + docs + config)

---

## 1. Visão Geral do Projeto

### 1.1 O que o sistema faz

Sistema completo de cardápio online e gerenciamento de pedidos para uma fábrica de salgados com entrega delivery. Principais funcionalidades:

- **Cardápio público** (`index.html`) com categorias, promoções e carrinho de compras
- **Sistema de pedidos** com cálculo automático de taxas por bairro, cartão e cupons
- **Painel administrativo** (`admin.html`) para acompanhamento de pedidos em tempo real (aceito → produção → pronto → em rota → finalizado)
- **PDV / Balcão** (`balcao.html`) para lançamento de pedidos presenciais
- **Controle de Caixa** (`caixa.html`) com fechamento diário e relatórios
- **Gestão de Entregadores** (`entregador.html`) com CRUD, mapa em tempo real e resumo diário
- **Painel da Loja** (`painelLoja.html`) para cadastro de produtos e horários
- **Relatórios** (`relatorios.html`) com gráficos de faturamento diário e por período
- **Rastreamento** em tempo real via WebSocket + Mapbox + GraphHopper
- **Login / Cadastro** com bcrypt, roles (`superadmin`, `user`) e superadmin hardcoded
- **Notificações WhatsApp** automáticas via Evolution API (backend Node.js)

### 1.2 Tecnologias Utilizadas

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | HTML5, CSS3, JavaScript (vanilla) | ES5/ES6+ |
| **Estilização** | SCSS, CSS inline, Font Awesome 6, Google Fonts (Inter, Montserrat) | - |
| **Banco de Dados** | Firebase Firestore | Web SDK v8.10.1 |
| **Backend** | Node.js + Express | v5.2.1 |
| **Notificações** | Evolution API (WhatsApp) | via axios |
| **Mapas** | Mapbox GL JS v3.3.0 | com token exposto |
| **Rotas** | GraphHopper API v1 | com chave exposta |
| **Geocodificação** | Geoapify, BrasilAPI, ViaCEP | com chaves expostas |
| **Gráficos** | Chart.js | CDN |
| **Auth** | bcryptjs (cliente), localStorage | v2.4.3 |
| **Toasts** | Toastify JS (em desuso), toasts inline | misto |
| **Tempo Real** | WebSocket (ws://costasalgados-1.onrender.com) | externo |

### 1.3 Arquitetura Atual

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (12 HTMLs na raiz + view/)                     │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │ index.html │ │ cart.html │ │ admin.html │ │ balcao   │  │
│  └──────────┘ └──────────┘ └───────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ dashboard │ │ relatorios│ │ entregador│ │ painelLoja │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ caixa    │ │ login    │ │ superadmin│ │ alterarSenha│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│                                                         │
│  JS (vanilla, sem módulos, globais):                     │
│  menu.js | cart.js | painel.js | products.js* | navbar  │
│  shoppingCart.js* | firebase-init.js (centralizado)     │
│                                                         │
│  CSS: style.css, cart.css, painelstyle.css, login.css   │
└──────────┬──────────────────────────────────────────────┘
           │ Firebase Web SDK v8
           ▼
┌──────────────────────────────────────────────────────────┐
│  FIREBASE FIRESTORE (NoSQL)                               │
│  Coleções: products, pedidos, historico, usuarios,       │
│  entregadores, entregaRegistro, relatoriosdeCaixa,       │
│  caixa, settings, cupons, counters                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  BACKEND (Node.js/Express) — backend/server.js (166 loc) │
│  POST /api/pedido/producao  → WhatsApp "entrou produção"  │
│  POST /api/pedido/pronto    → WhatsApp "pronto retirada"  │
│  POST /api/pedido/em-rota   → WhatsApp "a caminho + link" │
│  GET  /health               → status check                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  WEBSOCKET EXTERNO (costasalgados-1.onrender.com)        │
│  Rastreamento em tempo real de entregadores              │
│  (código fonte não está neste repositório)               │
└──────────────────────────────────────────────────────────┘
```

### 1.4 Coleções Firestore e Estrutura de Dados

| Coleção | Documento ID | Campos principais |
|---------|-------------|-------------------|
| `products` | ID numérico (string) | id, type, name, description, price, img, status, congelado, controlaEstoque, estoqueAtual, estoqueMinimo |
| `pedidos` | ID sequencial ("001") | id, cliente{nome, whatsapp, endereco, ...}, valores{itens, entrega, desconto, taxaCartao, total}, itens[], status, createdAt, entregadorId |
| `historico` | ID do pedido | {...pedido, finalizadoEm} |
| `usuarios` | Auto-ID | username, passwordHash, lojaNome, role, criadoEm |
| `entregadores` | Auto-ID | nome, endereco, whatsapp, chavePix, ativo, criadoEm |
| `entregaRegistro` | `entrega_{data}_{id}` | data, entregadorId, pedidos[], totalEntregas, totalValor |
| `caixa` | Data (YYYY-MM-DD) | abertoEm, valorInicial, status, fechadoEm, totalPedidos, totalComTroco |
| `relatoriosdeCaixa` | Data (YYYY-MM-DD) | data, quantidadePedidos, totalDinheiro, totalPix, totalDebito, totalCredito, totalPedidos, totalComTroco |
| `settings` | `horarios` | {Dom, Seg, Ter, Qua, Qui, Sex, Sáb} → {fechado, inicio, fim} |
| `cupons` | Código | desconto, usado |
| `counters` | `pedidoId` | last (número sequencial) |

---

## 2. Problemas Encontrados

### 2.1 Segurança — Críticos

| # | Problema | Localização | Risco |
|---|---------|-------------|-------|
| 1 | **API Keys em texto puro** — Mapbox, GraphHopper, Geoapify expostas no frontend | `entregador.html:199-201`, `cart.js:709`, frontend público | Consumo indevido de APIs pagas |
| 2 | **`.env` versionado** com Evolution API key | `backend/.env` no repositório | Vazamento de credenciais |
| 3 | **WebSocket sem autenticação** — qualquer cliente conecta e recebe localização | `entregador.html:201` | Privacidade, segurança física |
| 4 | **`postMessage` sem validação de origem** (`"*"`) | `dashboard.html:615`, `admin.html:697` | Ataques cross-origin |
| 5 | **Arquivos de API key soltos na raiz** | `api google iaStudio.txt`, `api openrouter ai.txt` | Exposição direta |

### 2.2 Segurança — Altos

| # | Problema | Localização | Risco |
|---|---------|-------------|-------|
| 6 | **Hashing de senha no cliente** — bcrypt executado no navegador | `menu.js:378,421`, `superadmin.html:181`, `alterar-senha.html:116` | Lógica de hash exposta |
| 7 | **Sem rate limiting** no login — força bruta possível | `login.html` (frontend puro) | Enumeração de usuários |
| 8 | **Firebase Security Rules não auditáveis** | Console Firebase | Possível acesso irrestrito |
| 9 | **Senha superadmin hardcoded** no frontend | `login.html:175-177` | `djesus / tsa110594` visível no source |
| 10 | **Auth via localStorage** — sem expiração, sem refresh token | `localStorage.getItem('authUser')` | Sessão eterna, XSS vulnerável |

### 2.3 Duplicação e Código Morto

| # | Problema | Localização |
|---|---------|-------------|
| 11 | **`shoppingCart.js`** — carrinho legado que não usa Firebase | `js/shoppingCart.js` (483 linhas) |
| 12 | **`products.js`** — array estático de produtos redundante (Firestore é a fonte real) | `js/products.js` (276 linhas) |
| 13 | **Lógica de carrinho duplicada** — `cart.js` vs `shoppingCart.js` | Dois arquivos com overlap total |
| 14 | **Múltiplas instâncias `db`** — algumas páginas redeclaram `const db = firebase.firestore()` mesmo com `firebase-init.js` | `superadmin.html:127`, `entregador.html:200`, `alterar-senha.html:84` |
| 15 | **Dois sistemas de login** — `login.html` (superadmin) vs `index.html/menu.js` (cliente final) | Coleções diferentes: `usuarios` vs `users` |

### 2.4 Arquitetura e Manutenção

| # | Problema | Localização |
|---|---------|-------------|
| 16 | **12 HTMLs na raiz** sem organização em pastas | Raiz do projeto |
| 17 | **CSS misto** — parte inline (HTML), parte externo (SCSS), sem padrão | Todos os HTMLs |
| 18 | **Globais poluídos** — dezenas de variáveis no escopo `window` sem namespacing | Todos os JS |
| 19 | **Sem padrão de toasts** — `alert()`, `confirm()`, `Toastify`, toasts inline customizados coexistem | Vários arquivos |
| 20 | **`alert()`/`confirm()` nativos ainda presentes** | `entregador.html:250,441`, `superadmin.html:191`, `balcao.html:1014,1251`, `cart.js:432,918` |
| 21 | **Backend monolítico** — 1 arquivo server.js com tudo misturado | `backend/server.js` |
| 22 | **Sem tratamento de erro consistente** — `.catch(() => {})` vazio em vários lugares | `admin.html:759,768,794` |
| 23 | **Sem testes automatizados** | Nenhum arquivo de teste no repositório |
| 24 | **README desatualizado** — descreve projeto original de lanchonete, não o atual | `README.md` |

### 2.5 Performance

| # | Problema | Localização |
|---|---------|-------------|
| 25 | **Sem debounce no input CEP** — request a cada digitação após 8 chars | `cart.js:536`, `menu.js:54` |
| 26 | **Re-renderização completa** do DOM no `admin.html` via `onSnapshot` | `admin.html:905-932` |
| 27 | **`onSnapshot` em tempo real** escuta coleção `products` inteira sem filtro | `painel.js:95`, `menu.js:198` |
| 28 | **Imagens sem lazy loading** | `index.html`, cards de produto |
| 29 | **Sem cache local de dados** Firebase — toda visita recarrega | Geral |

### 2.6 Escalabilidade

| # | Problema |
|---|---------|
| 30 | **Firestore como banco principal** — custo escala com reads/writes, sem joins, sem transações complexas |
| 31 | **Sem multi-tenant** — uma única Firestore instance para todos |
| 32 | **WebSocket broadcast** (`wss.clients.forEach`) — todos recebem localização de todos |
| 33 | **Sem fila de pedidos** — se o backend WhatsApp cai, notificações são perdidas |

---

## 3. Melhorias Recomendadas

### 3.1 Imediatas (baixo esforço, alto impacto)

| Ação | Esforço | Impacto |
|------|---------|---------|
| Mover API keys para backend e criar endpoints proxy | 2h | Elimina exposição |
| Remover `shoppingCart.js` (código morto) | 10min | Remove confusão |
| Remover `products.js` (dados obsoletos) | 5min | Remove confusão |
| Substituir `alert()`/`confirm()` restantes por modais | 2h | UX consistente |
| Adicionar `loading="lazy"` em imagens | 30min | Performance |
| Debounce (300ms) nos inputs de busca CEP | 15min | Performance |
| Verificação de origem no `postMessage` | 15min | Segurança |
| Padronizar toasts (usar apenas toasts inline) | 1h | UX consistente |
| Adicionar auth guard em páginas sem verificação | 1h | Segurança |

### 3.2 Curto Prazo (médio esforço)

| Ação | Esforço |
|------|---------|
| Organizar HTMLs em `/pages/admin/`, `/pages/public/` | 2h |
| Migrar para ES Modules com Vite | 4h |
| Unificar CSS em um sistema de design com variáveis CSS | 3h |
| Criar `utils.js` compartilhado (toast, modal, escapeHtml, fmtMoeda) | 2h |
| Extrair lógica Firebase para camada de serviços | 3h |
| Adicionar `.gitignore` para `.env`, chaves API | 5min |
| Atualizar README com docs reais do projeto | 30min |
| Implementar validação de formulário em tempo real | 3h |

### 3.3 Médio Prazo (alto esforço)

| Ação |
|------|
| Migrar Firebase → PostgreSQL (ver Seção 4) |
| Implementar arquitetura multi-tenant (ver Seção 5) |
| Adicionar service worker para PWA com cache offline |
| Implementar testes automatizados (Vitest + Playwright) |
| CI/CD pipeline (GitHub Actions) |
| Monitoramento com logs estruturados |

### 3.4 Organização de Pastas Sugerida (Frontend)

```
src/
├── pages/
│   ├── public/          # index.html, view/cart.html → cardápio cliente
│   └── admin/           # todas as páginas administrativas
├── js/
│   ├── core/            # firebase-init.js, utils.js, auth.js
│   ├── services/        # productService.js, orderService.js, driverService.js
│   └── pages/           # menu.js, cart.js, painel.js, etc.
├── css/
│   ├── base/            # reset, variables, typography
│   ├── components/      # buttons, modals, toasts, cards
│   └── pages/           # estilos específicos de página
├── assets/
│   └── img/
└── index.html
```

### 3.5 Organização de Pastas Sugerida (Backend)

```
backend/
├── src/
│   ├── controllers/     # productController, orderController, driverController
│   ├── services/        # whatsappService, geocodingService
│   ├── repositories/    # firestoreRepository → sqlRepository (futuro)
│   ├── routes/           # rotas organizadas por domínio
│   ├── middleware/       # auth, rateLimit, errorHandler
│   ├── config/           # firebase, env, cors
│   └── app.js
├── tests/
├── .env.example          # sem valores reais
└── package.json
```

---

## 4. Migração Firebase → SQL (Gratuita)

### 4.1 Por que migrar?

| Limitação do Firestore | Vantagem do SQL |
|------------------------|-----------------|
| Custo por operação (reads/writes) | Custo fixo de servidor |
| Sem JOINs — dados denormalizados | Relacionamentos com integridade referencial |
| Queries limitadas (sem `LIKE`, sem `GROUP BY` complexo) | SQL completo |
| Sem transações multi-documento | Transações ACID |
| Escalabilidade limitada para relatórios | Índices, agregações, views |

### 4.2 Alternativas Gratuitas

| Opção | Custo | Observação |
|-------|-------|------------|
| **PostgreSQL** (Railway, Render, Supabase free tier) | Free tier 500MB | Melhor opção — maduro, escalável |
| **SQLite** (Turso free tier) | 9GB free | Bom para início, distribuído |
| **PlanetScale** (MySQL) | Free tier 5GB | Serverless, branching |

**Recomendação**: **PostgreSQL no Railway ou Supabase** (free tier generoso, ecossistema Prisma)

### 4.3 Modelagem Relacional Proposta

```sql
-- Multi-tenant
CREATE TABLE empresas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Usuários
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',  -- superadmin, admin, user
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(empresa_id, username)
);

-- Produtos
CREATE TABLE produtos (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  type INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  img VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  congelado BOOLEAN DEFAULT false,
  controla_estoque BOOLEAN DEFAULT false,
  estoque_atual INTEGER DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 0
);

-- Pedidos
CREATE TABLE pedidos (
  id VARCHAR(10) PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  cliente_nome VARCHAR(255),
  cliente_whatsapp VARCHAR(20),
  cliente_endereco TEXT,
  cliente_numero VARCHAR(10),
  cliente_bairro VARCHAR(100),
  cliente_cep VARCHAR(8),
  cliente_referencia TEXT,
  tipo_entrega VARCHAR(20),  -- delivery, retirada
  forma_pagamento VARCHAR(30),
  troco DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pendente',
  valores_itens DECIMAL(10,2),
  taxas_entrega DECIMAL(10,2),
  taxas_cartao DECIMAL(10,2),
  desconto DECIMAL(10,2),
  total DECIMAL(10,2),
  entregador_id VARCHAR(100),
  lat DECIMAL(10,7),
  lon DECIMAL(10,7),
  criado_em TIMESTAMP DEFAULT NOW(),
  finalizado_em TIMESTAMP
);

-- Itens do Pedido (normalizado, sem array de strings)
CREATE TABLE itens_pedido (
  id SERIAL PRIMARY KEY,
  pedido_id VARCHAR(10) REFERENCES pedidos(id),
  produto_id INTEGER REFERENCES produtos(id),
  quantidade INTEGER NOT NULL,
  preco_unitario DECIMAL(10,2),
  sabores JSONB  -- [{nome: "Coxinha", qtd: 5}, ...]
);

-- Entregadores
CREATE TABLE entregadores (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  nome VARCHAR(255) NOT NULL,
  endereco TEXT,
  whatsapp VARCHAR(20),
  chave_pix VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Registro de entregas diárias
CREATE TABLE entregas_diarias (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  data DATE NOT NULL,
  entregador_id INTEGER REFERENCES entregadores(id),
  pedido_id VARCHAR(10) REFERENCES pedidos(id),
  valor DECIMAL(10,2),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Caixa diário
CREATE TABLE caixa_diario (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  data DATE NOT NULL,
  valor_inicial DECIMAL(10,2),
  total_dinheiro DECIMAL(10,2) DEFAULT 0,
  total_pix DECIMAL(10,2) DEFAULT 0,
  total_debito DECIMAL(10,2) DEFAULT 0,
  total_credito DECIMAL(10,2) DEFAULT 0,
  total_pedidos DECIMAL(10,2) DEFAULT 0,
  quantidade_pedidos INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'aberto',
  aberto_em TIMESTAMP,
  fechado_em TIMESTAMP
);

-- Horários
CREATE TABLE horarios (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) UNIQUE,
  dia VARCHAR(3) NOT NULL,  -- Dom, Seg, ...
  fechado BOOLEAN DEFAULT false,
  inicio TIME,
  fim TIME
);

-- Contadores
CREATE TABLE counters (
  nome VARCHAR(50) PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  last_value INTEGER DEFAULT 0
);
```

### 4.4 ORM Recomendado

**Prisma** — melhor DX para Node.js/TypeScript:

```prisma
// schema.prisma (exemplo)
model Empresa {
  id        Int       @id @default(autoincrement())
  nome      String
  slug      String    @unique
  produtos  Produto[]
  pedidos   Pedido[]
  usuarios  Usuario[]
}

model Produto {
  id              Int      @id
  empresa         Empresa  @relation(fields: [empresaId], references: [id])
  empresaId       Int
  type            Int
  name            String
  price           Decimal  @db.Decimal(10, 2)
  status          String   @default("active")
  // ...
}
```

### 4.5 Estratégia de Migração

**Fase 1 — Exportação (1-2 dias)**
```bash
# Exportar cada coleção Firestore para JSON
npx -p @google-cloud/firestore firestore-export
```

**Fase 2 — Transformação (1 dia)**
- Script Node.js que lê JSONs exportados e gera INSERTs SQL
- Mapeia dados denormalizados para normalizados
- Gera `empresa_id` padrão para dados existentes

**Fase 3 — Importação (1 dia)**
- Rodar migrations Prisma
- Importar dados transformados
- Verificar integridade

**Fase 4 — Transição (1-2 semanas)**
- Backend com feature flag: `USE_SQL=true`
- Rodar Firestore e PostgreSQL em paralelo
- Validar consistência
- Desligar Firestore

---

## 5. Arquitetura Multi-Empresa (Multi-Tenant)

### 5.1 Estratégia: Shared Database, Shared Schema

Todas as empresas compartilham o mesmo banco e as mesmas tabelas, com isolamento lógico via `empresa_id`.

**Vantagens**: Simples, custo baixo, manutenção única  
**Desvantagens**: Sem isolamento físico, requer disciplina em queries

### 5.2 Implementação no PostgreSQL

```sql
-- Row-Level Security (RLS)
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON produtos
  USING (empresa_id = current_setting('app.current_tenant_id')::int);
```

No backend:
```javascript
// Middleware que extrai empresa do JWT
app.use((req, res, next) => {
  const tenantId = req.user.empresa_id;
  db.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
  next();
});
```

### 5.3 Estrutura de Dados Multi-Tenant

```
empresas
  ├── usuarios (admin, user vinculados à empresa)
  ├── produtos
  ├── pedidos → itens_pedido
  ├── entregadores
  ├── entregas_diarias
  ├── caixa_diario
  ├── horarios
  └── counters (sequencial por empresa)

superadmin → acesso a TODAS as empresas (sem filtro RLS)
admin      → acesso apenas à sua empresa_id
user       → acesso apenas à sua empresa_id (limitado)
```

### 5.4 Onboarding de Nova Empresa

1. Admin preenche formulário (nome, slug)
2. Backend cria registro em `empresas`
3. Backend cria usuário admin vinculado
4. Admin faz login e começa a cadastrar produtos
5. Gera-se URL única: `{slug}.salgadoscosta.com.br` ou `salgadoscosta.com.br/{slug}`

### 5.5 Escalabilidade Futura

- **Fase atual**: Shared DB, shared schema
- **Escala 10+ empresas**: Connection pooling, read replicas
- **Escala 50+ empresas**: Database-per-tenant strategy com routing layer
- **Escala 100+**: Kubernetes + sharding por região

---

## 6. Sistema de Permissões (RBAC)

### 6.1 Matriz de Acesso

| Funcionalidade | superadmin | admin (empresa) | user |
|---------------|-----------|-----------------|------|
| Dashboard | Sim | Sim | Não |
| Ver pedidos | Todas empresas | Sua empresa | Não |
| Alterar status pedido | Sim | Sim | Não |
| Lançar pedido (balcão) | Sim | Sim | Sim |
| Cadastrar/editar produtos | Sim | Sim | Não |
| Gerir horários | Sim | Sim | Não |
| Relatórios | Todas empresas | Sua empresa | Não |
| Controle de caixa | Sim | Sim | Não |
| Gerir entregadores | Sim | Sim | Não |
| Gerir usuários | Sim (todos) | Não | Não |
| Alterar senha | Própria | Própria | Própria |

### 6.2 Implementação Atual (Firebase)

O sistema atual já tem rudimentos de RBAC:

```
authUser = {
  username: "djesus",     // superadmin
  role: "superadmin"      // ou "user"
}
```

O `dashboard.html` usa esse role para mostrar/ocultar seções do menu. O `superadmin.html` é protegido por esse role.

### 6.3 Implementação Futura (SQL)

```sql
-- Enum de roles
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'user');

-- Middleware de autorização
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

// Uso
app.delete('/api/produtos/:id', auth, authorize('superadmin', 'admin'), produtoController.delete);
app.get('/api/admin/usuarios', auth, authorize('superadmin'), userController.listAll);
```

### 6.4 Proteção de Rotas (Frontend)

```javascript
// authGuard.js — verificação em todas as páginas admin
(function() {
  const auth = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (!auth || !auth.username) {
    window.location.replace('login.html');
    return;
  }
  // Guard para superadmin-only
  if (window.location.pathname.includes('superadmin') && auth.role !== 'superadmin') {
    window.location.replace('dashboard.html');
  }
})();
```

---

## 7. Estrutura Ideal Sugerida

### 7.1 Arquitetura em Camadas (Backend)

```
┌─────────────────────────────────────────┐
│  HTTP Layer                              │
│  routes/  →  authRoutes, productRoutes  │
├─────────────────────────────────────────┤
│  Controller Layer                        │
│  controllers/  → valida input, chama     │
│                  service, formata output │
├─────────────────────────────────────────┤
│  Service Layer (lógica de negócio)       │
│  services/  → productService,            │
│               orderService, authService  │
├─────────────────────────────────────────┤
│  Repository Layer (acesso a dados)       │
│  repositories/  → abstrai Firestore/SQL │
├─────────────────────────────────────────┤
│  External Services                       │
│  whatsapp, geocoding, websocket          │
└─────────────────────────────────────────┘
```

### 7.2 APIs Propostas

```
# Autenticação
POST   /api/auth/login
POST   /api/auth/register
PUT    /api/auth/change-password

# Produtos (admin)
GET    /api/produtos
POST   /api/produtos
PUT    /api/produtos/:id
DELETE /api/produtos/:id
PATCH  /api/produtos/:id/status

# Pedidos
GET    /api/pedidos
POST   /api/pedidos
PATCH  /api/pedidos/:id/status
DELETE /api/pedidos/:id
POST   /api/pedidos/:id/notify          # WhatsApp

# Entregadores
GET    /api/entregadores
POST   /api/entregadores
PATCH  /api/entregadores/:id/toggle
DELETE /api/entregadores/:id

# Caixa
GET    /api/caixa/hoje
POST   /api/caixa/abrir
POST   /api/caixa/fechar
GET    /api/caixa/relatorios

# Relatórios
GET    /api/relatorios/diario
GET    /api/relatorios/periodo
GET    /api/relatorios/entregas

# Horários
GET    /api/horarios
PUT    /api/horarios

# Superadmin
GET    /api/admin/empresas
GET    /api/admin/usuarios
POST   /api/admin/usuarios
DELETE /api/admin/usuarios/:id
PUT    /api/admin/usuarios/:id/senha
```

### 7.3 Segurança nas APIs

```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 10 }));

// Helmet
const helmet = require('helmet');
app.use(helmet());

// CORS restrito
app.use(cors({ origin: ['https://salgadoscosta.com.br'] }));
```

---

## 8. Riscos Atuais

### 8.1 Risco Financeiro
- **APIs pagas expostas**: Mapbox (cobrança por tile load), GraphHopper (por request), Geoapify (por geocoding). Qualquer pessoa pode copiar os tokens e consumir.
- **Firestore**: Sem limites de budget — pico de pedidos pode gerar conta inesperada no pay-as-you-go.

### 8.2 Risco de Segurança
- **Senhas no cliente**: bcrypt no navegador expõe salt rounds e lógica de comparação. Um atacante pode bruteforce local sem rate limiting.
- **Sem HTTPS garantido no frontend deployado** — tokens trafegam em texto puro se não for HTTPS.
- **Sem CSRF protection**, sem Content-Security-Policy.

### 8.3 Risco de Dados
- **Sem backup automático** dos dados Firestore. Se alguém deletar uma coleção, não há rollback.
- **Dados não normalizados**: `itens` no pedido são strings formatadas (`"5x Coxinha → ..."`), impossível fazer analytics.

### 8.4 Risco Operacional
- **Backend WhatsApp sem fila**: se Evolution API estiver fora, mensagens são perdidas (`.catch(() => {})` vazio).
- **WebSocket externo sem monitoramento**: se `costasalgados-1.onrender.com` cair, rastreamento para.
- **Sem logging estruturado**: erros só vão para `console.error`.

### 8.5 Risco de Escalabilidade
- **1 Firestore instance para tudo**: se o sistema tiver 10 lojas, todas competem pelos mesmos recursos.
- **Sem cache**: cada visita ao cardápio = N reads no Firestore.

---

## 9. Plano de Evolução

### Fase 1: Auditoria e Limpeza (1-2 semanas)

```
Semana 1-2:
├── Remover shoppingCart.js (código morto)
├── Remover products.js (dados obsoletos)
├── Mover API keys para backend (proxy endpoints)
├── Adicionar .gitignore (.env, api keys, node_modules)
├── Revogar e gerar novas API keys
├── Substituir alert()/confirm() restantes por modais
├── Adicionar auth guard em todas as páginas admin
├── Padronizar toasts em um único sistema
├── Debounce em inputs CEP
├── Verificação de origem no postMessage
└── Atualizar README
```

### Fase 2: Migração de Dados (2-4 semanas)

```
Semana 3-6:
├── Provisionar PostgreSQL (Railway/Supabase free tier)
├── Criar schema com Prisma
├── Script de exportação Firestore → JSON
├── Script de transformação → SQL
├── Criar backend API REST com Express + Prisma
├── Feature flag USE_SQL
├── Rodar Firestore + SQL em paralelo
├── Validar consistência de dados
├── Migrar lógica de leitura para SQL
├── Migrar lógica de escrita para SQL
└── Desligar Firestore (manter backup 30 dias)
```

### Fase 3: Refatoração Arquitetural (4-8 semanas)

```
Semana 7-14:
├── Organizar frontend em /pages/
├── Migrar para ES Modules + Vite
├── Extrair utils.js, auth.js, api.js
├── Unificar CSS com design system
├── Refatorar backend em camadas (controller/service/repository)
├── Implementar testes unitários (Vitest)
├── Implementar testes E2E (Playwright)
├── Adicionar CI/CD (GitHub Actions)
├── Implementar PWA com service worker
└── Adicionar monitoramento (logs, métricas)
```

### Fase 4: Multi-Tenant e Escala (8-16 semanas)

```
Semana 15-24:
├── Implementar empresas no banco
├── RLS no PostgreSQL
├── Onboarding de novas empresas
├── Dashboard superadmin multi-tenant
├── Rate limiting e quotas por empresa
├── Cache Redis para cardápio (leituras frequentes)
├── Fila de processamento de pedidos (BullMQ)
├── Webhook de pagamentos (Mercado Pago)
├── App entregador (PWA com background geolocation)
├── White-label (temas por empresa)
└── Métricas de negócio por empresa
```

---

## Resumo (TL;DR)

O projeto está **funcional** como sistema single-tenant para uma fábrica de salgados. As melhorias já implementadas (centralização Firebase, auth, modais, toasts) elevaram a qualidade do código. O caminho para SaaS multi-tenant escalável requer:

1. **Limpeza imediata**: remover código morto, proteger API keys
2. **Migração SQL**: PostgreSQL com Prisma (gratuito via Railway/Supabase)
3. **Camadas**: separar controllers/services/repositories
4. **Multi-tenant**: `empresa_id` em todas as tabelas + RLS
5. **Infraestrutura**: CI/CD, testes, monitoramento

**Prioridade máxima**: proteger as chaves de API expostas — é o maior risco financeiro imediato.

---

*Relatório gerado por agente de análise arquitetural em 2026-06-17.*