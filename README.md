# SIC.ia — Sistema Integrado de Cardápio

Plataforma SaaS completa para gerenciamento de cardápio online, pedidos, entregas e financeiro para o segmento de alimentação.

## Visão Geral

O SIC.ia é um sistema multi-tenant que permite a empresas de alimentação (fábricas de salgados, restaurantes, lanchonetes) gerenciar todo o ciclo de vida dos seus pedidos — do cardápio online público até a conciliação financeira — com integração a marketplaces (iFood, Keeta, 99Food futuramente), WhatsApp e meios de pagamento (Asaas).

## Funcionalidades

### Cardápio Online (`index.html`)
- Cardápio público com categorias, produtos, imagens e preços
- Carrinho de compras com combos e configurações
- Checkout com endereço, forma de pagamento e troco
- Políticas de privacidade e consentimento (LGPD)
- PWA com service worker para experiência nativa

### Painel Administrativo (`admin.html` / `dashboard.html`)
- Gestão de pedidos em tempo real (pendente → produção → entrega → finalizado)
- Cadastro de produtos, categorias e configurações da loja
- Controle de caixa diário (abertura, sangria, fechamento)
- Relatórios de vendas por período
- Integração WhatsApp para notificações de pedidos
- Gestão de entregadores com app mobile dedicado

### Super Admin (`superadmin.html`) - Liberado apenas para desenvolvedor
- Dashboard multi-tenant com métricas consolidadas
- Gerenciamento de empresas (criar, editar, assinaturas)
- Auditoria de ações com logs completos
- Configuração de preços e billing (Asaas)
- Painel de integrações e webhooks

### App Entregador (`entregador/`)
- App mobile independente com PWA
- Login separado com autenticação própria
- Recebimento de entregas com confirmação
- Histólico de entregas e pagamentos
- Notificações push via Firebase Cloud Messaging

### Central Financeira
- Conciliação automática com marketplaces
- Entradas financeiras por plataforma
- Settlements e fechamentos diários
- Dashboard financeiro com KPIs

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  Vanilla HTML/CSS/JS + Vite                             │
│  tokens.css (design system) → pages/* → components/*    │
├─────────────────────────────────────────────────────────┤
│                      BACKEND                            │
│  Express 5 + Prisma ORM + PostgreSQL (Supabase)        │
│  28 rotas REST · 21 controllers · 30 services          │
├─────────────────────────────────────────────────────────┤
│                    INTEGRAÇÕES                          │
│  Asaas (pagamentos) · Evolution API (WhatsApp)         │
│  iFood · Keeta · 99Food (marketplaces)               │
│  Mapbox · GraphHopper · Geoapify (geolocalização)      │
│  Firebase (push notifications)                          │
└─────────────────────────────────────────────────────────┘
```

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3 (design tokens), JavaScript ES6+ |
| Build | Vite 6 |
| Backend | Node.js 22+, Express 5 |
| ORM | Prisma 6.5 |
| Banco | PostgreSQL (Supabase) |
| Auth | JWT (bcrypt + jsonwebtoken) |
| Pagamentos | Asaas (PIX, cartão, boleto) |
| WhatsApp | Evolution API |
| Deploy | Vercel (serverless + static) |
| Monitoramento | Sentry |
| Testes | Vitest |

## Estrutura do Projeto

```
├── *.html                 # Páginas principal (cardápio, login, admin, etc.)
├── css/
│   ├── tokens.css         # Design tokens (cores, espaçamentos, tipografia)
│   ├── base/              # Reset e estilos base
│   ├── components/        # Componentes reutilizáveis
│   ├── pages/             # Estilos por página
│   └── *-page.css         # Estilos específicos por página
├── js/
│   ├── admin.js           # Lógica do painel administrativo
│   ├── cart.js            # Carrinho de compras
│   ├── menu.js            # Renderização do cardápio
│   ├── superadmin*.js     # Módulos do super admin
│   ├── financeiro.js      # Central financeira
│   └── services/          # Serviços compartilhados
├── view/
│   └── cart.html          # Página do carrinho
├── entregador/            # App mobile do entregador (PWA)
│   ├── backend/           # API própria do entregador
│   ├── prisma/            # Schema Prisma do entregador
│   └── js/                # Lógica do app
├── backend/
│   ├── server.js          # Servidor Express principal
│   ├── api.js             # Entry point Vercel (serverless)
│   ├── prisma/
│   │   └── schema.prisma  # Schema do banco (30+ models)
│   └── src/
│       ├── routes/        # 28 arquivos de rotas
│       ├── controllers/   # 21 controllers
│       ├── services/      # 30 services
│       ├── middleware/     # Auth, rate limit, ownership, etc.
│       ├── integrations/  # Providers de marketplace
│       │   ├── core/      # Interface comum
│       │   ├── ifood/     # iFood API
│       │   ├── keeta/     # Keeta API
│       │   ├── 99food/    # 99Food API
│       │   └── saas/      # SaaS direto
│       ├── cron/          # Jobs agendados
│       └── utils/         # Utilitários
├── scripts/               # Scripts de manutenção
├── vite.config.js         # Configuração do Vite
├── vercel.json            # Configuração do deploy
└── package.json           # Dependências do frontend
```

## Modelos de Banco (Prisma)

O schema contém 30+ modelos, incluindo:

| Modelo | Descrição |
|--------|-----------|
| `Empresa` | Tenant principal (multi-filial com `parentEmpresaId`) |
| `Produto` / `Categoria` | Cardápio com controle de estoque |
| `Pedido` / `ItensPedido` | Ciclo completo de pedidos |
| `Pagamento` | Pagamentos via Asaas (PIX, cartão, boleto) |
| `Entregador` / `EntregaDiaria` | Gestão de entregadores |
| `CaixaDiario` | Controle de caixa |
| `Usuario` | Usuários com roles (superadmin, admin, user) |
| `Cliente` | Clientes com consentimento LGPD |
| `Subscription` | Assinaturas SaaS |
| `PlatformConnection` | Integrações com marketplaces |
| `FinancialEntry` / `Settlement` | Conciliação financeira |
| `AuditLog` / `AppLog` | Auditoria e logs |
| `WhatsAppInstance` | Instâncias WhatsApp |
| `WebhookEvent` | Eventos de webhook |

## Setup

### Pré-requisitos

- Node.js 22+
- PostgreSQL (ou Supabase)
- npm ou yarn

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/viniciuslimaan/onlineMenu.git
cd onlineMenu

# Instalar dependências do frontend
npm install

# Instalar dependências do backend
cd backend
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Gerar cliente Prisma
npx prisma generate

# Push do schema para o banco
npx prisma db push

# Voltar para a raiz
cd ..

# Iniciar frontend (porta 5173)
npm run dev

# Em outro terminal, iniciar backend (porta 3000)
cd backend
npm run dev
```

### Deploy (Vercel)

O projeto está configurado para deploy na Vercel:

- **Frontend**: arquivos estáticos (*.html, js/, css/)
- **Backend**: serverless function em `backend/api.js`
- **Rotas**: configuradas em `vercel.json`

```bash
# Build do backend para Vercel
cd backend
npm run vercel-build
```

## Variáveis de Ambiente

Veja `.env.example` para a lista completa. Principais:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão PostgreSQL (Supabase) |
| `JWT_SECRET` | Chave secreta para tokens JWT |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role do Supabase |
| `EVOLUTION_URL` | URL da instância Evolution API |
| `EVOLUTION_API_KEY` | Chave da API Evolution |
| `MAPBOX_TOKEN` | Token do Mapbox |
| `ASAA_API_KEY` | Chave da API Asaas |

## Roles e Permissões

| Role | Acesso |
|------|--------|
| `superadmin` | Super admin — gerencia todas as empresas, billing, auditoria ( Esse eh o desenvolvedor ) |
| `admin` | Admin da empresa — pedidos, relatórios, financeiro, entregadores |
| `user` | Usuário básico — apenas visualização |
| `entregador` | Entregador — app mobile dedicado |

## Integrações

### Pagamentos (Asaas)
- PIX, cartão de crédito/débito, boleto
- Split de pagamentos para marketplaces
- Webhooks para confirmação automática
- Subcontas para cada empresa

### Marketplaces
- **iFood**: Catálogo, pedidos, settlements
- **Keeta**: Pedidos e conciliação
- **99Food**: Pedidos e conciliação
- Provider comum com interface swappable

### WhatsApp (Evolution API)
- Notificação de pedidos
- Status de entrega
- Instâncias por empresa

### Geolocalização
- Mapbox (geocoding)
- GraphHopper (rotas)
- Geoapify (autocomplete de endereço)

## Testes

```bash
# Frontend
npm test

# Backend
cd backend
npm test
```

## Licença

ISC

## Contato

- **Repositório**: [github.com/viniciuslimaan/onlineMenu](https://github.com/viniciuslimaan/onlineMenu)
- **Issues**: [github.com/viniciuslimaan/onlineMenu/issues](https://github.com/viniciuslimaan/onlineMenu/issues)
