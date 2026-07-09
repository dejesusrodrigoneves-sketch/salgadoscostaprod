# Análise Completa do Projeto — SIC D'Jesus (Fábrica de Salgados Costa)

> **Data:** 2026-07-09 | **Versão:** 2.0.0 | **Stack:** Vite + Vanilla JS + Express v5 + PostgreSQL (Prisma)

---

## 1. Visão Geral

### 1.1 Identidade

| Campo | Valor |
|---|---|
| Nome do sistema | SIC.ia (Sistema Integrado de Cardápio) |
| Cliente | Fábrica de Salgados Costa |
| Slug | `salgadoscosta` |
| Tipo | Cardápio online + PDV + gestão de pedidos multi-loja |
| Licença | Uso interno |

### 1.2 Arquitetura (3 camadas)

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND PÚBLICO (Vite/Vanilla JS)                      │
│  index.html, cart.html                                   │
│  js/menu.js, js/cart.js, js/apiHelper.js, js/theme.js    │
│  css/style.css, css/cart.css                             │
│  ───────────────────────────                             │
│  FRONTEND ADMIN (Vite/Vanilla JS)                        │
│  dashboard.html + 11 páginas internas                    │
│  js/painel.js, js/utils.js, js/core/*, js/services/*     │
│  css/painelstyle.css, css/login.css                      │
└──────────────┬───────────────────────────────────────────┘
               │ REST API (/api/*)
┌──────────────┴───────────────────────────────────────────┐
│  BACKEND (Node.js + Express v5)                          │
│  backend/server.js → src/app.js → 15 rotas                │
│  10 controllers + 10 services + sqlRepository.js         │
│  Autenticação: base64 (admin) + JWT (cliente)            │
└──────────────┬───────────────────────────────────────────┘
               │ Prisma ORM
┌──────────────┴───────────────────────────────────────────┘
│  DATABASE (PostgreSQL — NEON serverless)
│  13 modelos: empresas, usuarios, produtos, pedidos, etc.
│  Multi-tenant via empresaId
└───────────────────────────────────────────────────────────┘
```

### 1.3 Stack Tecnológica Real

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend build | Vite | 6.x |
| Frontend runtime | JavaScript vanilla (ES modules + IIFE) | — |
| Estilos | CSS3 (4 folhas + inline) | — |
| Backend framework | Express | 5.2.1 |
| Backend ORM | Prisma | 6.5.0 |
| Banco de dados | PostgreSQL (NEON serverless) | — |
| Autenticação admin | Token base64url (custom) | — |
| Autenticação cliente | JWT (`jsonwebtoken`) | 9.0.3 |
| Mapas | Mapbox GL JS v3.3.0 + GraphHopper | — |
| WhatsApp | Evolution API (proxy) | — |
| Testes | Vitest | 2.x |
| Deploy | Vercel (serverless) | — |

---

## 2. Estrutura de Arquivos

```
sic-ia/
├── index.html              # Cardápio público (loja)
├── admin.html              # Painel de pedidos (esteira de produção)
├── alterar-senha.html       # Alteração de senha admin
├── balcao.html              # PDV / Lançar pedido presencial
├── caixa.html               # Controle de caixa diário
├── dashboard.html           # Shell principal (sidebar + iframe)
├── entregador.html          # Gestão de entregadores + mapa
├── login.html               # Login/cadastro administrativo
├── painelLoja.html          # Configuração da loja (produtos, tema)
├── relatorios.html          # Relatórios de faturamento
├── superadmin.html          # Gestão de usuários e empresas
├── whatsapp.html            # Integração WhatsApp (Evolution API)
├── view/
│   └── cart.html            # Carrinho de compras (cliente)
├── js/
│   ├── apiHelper.js         # Cliente REST público (IIFE)
│   ├── cart.js              # Lógica do carrinho (cliente)
│   ├── menu.js              # Renderização do cardápio público
│   ├── navbar.js            # Toggle menu mobile
│   ├── painel.js            # CRUD produtos/categorias/config
│   ├── theme.js             # Engine de tematização por loja
│   ├── utils.js             # Utilitários (toast, modal, mask, auth)
│   ├── core/
│   │   ├── api.js           # Wrapper fetch para API admin (ES module)
│   │   └── auth.js          # Auth guard e gestão de sessão (ES module)
│   └── services/
│       ├── caixaService.js   # REST: caixa (abrir, fechar, relatórios)
│       ├── entregadorService.js # REST: entregadores CRUD
│       ├── orderService.js   # REST: pedidos (listar, status)
│       └── productService.js # REST: produtos CRUD
├── css/
│   ├── style.css            # Estilo do cardápio público (911 linhas)
│   ├── cart.css             # Estilo do carrinho (634 linhas)
│   ├── login.css            # Estilo do login admin (70 linhas)
│   └── painelstyle.css      # Estilo do painel admin (300 linhas)
├── backend/
│   ├── server.js            # Entry point (Express)
│   ├── api.js               # Wrapper para Vercel serverless
│   ├── src/
│   │   ├── app.js           # Config Express: middleware, rotas, error handler
│   │   ├── config/          # env.js, logger.js, prisma.js
│   │   ├── middleware/       # auth.js, errorHandler.js, rateLimit.js
│   │   ├── routes/          # 15 arquivos de rotas (Express Router)
│   │   ├── controllers/     # 10 controllers
│   │   ├── services/        # 10 services
│   │   └── repositories/
│   │       └── sqlRepository.js # Camada Prisma wrapper
│   ├── prisma/
│   │   ├── schema.prisma    # 13 modelos PostgreSQL
│   │   └── migrations/      # 5 migrações
│   └── scripts/             # seed.js, exportFirestore.js, transformToSql.js
├── public/                  # PWA assets (manifest.json, sw.js, icons)
├── docs/                    # 10 documentos de análise e especificação
├── tests/
│   ├── backend.test.js      # 6 testes de middleware
│   └── utils.test.js        # 8 testes de utilitários
├── img/                     # Imagens de produtos e logo
├── node_modules/            # Dependências frontend (Vite, Vitest, Firebase)
├── vercel.json              # Deploy Vercel
├── vite.config.js           # Vite 6: multi-page build + proxy
├── vitest.config.js         # Vitest 2: ambiente Node
├── start-servers.bat        # Script Windows para iniciar backend+frontend
├── .gitignore               # Protege .env*, node_modules, dist, logs
├── .env.example             # VITE_API_URL=/api
├── package.json             # Frontend: salgadoscosta-frontend v2.0.0
└── README.md                # Documentação principal (DESATUALIZADO)
```

### 2.1 Diagrama de Dependências JS/CSS por Página

```
index.html          → js/theme.js, js/utils.js, js/apiHelper.js, js/menu.js, js/navbar.js, css/style.css
view/cart.html       → js/theme.js, js/utils.js, js/apiHelper.js, js/cart.js, css/cart.css
login.html           → js/theme.js, css/login.css (inline predominante)
dashboard.html       → js/theme.js (CSS inline 370 linhas)
admin.html           → js/theme.js, js/utils.js (JS inline 340 linhas)
balcao.html          → js/utils.js, js/theme.js (JS inline 570 linhas)
caixa.html           → js/theme.js, js/utils.js, Chart.js CDN (JS inline 150 linhas)
entregador.html      → js/theme.js, js/utils.js, Mapbox GL JS CDN (JS inline 350 linhas)
painelLoja.html      → js/theme.js, js/utils.js, js/painel.js, css/painelstyle.css
relatorios.html      → js/theme.js, Chart.js CDN (JS inline 90 linhas)
superadmin.html      → js/theme.js, js/utils.js, bcryptjs CDN (JS inline 130 linhas)
whatsapp.html        → js/theme.js, js/utils.js (JS inline 200 linhas)
alterar-senha.html   → js/theme.js, js/utils.js, bcryptjs CDN (JS inline 50 linhas)
```

---

## 3. Análise por Página (Frontend)

### 3.1 `index.html` — Cardápio Público (153 linhas)

**Propósito:** Vitrine da loja para clientes finais. Exibe cardápio com filtros, promoções, mapa de localização, horários e login/cadastro.

**Fluxo:** `menu.js` → `apiHelper.js` → `GET /api/public/produtos?slug=...`

| Elemento | Descrição |
|---|---|
| Hero section | Nome da loja + descrição |
| Menu | Filtros: Tudo, Salgadinhos, Massas, Festa, Bebidas, Promoções |
| Cards de produtos | Grid renderizado por `menu.js` |
| Mapa | Google Maps em iframe |
| Status bar | Aberto/Fechado com horários dinâmicos |
| Dropdown login | Formulário inline para cliente (telefone + senha) |
| Carrinho flutuante | Link → `view/cart.html` com contador |
| WhatsApp flutuante | Link dinâmico |
| PWA | Service Worker (`/sw.js`), manifest.json |

**Problemas:** Serviço de CEP (`brasilapi.com.br`) fora do controle do projeto. Linha morta de Firestore em `menu.js:259` (`db.collection`). CEP no dropdown de cadastro sem validação de formato.

---

### 3.2 `admin.html` — Painel de Pedidos (997 linhas)

**Propósito:** Esteira de produção: Aceitos → Produção → Pronto → Em Rota.

**Fluxo:** `utils.js` → `fetch('/api/pedidos')` com Bearer token. Polling a cada 10s.

| Elemento | Descrição |
|---|---|
| Stats chips | Contadores de pedidos por status |
| Tabs | Filtro por status |
| Order cards | Accordion expansível com dados do cliente |
| Modal entregador | Seleção de entregador para status "Em Rota" |
| Toast | Feedback de ações |
| Áudio | `somNovoPedido` (archive.org) |
| Comunicação | `postMessage` para dashboard pai |

**Problemas Críticos:** `js/utils.js` carregado **duas vezes** (linhas 651 e 694). `escapeHtml()` dependência única contra XSS em renderização de dados do cliente. Áudio de fonte externa não controlada.

---

### 3.3 `balcao.html` — PDV (1294 linhas)

**Propósito:** Lançar pedidos presenciais com grid de produtos + checkout lateral.

**Fluxo:** `fetch('/api/produtos')` → render grid → carrinho → `pagar()` (bug: função não definida).

| Elemento | Descrição |
|---|---|
| Grid produtos | Filtro por categoria (6 tipos) |
| Checkout lateral | Carrinho com controle de quantidade |
| Modal sabores | Seleção de sabores para pacotes |
| Modal avulso | Produto ID 209 (salgadinhos avulsos) |
| Forma pagamento | Dinheiro, Pix, Débito (+2%), Crédito (+6%) |
| Delivery | Campos de endereço condicionais |

**Problemas Críticos:** **HTML malformado** — `<script src="js/theme.js">` dentro de `<style>` na linha 12. **Função `pagar()` não definida** — o botão "Finalizar Venda" chama `onclick="pagar()"` mas a função não existe no escopo. Inconsistência de token: usa `localStorage.getItem('authToken')` vs `authUser.token` em outras páginas.

---

### 3.4 `caixa.html` — Controle de Caixa (347 linhas)

**Propósito:** Abertura/fechamento de caixa, totais por pagamento, gráfico doughnut, relatório impresso.

| Elemento | Descrição |
|---|---|
| Abertura | Valor inicial (troco) |
| Resumo | Grid: Dinheiro, Pix, Débito, Crédito |
| Gráfico | Chart.js doughnut |
| Histórico | Lista de fechamentos anteriores |

**Problemas:** Chart.js não destrói canvas anterior em `gerarGrafico()` (cria múltiplos charts). Relatório impresso via `window.open + document.write` (prática obsoleta). Código morto: `imprimirRelatorioAntigo()` definida mas nunca chamada.

---

### 3.5 `dashboard.html` — Shell Principal (680 linhas)

**Propósito:** SPA simples: sidebar + iframe carregando páginas internas.

| Elemento | Descrição |
|---|---|
| Sidebar | Navegação hierárquica com badge de pedidos |
| Topbar | Título + nome usuário + logout |
| Iframe | `<iframe id="mainFrame">` carrega admin.html |
| Notificações | Pedido novo, estoque baixo |
| Superadmin | Menu condicional por role |

**Problema Crítico (BACKDOOR):** `dashboard.html?superadmin=true` → qualquer usuário autenticado que acesse esta URL tem seu role sobrescrito para `'superadmin'` e username para `'djesus'` no localStorage (linhas 593-595). Navegação via iframe sem confirmação de dirty state.

---

### 3.6 `entregador.html` — Gestão de Entregadores (548 linhas)

**Propósito:** CRUD de entregadores + mapa com rastreamento GPS + WebSocket.

| Elemento | Descrição |
|---|---|
| Sidebar | Cadastro/edição + lista ativos + resumo dia |
| Mapa | Mapbox GL JS com marcadores e rota |
| WebSocket | `wss://costasalgados-1.onrender.com` |
| Corrida | Iniciar/Finalizar com geolocalização |

**Problemas:** Mapbox token exposto em variável global. WebSocket sem autenticação — conexão via query param `entregadorId` previsível. Geolocalização `watchPosition` sem opção de pausa (alto consumo de bateria). Interpolação de dados (nomes, whatsapp, pix) sem escaping adequado.

---

### 3.7 `login.html` — Login Administrativo (294 linhas)

**Propósito:** Autenticação + cadastro de lojas.

**Fluxo:** `POST /api/auth/login` → token no localStorage → redirect `dashboard.html`.

| Elemento | Descrição |
|---|---|
| Tabs | Entrar / Cadastrar |
| Feedback | Shake animation em erro |

**Problemas:** Sem rate-limit visível no frontend. Redirecionamento automático sem verificar expiração do token. Senha em texto plano no corpo da requisição (depende de HTTPS). Comentário na linha 172 expõe que superadmin é validado via Firestore (possível inconsistência com API).

---

### 3.8 `painelLoja.html` — Painel de Configuração (469 linhas)

**Propósito:** Gestão de horários, produtos (CRUD), categorias, configurações da loja, personalização visual.

| Aba | Função |
|---|---|
| Horários | Dias/horários de funcionamento |
| Produtos | CRUD com imagem, estoque, status |
| Categorias | CRUD |
| Config. Loja | Nome, endereço, WhatsApp, logo, coordenadas |
| Personalizar | Color pickers, modo escuro, preview |

**Problemas:** Font Awesome carregado fora do `<head>` (linha 466 no final do body). ID de produto definido manualmente (risco de colisão). Coordenadas geográficas sem validação de formato. CSS de tema escuro hardcoded no inline (linhas 14-19) — inconsistência com `theme.js`.

---

### 3.9 `relatorios.html` — Relatórios (313 linhas)

**Propósito:** Resumo do dia + relatório por período customizado com gráficos Chart.js.

| Aba | Função |
|---|---|
| Resumo do Dia | Tabela + gráfico de barras diário |
| Por Período | Filtro de data + cards de pedidos + gráfico |

**Problemas:** Dados de clientes (nome + WhatsApp) expostos na tabela de período. Polling 30s sem cleanup ao navegar via iframe. Sem validação de intervalo de datas (mín/máx).

---

### 3.10 `superadmin.html` — Super Admin (285 linhas)

**Propósito:** Gestão de usuários administrativos e empresas (multi-tenant).

| Aba | Função |
|---|---|
| Usuários | CRUD de usuários por empresa |
| Gerenciar Senhas | Alterar senha de qualquer usuário |
| Empresas | Listar + criar com usuário admin |

**Problema Crítico:** **Autenticação via `btoa(JSON.stringify(...))`** (linha 263) — isso codifica o objeto `authUser` inteiro como base64, não é um JWT real. bcryptjs carregado no CDN mas nunca usado nesta página (redundante, operações de senha vão via API).

---

### 3.11 `whatsapp.html` — Integração WhatsApp (301 linhas)

**Propósito:** Gerenciar instância WhatsApp via Evolution API.

| Elemento | Descrição |
|---|---|
| Info box | Instruções contextuais |
| Instance card | ID, telefone, status, ações |
| QR Code | Código numérico de pareamento |

**Problemas:** Código de pareamento exibido em texto plano na UI. Mensagens de erro da API injetadas diretamente no DOM via `innerHTML`. Polling 15s sem cleanup.

---

### 3.12 `alterar-senha.html` — Alterar Senha (133 linhas)

**Propósito:** Usuário admin alterar própria senha.

**Problemas:** Acesso direto ao Firestore (`db.collection('usuarios')`) pelo frontend — esta página **não usa** a API REST. bcrypt no client-side. Qualquer um com acesso ao console pode manipular a coleção se as regras do Firestore forem permissivas.

---

### 3.13 `view/cart.html` — Carrinho (186 linhas)

**Propósito:** Checkout final com itens do carrinho, dados de entrega, pagamento, cupom.

**Fluxo:** `cart.js` → `apiHelper.js` → `POST /api/public/pedidos`

| Elemento | Descrição |
|---|---|
| Itens | Renderizados do localStorage `cart` |
| Entrega | Retirada vs Delivery com campos condicionais |
| Pagamento | Dinheiro, Débito, Crédito, Pix |
| Cupom | Input + botão |
| Resumo | Subtotal, entrega, taxa cartão, desconto, total |

**Problemas:** Cálculo de taxas e totais no frontend (manipulável). Dados pessoais coletados sem política de privacidade visível. Validação de formulário inteiramente em `cart.js` (não visível no HTML). Cache busting com versão fixa (`?=17`).

---

## 4. Análise dos Scripts JavaScript

### 4.1 Resumo dos 13 Arquivos JS

| Arquivo | Linhas | Tipo | Firebase | localStorage |
|---|---|---|---|---|
| `apiHelper.js` | 81 | IIFE | NÃO | `clientToken` |
| `cart.js` | 884 | IIFE | NÃO | `cart`, `userLogged`, `clientToken` |
| `menu.js` | 615 | IIFE | NÃO (linha morta) | `cart`, `userLogged`, `clientToken` |
| `navbar.js` | 11 | Função | NÃO | — |
| `painel.js` | 680 | IIFE | NÃO | `authUser` |
| `theme.js` | 120 | IIFE | NÃO | `themeCache`, `authUser` |
| `utils.js` | 111 | IIFE | NÃO | `authUser` |
| `core/api.js` | 30 | ES module | NÃO | `authToken` |
| `core/auth.js` | 42 | ES module | NÃO | `authUser` |
| `caixaService.js` | 17 | ES module | NÃO | — |
| `entregadorService.js` | 16 | ES module | NÃO | — |
| `orderService.js` | 17 | ES module | NÃO | — |
| `productService.js` | 19 | ES module | NÃO | — |

### 4.2 Grau de Coesão e Duplicação

**Duplicação detectada:**
- A função `api()` é definida inline em **4 páginas** (admin.html, caixa.html, superadmin.html) com código idêntico
- `js/utils.js` carregado duas vezes em admin.html
- `core/api.js` e a função inline `api()` são funcionalmente redundantes
- `alterar-senha.html` usa Firestore diretamente enquanto todo o resto usa API REST

**Maturidade da arquitetura JS:**
- **Público:** Bem estruturado — `apiHelper.js` como camada única de API, `menu.js` e `cart.js` como controllers
- **Admin interno:** Em transição — `core/api.js` + `services/*` (ES modules) representam o novo padrão, mas as páginas HTML ainda usam scripts inline com `utils.js`
- **Gap:** Os `services/*` (ES modules) não são importados por nenhuma página HTML atual — estão prontos mas não integrados

### 4.3 Uso de localStorage (7 chaves)

| Chave | Usado por | Tipo de dado | Risco |
|---|---|---|---|
| `clientToken` | apiHelper, cart, menu | JWT de cliente | XSS — token de sessão |
| `userLogged` | cart, menu | Dados pessoais do cliente | Exposição de PII |
| `cart` | cart, menu | Array de itens | Manipulável |
| `authUser` | painel, utils, theme, auth | Token + dados admin | XSS — acesso admin |
| `authToken` | api.js | Token admin alternativo | Duplicação com authUser |
| `themeCache` | theme.js | Tema + timestamp | Baixo risco |
| `userPhone` | cart.js | Telefone | PII em plain text |

---

## 5. Análise do CSS

### 5.1 Visão Geral das 4 Folhas de Estilo

| Arquivo | Linhas | Variáveis CSS | Responsivo | `!important` |
|---|---|---|---|---|
| `style.css` | 911 | 17 custom properties | SIM (4 breakpoints) | 1 (`.hidden`) |
| `cart.css` | 634 | NENHUMA | SIM (4 breakpoints) | 2 |
| `login.css` | 70 | NENHUMA | MÍNIMO | 0 |
| `painelstyle.css` | 300 | 9 custom properties | SIM (3 breakpoints) | 2 |

### 5.2 Problemas Identificados

1. **Inconsistência de variáveis CSS:**
   - `style.css` define 17 variáveis (escala completa: cores, spacing, radius, shadow)
   - `painelstyle.css` define 9 variáveis (nomes diferentes: `--brand` vs `--primary`)
   - `cart.css` e `login.css` usam apenas cores hardcoded
   - `theme.js` injeta variáveis no `:root` que não correspondem 1:1 com as definidas nos CSS

2. **CSS inline massivo:**
   - admin.html: ~600 linhas inline
   - balcao.html: ~580 linhas inline
   - dashboard.html: ~370 linhas inline
   - caixa.html, entregador.html, relatorios.html: ~110-120 linhas cada
   - **Total estimado de CSS inline:** ~2.500 linhas distribuídas em 12 arquivos HTML
   - Isso torna a manutenção de estilo extremamente difícil

3. **Font Awesome carregado inconsistentemente:**
   - Na maioria das páginas dentro do `<head>`
   - Em `painelLoja.html` na linha 466 (final do body) — pode causar FOUC (flash of unstyled icons)

4. **Ausência de design system unificado:**
   - Cada página tem seu próprio tema de cores, espaçamentos, bordas
   - Não há tokens de design compartilhados entre as 4 folhas CSS

5. **Breakpoints responsivos inconsistentes:**
   - `style.css`: 480px, 640px, 768px, 1024px
   - `cart.css`: 767px, 768px, 1024px, 1025px
   - `painelstyle.css`: 600px, 900px, 1200px
   - Múltiplas convenções de breakpoint dificultam consistência

---

## 6. Análise de Segurança

### 6.1 Vulnerabilidades CRÍTICAS (risco imediato de comprometimento)

| # | Vulnerabilidade | Localização | Impacto |
|---|---|---|---|
| **C1** | **`.env` versionado no Git** | `backend/.env` | Todas as credenciais expostas: PostgreSQL URL, Evolution API key, Mapbox token, Geoapify key, JWT secret, GraphHopper key |
| **C2** | **Backdoor superadmin via query string** | `dashboard.html:593-595` | Qualquer usuário autenticado que acesse `?superadmin=true` ganha role superadmin + username `djesus` |
| **C3** | **Token admin via base64url sem assinatura** | `backend/src/services/authService.js` | Token forjável — `Buffer.from(JSON.stringify({...})).toString('base64url')` sem HMAC |
| **C4** | **Senha superadmin hardcoded no frontend** | `login.html:175-177` | `djesus / tsa110594` visível no source de qualquer pessoa |
| **C5** | **bcrypt no client-side** | `alterar-senha.html` | Hash de senha comparado no browser; Firestore `usuarios` acessível se regras permissivas |
| **C6** | **CORS fallback para wildcard `*`** | `backend/src/config/env.js` | Se `CORS_ORIGIN` não definida, qualquer origem acessa a API |

### 6.2 Vulnerabilidades ALTAS

| # | Vulnerabilidade | Localização | Impacto |
|---|---|---|---|
| **A1** | **JWT em localStorage** | Todas páginas admin | Suscetível a XSS — token copiável por script malicioso |
| **A2** | **Ausência de CSP (Content Security Policy)** | Todas páginas | Sem proteção contra XSS, inline scripts sem restrição |
| **A3** | **CDNs sem `integrity` hash** | Todas páginas | Font Awesome, Chart.js, bcryptjs, Google Fonts — supply chain attack possível |
| **A4** | **Senha em texto plano no corpo HTTP** | `login.html`, `superadmin.html` | Senha viaja sem hash client-side (depende de HTTPS) |

### 6.3 Vulnerabilidades MÉDIAS

| # | Vulnerabilidade | Localização |
|---|---|---|
| **M1** | **Interpolação de dados sem escaping robusto** | admin.html, entregador.html, whatsapp.html |
| **M2** | **Polling sem cleanup ao navegar via iframe** | admin.html (10s), relatorios.html (30s), whatsapp.html (15s) |
| **M3** | **Chaves API expostas no frontend** | cart.js:709 (Geoapify), entregador.html:199-201 (Mapbox) |
| **M4** | **Dados de clientes expostos na UI** | admin.html (endereço completo), relatorios.html (nome+WhatsApp), whatsapp.html (telefone, código pareamento) |
| **M5** | **Falta de proteção contra duplo clique** | balcao.html, entregador.html, view/cart.html |
| **M6** | **Tratamento de erro silencioso** (catch vazio) | caixa.html:293, entregador.html:253/302/514, dashboard.html:672 |

### 6.4 Pontos Fortes de Segurança

- **Helmet** aplicado globalmente no backend (`helmet@8.0.0`)
- **Rate limiting** em `/api` (60 req/min) e auth (10 req/15min)
- **Multi-tenant** via `empresaId` — isolamento de dados entre lojas
- **Multer** com `fileFilter` (apenas imagens) e `limits.fileSize = 5MB`
- **Repository pattern** abstrai queries SQL — reduz risco de SQL injection
- **`escapeHtml()`** implementado em `utils.js` (embora aplicado inconsistentemente)

---

## 7. Análise do Backend

### 7.1 Arquitetura

```
server.js
  └─ carrega src/app.js
       ├─ helmet() + cors() + express.json()
       ├─ apiLimiter (60/min em /api)
       ├─ authLimiter (10/15min em login/register)
       ├─ 15 grupos de rotas (/api/*)
       └─ errorHandler (global)
```

**15 grupos de rotas:**

| Prefixo | Rotas | Auth | Função |
|---|---|---|---|
| `/api/auth` | authRoutes | rate-limit | Login, registro, change-password |
| `/api/produtos` | productRoutes | auth + role | CRUD produtos |
| `/api/pedidos` | orderRoutes | auth (POST público) | CRUD pedidos + status |
| `/api/entregadores` | driverRoutes | auth + role | CRUD entregadores |
| `/api/caixa` | cashierRoutes | auth | Abrir/fechar/relatórios |
| `/api/horarios` | scheduleRoutes | auth + role | GET/PUT horários |
| `/api/proxy` | proxyRoutes | público | Proxy Mapbox/GraphHopper/Geoapify |
| `/api/admin` | adminRoutes | auth + superadmin | Listar/criar empresas |
| `/api/categorias` | categoriaRoutes | auth + role | CRUD categorias |
| `/api/whatsapp` | whatsappRoutes | auth + role | Evolution API proxy |
| `/api/loja` | lojaRoutes | público/admin | Settings, status |
| `/api/upload` | uploadRoutes | público (multer) | Upload imagens |
| `/api/public` | publicRoutes | JWT cliente (opcional) | Cardápio, pedidos, clientes |
| `/api/usuarios` | userRoutes | auth + superadmin | CRUD usuários |
| `/api/entregas` | entregaRoutes | auth | Registro de entregas |

### 7.2 Sistema de Autenticação (Duplo)

| Sistema | Alvo | Método | Biblioteca | Expiracao |
|---|---|---|---|---|
| **Token admin** | Usuários internos | base64url (JSON payload) | Nenhuma (Buffer nativo) | Sem expiração |
| **JWT cliente** | Clientes públicos | HMAC-SHA256 | `jsonwebtoken` | 7 dias |

**Problema do token admin:** Não há assinatura criptográfica, não há expiração, não há revogação. A segurança depende exclusivamente do segredo do payload. Qualquer um que conheça a estrutura `{id, username, role, empresaId, lojaNome}` pode forjar tokens.

### 7.3 Database Schema (13 modelos Prisma)

```
Empresa (empresas)
  ├─ 1:N → Usuario (usuarios)
  ├─ 1:N → Produto (produtos)
  ├─ 1:N → Pedido (pedidos)
  │          └─ 1:N → ItensPedido (itens_pedido)
  ├─ 1:N → Entregador (entregadores)
  ├─ 1:N → EntregaDiaria (entregas_diarias)
  ├─ 1:N → CaixaDiario (caixa_diario)
  ├─ 1:N → Horario (horarios)
  ├─ 1:N → Cliente (clientes)
  ├─ 1:N → Cupom (cupons)
  ├─ 1:N → WhatsAppInstance (whatsapp_instances)
  └─ 1:N → Counter (counters)
```

**Unique constraints críticos:**
- `Usuario`: `[empresaId, username]`
- `Cliente`: `[empresaId, telefone]`
- `Empresa`: `slug` (único global)

### 7.4 `JWT_SECRET` — Fallback Inseguro

```js
// backend/src/config/env.js
jwtSecret: process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod'
```

Se `JWT_SECRET` não estiver definida no ambiente, qualquer pessoa pode forjar tokens JWT de cliente com a string hardcoded.

---

## 8. Análise de Layout e UX

### 8.1 Consistência Visual entre Páginas

| Aspecto | Status |
|---|---|
| Fonte tipográfica | Consistente: "Plus Jakarta Sans" em todas as páginas |
| Ícones | Consistente: Font Awesome 6.5.1 em todas as páginas admin |
| Cores | **INCONSISTENTE** — cada página define seu próprio CSS inline com paletas diferentes |
| Cards | Padrão similar em admin.html e balcao.html, mas implementações independentes |
| Modals | Cada página implementa seu próprio modal (sem componente reutilizável) |
| Toast | Consistente via `utils.js:toast()` |
| Tabs | Estilo similar em painelLoja, relatorios, superadmin |

### 8.2 Responsividade

| Página | Mobile | Tablet | Desktop | Problema |
|---|---|---|---|---|
| index.html | SIM | SIM | SIM | — |
| view/cart.html | SIM | SIM | SIM | — |
| admin.html | PARCIAL | SIM | SIM | Cards muito largos em mobile |
| dashboard.html | SIM (toggle) | SIM | SIM | Sidebar overlay em mobile |
| painelLoja.html | SIM | SIM | SIM | Tabelas com scroll horizontal |
| Outras admin | PARCIAL | SIM | SIM | Inline CSS sem media queries completas |

### 8.3 Sistema de Theming

O `theme.js` implementa tematização multi-loja:
1. Busca tema do backend (`/api/loja/settings`)
2. Injeta ~15 CSS custom properties no `:root`
3. Fallback para cache localStorage (TTL 5 min)
4. `painelLoja.html` tem editor visual (color pickers + preview)

**Problema:** Apenas `style.css` e `painelstyle.css` consomem as variáveis do `:root`. `cart.css`, `login.css` e os ~2.500 linhas de CSS inline usam cores hardcoded — o tema não se aplica a eles.

### 8.4 UX — Problemas de Usabilidade

1. **Navegação via iframe** (dashboard): sem histórico do browser, sem deep linking, estado perdido ao trocar de página
2. **Sem breadcrumbs** em nenhuma página admin
3. **Feedback de carregamento inconsistente**: admin.html tem skeleton loader, outras páginas não
4. **Sem teclas de atalho**
5. **Formulários sem validação inline** (apenas no submit)
6. **Modal de confirmação** só existe em algumas ações (via `confirmModal()`)
7. **Impressão térmica** não otimizada (usa `window.print()` genérico)

---

## 9. Análise de Testes e Qualidade

### 9.1 Cobertura Atual: MUITO FRACA

| Arquivo de Teste | Testes | Cobre |
|---|---|---|
| `tests/utils.test.js` | 8 | escapeHtml (3), fmtMoeda (3), debounce (2) |
| `tests/backend.test.js` | 6 | Logger (1), auth middleware (3), errorHandler (2) |
| `backend/tests/` | 0 | **VAZIO** |
| **Total** | **14** | Apenas utilitários e middleware |

### 9.2 Lacunas Críticas de Teste

| Área não testada | Risco |
|---|---|
| Fluxo completo de pedido (carrinho → API → persistência) | Bug de valores financeiros passou despercebido |
| Controller de pedidos (orderController, publicController) | Regressões não detectadas |
| Services (orderService, whatsappService, lojaService) | Falhas silenciosas |
| Repository SQL (sqlRepository) | Queries quebradas em migração |
| Auth (login, JWT, token admin, RBAC) | Backdoor superadmin existente |
| Cálculo de taxas (entrega, cartão, cupom) | Valores incorretos |
| WhatsApp Integration | Falhas de conexão |
| E2E (Playwright/Cypress) | Zero — fluxo completo nunca testado |

### 9.3 Qualidade de Código

| Métrica | Status |
|---|---|
| Linting | ESLint listado no package.json mas **não instalado** como devDep |
| Formatação | Sem Prettier configurado |
| TypeScript | Não usado (100% JavaScript vanilla) |
| Comentários | Praticamente inexistentes no código |
| Consistência de estilo | Baixa — mistura de ES modules, IIFE, scripts inline |
| Tratamento de erros | Inconsistente — try/catch às vezes vazio, às vezes com toast |

---

## 10. Configurações de Deploy e Build

### 10.1 Vite (`vite.config.js`)

- **Build multi-page:** 14 entradas HTML → `dist/`
- **Dev server:** porta 5173, proxy `/api` → `localhost:3000`
- **Problema:** Sem code splitting explícito — todos os JS carregam em cada página

### 10.2 Vercel (`vercel.json`)

- **Backend:** `backend/api.js` como função serverless (`@vercel/node`)
- **Frontend:** Arquivos estáticos via `@vercel/static`
- **Clean URLs:** `/pagina` → `/pagina.html`
- **Problema:** Apenas 1 arquivo de backend serverless — `api.js` precisa encapsular todo o Express app com 15 rotas

### 10.3 start-servers.bat

- **Caminhos absolutos hardcoded** para máquina específica: não portável
- Referencia diretório `Fabrica de salgados costa - Pronta - Copy` que não corresponde ao diretório atual (`sic-ia - Copy`)

### 10.4 README.md — Desatualizado

- Menciona Firebase Firestore como banco principal (realidade: PostgreSQL/NEON)
- Não menciona Prisma, multi-tenant, Vite, Vercel, Evolution API
- Setup desatualizado (não tem `npm start` no backend)
- Estrutura de diretórios incompleta

---

## 11. Resumo Executivo — Ações Prioritárias

### 🔴 CRÍTICO — Imediato

| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 1 | Remover `backend/.env` do Git (`git rm --cached`) e rotacionar todas as credenciais | 1h | Impede vazamento de credenciais |
| 2 | Substituir token admin base64 por JWT com assinatura HMAC e expiração | 4h | Fecha porta de forja de tokens |
| 3 | Remover backdoor `?superadmin=true` do dashboard.html:593-595 e ler senha da variavel de ambiente da vercel SUPERADMIN_PASSWORD | 30min | Fecha escalação de privilégio |
| 4 | Remover senha hardcoded do login.html:175-177 | 5min | Remove credencial exposta |
| 5 | Corrigir HTML malformado em balcao.html:12 (`<script>` dentro de `<style>`) | 5min | Evita erro de parsing |
| 6 | Implementar função `pagar()` faltante em balcao.html | 2h | PDV volta a funcionar |
| 7 | Substituir Firestore por API REST em alterar-senha.html | 2h | Remove acesso direto ao DB pelo frontend |
| 8 | Adicionar `integrity` hash em todos os CDNs | 30min | Previne supply chain attack |
| 9 | Configurar CSP headers | 1h | Mitiga XSS |

### 🟡 ALTO — Curto Prazo

| # | Ação | Esforço |
|---|---|---|
| 10 | Unificar função `api()` — usar `core/api.js` em vez de inline duplicado | 3h |
| 11 | Migrar tokens de localStorage para httpOnly cookies (requer backend) | 4h |
| 12 | Extrair CSS inline para folhas dedicadas por página | 8h |
| 13 | Implementar `confirmModal()` em todas as ações destrutivas | 2h |
| 14 | Adicionar proteção contra duplo clique em todos os botões de submit | 1h |
| 15 | Corrigir `start-servers.bat` com caminhos relativos | 10min |
| 16 | Substituir `window.print()` por impressão térmica otimizada | 3h |

### 🟢 MÉDIO — Médio Prazo

| # | Ação | Esforço |
|---|---|---|
| 17 | Integrar `js/services/*` (ES modules) nas páginas HTML | 4h |
| 18 | Criar testes de integração para fluxo de pedido | 6h |
| 19 | Criar testes para controllers e services do backend | 8h |
| 20 | Unificar breakpoints responsivos entre todas as folhas CSS | 2h |
| 21 | Unificar variáveis CSS entre `style.css` e `painelstyle.css` | 3h |
| 22 | Adicionar validação de schema (Joi/Zod) no backend | 4h |
| 23 | Substituir navegação por iframe por SPA real (ou multi-page) | 16h |
| 24 | Adicionar ESLint + Prettier config e executar formatação | 2h |
| 25 | Atualizar README.md com stack real e instruções corretas | 1h |

### 🔵 BAIXO — Longo Prazo

| # | Ação | Esforço |
|---|---|---|
| 26 | Migrar para TypeScript | 40h+ |
| 27 | Implementar sistema de design tokens unificado | 20h |
| 28 | Adicionar documentação OpenAPI/Swagger | 8h |
| 29 | Implementar E2E tests com Playwright | 16h |
| 30 | CI/CD pipeline (GitHub Actions) | 8h |
| 31 | Substituir polling por WebSocket/SSE | 12h |
| 32 | PWA completo com cache offline e push notifications | 20h |

---

## Apêndice: Documentação Existente em docs/

| Documento | Conteúdo |
|---|---|
| `analise_seguranca.md` | Auditoria de segurança com 4 níveis de severidade |
| `analise-3.md` | Análise completa com plano de ação em 6 tracks (1099 linhas) |
| `analyser_2.md` | 33 problemas catalogados + plano de evolução em 4 fases |
| `arquitetura.md` | Fluxo do sistema + problemas estruturais |
| `change-designer.md` | Especificação de redesign visual (aguardando aprovação) |
| `debug-cadastro.md` | 6 conflitos no fluxo de cadastro de cliente |
| `debug-log.md` | 9 bugs no fluxo de criação de pedido |
| `erro-log.md` | Diagnóstico do erro WhatsApp 404/401 |
| `front-end-upgrade.md` | Especificação de redesign do index.html (aguardando aprovação) |
| `melhorias.md` | 12 melhorias priorizadas com estimativas de esforço |