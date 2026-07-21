# Auditoria de Responsividade v2.0 — SIC.ia

> **Data:** 21/07/2026
> **Projeto:** SIC.ia — Sistema de Cardápio Online e Gerenciamento
> **Branch:** `feature/hierarquia-usuarios`
> **Analista:** opencode (Full Stack Staff Engineer)
> **Critério:** WCAG 2.1 AA, Core Web Vitals, cobertura 320px–4K

---

## 1. Inventário Completo

### 1.1 Páginas HTML (13 páginas)

| # | Arquivo | Linhas | Função | Criticidade | CSS Principal | CSS Inline |
|---|---------|--------|--------|-------------|---------------|------------|
| 1 | `index.html` | 203 | Cardápio público | **Crítico** | `css/style.css` | — |
| 2 | `view/cart.html` | ~250 | Carrinho de compras | **Crítico** | `css/cart.css` | ~50 linhas |
| 3 | `login.html` | 269 | Login admin | **Crítico** | — | ~100 linhas |
| 4 | `admin.html` | 1218 | Painel pedidos (cozinha) | **Crítico** | — | ~500 linhas |
| 5 | `dashboard.html` | 687 | Dashboard admin | **Alto** | — | ~400 linhas |
| 6 | `balcao.html` | 646 | PDV Balcão | **Alto** | `css/balcao.css` | ~100 linhas |
| 7 | `painelLoja.html` | 485 | Configurações loja | **Alto** | `css/painelstyle.css` | ~200 linhas |
| 8 | `caixa.html` | 360 | Caixa | **Alto** | — | ~200 linhas |
| 9 | `relatorios.html` | 319 | Relatórios | **Médio** | — | ~150 linhas |
| 10 | `superadmin.html` | 260 | Super Admin | **Médio** | — | ~75 linhas |
| 11 | `entregador.html` | 301 | Painel entregador | **Médio** | — | ~150 linhas |
| 12 | `whatsapp.html` | ~394 | WhatsApp integration | **Médio** | — | ~200 linhas |
| 13 | `alterar-senha.html` | 133 | Alterar senha | **Baixo** | — | ~50 linhas |

### 1.2 CSS Fonte (7 arquivos)

| Arquivo | Linhas | Breakpoints | Uso de Variáveis |
|---------|--------|-------------|------------------|
| `css/style.css` | 1621 | 320, 412, 480, 640, 768, 1024 | ✅ `:root` + theme.js |
| `css/painelstyle.css` | 300 | 600, 900, 1200 | ✅ `:root` |
| `css/balcao.css` | 832 | 480, 768, 1024 | ✅ Fallback manual |
| `css/cart.css` | 775 | 767, 768, 1024, 1025 | ❌ Hardcoded |
| `css/login.css` | 70 | 480 | ❌ Legacy/morto |
| `css/cart.scss` | — | — | Fonte SCSS |

### 1.3 JavaScript Frontend (13 arquivos)

| Arquivo | Linhas | Impacto no Layout |
|---------|--------|-------------------|
| `js/theme.js` | 112 | Injeta 14+ CSS vars em `:root` |
| `js/menu.js` | 857 | Renderiza cards, categorias, search |
| `js/cart.js` | 829 | Carrinho, modais, formulários |
| `js/navbar.js` | 11 | Toggle menu mobile |
| `js/painel.js` | 824 | CRUD produtos, tema editor |
| `js/utils.js` | 116 | Toast, modal, authGuard |
| `js/apiHelper.js` | 77 | Fetch wrapper público |
| `js/core/api.js` | 31 | Fetch wrapper admin |
| `js/core/auth.js` | 42 | Token management |
| `js/services/*.js` | ~17 cada | API services |

---

## 2. Análise de Viewport

### 2.1 Meta Viewport

Todas as 13 páginas usam:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**Problemas:**
| # | Problema | Gravidade | Páginas Afetadas |
|---|----------|-----------|------------------|
| V1 | Ausência de `viewport-fit=cover` | **Alta** | Todas (13) |
| V2 | Ausência de `interactive-widget=resizes-visual` | **Média** | Todas (13) |
| V3 | Nenhum uso de `dvh`/`svh`/`lvh` — apenas `vh` | **Média** | Todas |
| V4 | Nenhum padding usa `env(safe-area-inset-*)` | **Alta** | index, cart, admin, balcao |

### 2.2 Simulação de Viewport

| Dispositivo | Viewport | Problemas Esperados |
|-------------|----------|---------------------|
| iPhone SE | 375×667 | Bottom nav e order bar com sobreposição |
| iPhone 15 Pro Max | 430×932 | Conteúdo atrás da Dynamic Island |
| Galaxy Fold (externa) | 360×512 | Botões muito pequenos, dropdown cortado |
| iPad Mini | 768×1024 | Tabs empilhadas desnecessariamente |
| iPad Pro 13" | 1024×1366 | Dashboard com espaço desperdiçado |
| Desktop 1920×1080 | 1920×1080 | Layout funcional |
| Desktop 4K | 3840×2160 | Fontes podem ficar pequenas |

---

## 3. Análise de Breakpoints

### 3.1 Breakpoints Existentes

| Breakpoint | style.css | cart.css | painelstyle.css | balcao.css | Inline (admin) |
|------------|-----------|----------|-----------------|------------|----------------|
| 320px | ✅ | — | — | — | — |
| 321–412px | ✅ | — | — | — | — |
| 413–767px | ✅ | — | — | — | — |
| 480px | ✅ | — | — | ✅ | — |
| 600px | — | — | ✅ | — | — |
| 640px | ✅ | — | — | — | — |
| 767px | — | ✅ | — | — | — |
| 768px | ✅ | ✅ | — | ✅ | ✅ |
| 900px | — | — | ✅ | — | — |
| 1024px | ✅ | ✅ | — | ✅ | — |
| 1025px | — | ✅ | — | — | — |
| 1200px | — | — | ✅ | — | — |

**Problemas:**
| # | Problema | Gravidade |
|---|----------|-----------|
| B1 | 3 sistemas de breakpoints inconsistentes | **Alta** |
| B2 | Gap entre 768px–1024px sem cobertura em style.css | **Média** |
| B3 | cart.css não trata 768px–1024px (só 767px e 1024px) | **Média** |
| B4 | admin.html só tem 1 media query (768px) | **Alta** |

---

## 4. Problemas por Página

### 4.1 `index.html` — Cardápio Público (Crítico)

| # | Problema | Local | Gravidade | Dispositivos | Como Reproduzir |
|---|----------|-------|-----------|--------------|-----------------|
| I1 | **z-index caótico**: 7+ elementos com `z-index: 9999` | style.css:121,859,925,944 | **Alta** | Todos | Abrir userDropdown + ordersOverlay simultaneamente |
| I2 | `#statusBar` fixed sem `env(safe-area-inset-top)` | style.css:112 | **Média** | iPhone com Dynamic Island | Verificar se status bar fica atrás da ilha |
| I3 | `#bottomNav` fixed sem `env(safe-area-inset-bottom)` | style.css:849 | **Alta** | iPhone X–16, Pixel Fold | Navegar até o final da página |
| I4 | `#orderBar` fixed `bottom: 64px` sem safe area | style.css:805 | **Alta** | iPhones com home indicator | Adicionar item ao carrinho |
| I5 | Botões `.btn-add`, `.btn-plus`, `.btn-minus` reduzem para `40px` em 480px | style.css:1149 | **Média** | Android < 480px | Verificar touch target |
| I6 | `#userDropdown` com `width: 240px` fixo | style.css:939 | **Baixa** | Galaxy Fold (externa 360px) | Abrir dropdown |
| I7 | `#orderBarTotal` com `background: rgba(255,255,255,0.2)` — contraste baixo | style.css:840 | **Média** | Todos | Verificar legibilidade |
| I8 | CardsMenu animação `fadeInUp` para no 10º filho | style.css:1175-1184 | **Baixa** | Todos | Carregar >10 produtos |
| I9 | `padding-bottom: calc(64px + 56px + var(--s-24))` não considera safe area | style.css:75 | **Alta** | iPhones | Scroll até o final |

### 4.2 `view/cart.html` — Carrinho (Crítico)

| # | Problema | Local | Gravidade | Dispositivos |
|---|----------|-------|-----------|--------------|
| C1 | `.items { width: 64% }` e `.total { width: 35% }` — entre 768–1024px pode não caber | cart.css:304,396 | **Média** | Tablets |
| C2 | `@media(max-width:1024px)` força `width: 100% !important` — conflita com 768px | cart.css:298-301 | **Média** | Tablets |
| C3 | `img { width: 120px }` fixo — reduz para 100px em 767px | cart.css:620-633 | **Baixa** | Mobile |
| C4 | Inputs sem `font-size: 16px` — iOS faz zoom automático | cart.css:548-556 | **Média** | iOS |
| C5 | `.overlay { z-index: 9999 }` — conflito com outros 9999 | cart.css:677 | **Alta** | Todos |
| C6 | `body { background: #FAFAFA }` hardcoded — não respeita theme.js | cart.css:12 | **Média** | Todos (dark mode) |
| C7 | `.counter button { padding: 4px 8px }` — touch target < 44px | cart.css:42-51 | **Média** | Mobile |

### 4.3 `login.html` — Login (Crítico)

| # | Problema | Local | Gravidade | Dispositivos |
|---|----------|-------|-----------|--------------|
| L1 | Apenas 1 media query em 480px — sem tablet/desktop | login.html:106 | **Alta** | Tablets, Desktop |
| L2 | `.container { max-width: 460px }` — não adapta para 320px | login.html:25 | **Média** | Galaxy Fold (externa) |
| L3 | `body { background: var(--secondary, #FFFAF8) }` — hardcoded fallback | login.html:19 | **Baixa** | Todos |
| L4 | `.brand .icon` com tamanho fixo (64px → 52px) — sem fluido | login.html:33 | **Baixa** | Tablets |

### 4.4 `admin.html` — Painel Pedidos (Crítico)

| # | Problema | Local | Gravidade | Dispositivos | Impacto |
|---|----------|-------|-----------|--------------|---------|
| A1 | **DARK MODE QUEBRA**: `.order-card.status-pendente { background: #FEF2F2 }` hardcoded — texto fica amarelo em fundo claro | admin.html:212 | **CRÍTICA** | Todos (dark mode) | Página inteira ilegível |
| A2 | `.badge-novo { background: #FEE2E2 }` hardcoded | admin.html:230 | **Crítica** | Todos (dark mode) | Badge ilegível |
| A3 | `.order-status.status-pendente { background: #FEE2E2 }` hardcoded | admin.html:320 | **Crítica** | Todos (dark mode) | Status ilegível |
| A4 | `.order-status.status-producao { background: #FEF3C7 }` hardcoded | admin.html:321 | **Alta** | Todos (dark mode) | Status ilegível |
| A5 | `.order-status.status-finalizado { background: #DCFCE7 }` hardcoded | admin.html:324 | **Alta** | Todos (dark mode) | Status ilegível |
| A6 | `.btn-producao:hover { background: #FEF3C7 }` hardcoded | admin.html:459 | **Alta** | Todos (dark mode) | Hover ilegível |
| A7 | `.btn-finalizar:hover { background: #DCFCE7 }` hardcoded | admin.html:468 | **Alta** | Todos (dark mode) | Hover ilegível |
| A8 | `.btn-delete:hover { background: #FEF2F2 }` hardcoded | admin.html:474 | **Alta** | Todos (dark mode) | Hover ilegível |
| A9 | Apenas 1 media query (768px) — sem tratamento para tablets | admin.html | **Média** | iPad Air (820px) | Layout não otimizado |
| A10 | `.toast-container { z-index: 9999 }` — conflito | admin.html:503 | **Alta** | Todos | Toast pode ficar atrás |
| A11 | `.modal-overlay { z-index: 10000 }` — conflito com orders-overlay do index | admin.html:545 | **Alta** | Todos | Modal pode não aparecer |
| A12 | `body { padding: var(--s-32) }` — muito espaçoso em mobile | admin.html:57 | **Média** | Mobile | Espaço desperdiçado |

### 4.5 `relatorios.html` — Relatórios (Médio)

| # | Problema | Local | Gravidade | Dispositivos |
|---|----------|-------|-----------|--------------|
| R1 | `body { background: #f1f5f9; color: #1e293b; }` hardcoded | relatorios.html:23-25 | **Alta** | Todos (dark mode) |
| R2 | `@media (max-width: 768px)` faz tabs virarem column — em 768px ainda cabem | relatorios.html:159-164 | **Média** | iPad portrait |
| R3 | Tabela sem wrapper `overflow-x: auto` | relatorios.html:70-88 | **Alta** | Mobile |
| R4 | `canvas { height: 100 }` fixo — não redimensiona | relatorios.html:189 | **Média** | Mobile |
| R5 | `.card { background: white; }` hardcoded | relatorios.html:63 | **Alta** | Todos (dark mode) |
| R6 | `.tab-btn { background: white; }` hardcoded | relatorios.html:47 | **Alta** | Todos (dark mode) |
| R7 | `h1 i { color: #f97316; }` hardcoded | relatorios.html:35 | **Média** | Todos |

### 4.6 `superadmin.html` — Super Admin (Médio)

| # | Problema | Local | Gravidade | Dispositivos |
|---|----------|-------|-----------|--------------|
| S1 | `body { background: #f1f5f9; color: #1e293b; }` hardcoded | superadmin.html:15-17 | **Alta** | Todos (dark mode) |
| S2 | `.card { background: white; }` hardcoded | superadmin.html:24 | **Alta** | Todos (dark mode) |
| S3 | Tabela `.user-table` sem `overflow-x: auto` | superadmin.html:41-44 | **Alta** | Mobile |
| S4 | Apenas 1 media query (768px) | superadmin.html:71-75 | **Média** | Tablets |
| S5 | `.toast-container { z-index: 9999 }` | superadmin.html:64 | **Alta** | Todos |
| S6 | `input, select { width: 100%; }` sem max-width | superadmin.html:46-50 | **Baixa** | Desktop |

### 4.7 `balcao.html` — PDV Balcão (Alto)

| # | Problema | Local | Gravidade | Dispositivos |
|---|----------|-------|-----------|--------------|
| B1 | `body { overflow: hidden }` + flex row — em < 600px quebra | balcao.css:20-26 | **Alta** | Mobile |
| B2 | `.checkout { min-width: 340px }` — impede < 340px | balcao.css:174 | **Alta** | Galaxy Fold (externa) |
| B3 | `@media(max-width:1024px)` column — entre 768–1024px min-width causa overflow | balcao.css:716-734 | **Média** | Tablets médios |
| B4 | `.grid-produtos { minmax(140px, 1fr) }` — 320px força 1 coluna | balcao.css:100-105 | **Baixa** | Mobile pequeno |
| B5 | `.controle-qtd button { width: 26px; height: 26px }` — touch target < 44px | balcao.css:276-290 | **Média** | Mobile |

### 4.8 `painelLoja.html` — Painel Loja (Alto)

| # | Problema | Local | Gravidade | Dispositivos |
|---|----------|-------|-----------|--------------|
| PL1 | `.card.half { grid-column: span 12 }` mesmo em ≥900px — deveria ser span 6 | painelstyle.css:67 | **Média** | Desktop |
| PL2 | `@media(max-width: 1200px) { .card.half { grid-column: span 12 !important } }` — redundante e incorreto | painelstyle.css:70 | **Média** | Tablets |
| PL3 | `.row { grid-template-columns: 160px 1fr 1fr }` — em 600px vira 1 coluna, labels ficam acima | painelstyle.css:123 | **Média** | Mobile |
| PL4 | `.btn { padding: 12px 16px; font-size: 16px }` — em mobile proporcionalmente grande | painelstyle.css:116 | **Baixa** | Mobile |
| PL5 | Tabela de produtos sem `max-height` com scroll | painelstyle.css | **Média** | Mobile |
| PL6 | `body { background: #f4f4f4 }` hardcoded no topo do arquivo | painelstyle.css:5 | **Média** | Todos (dark mode) |

### 4.9 `caixa.html` — Caixa (Alto)

| # | Problema | Gravidade | Dispositivos |
|---|----------|-----------|--------------|
| CA1 | Chart.js doughnut com `height="100"` fixo | **Média** | Mobile |
| CA2 | Formulário de abertura/fechamento sem validação visual | **Baixa** | Todos |
| CA3 | CSS inline sem media queries relevantes | **Média** | Mobile |

### 4.10 `entregador.html` — Entregador (Médio)

| # | Problema | Gravidade | Dispositivos |
|---|----------|-----------|--------------|
| E1 | Sidebar 320px fixa — não colapsa em mobile | **Alta** | Mobile |
| E2 | Mapa Mapbox com altura fixa | **Média** | Todos |
| E3 | CSS inline sem tratamento para < 768px | **Alta** | Mobile |

### 4.11 `whatsapp.html` — WhatsApp (Médio)

| # | Problema | Gravidade | Dispositivos |
|---|----------|-----------|--------------|
| W1 | QR code pode ficar grande demais em mobile | **Média** | Mobile |
| W2 | CSS inline com poucas media queries | **Média** | Tablets |

### 4.12 `alterar-senha.html` — Alterar Senha (Baixo)

| # | Problema | Gravidade | Dispositivos |
|---|----------|-----------|--------------|
| AS1 | Card centralizado, funciona bem | **Baixa** | — |

### 4.13 `dashboard.html` — Dashboard (Alto)

| # | Problema | Gravidade | Dispositivos |
|---|----------|-----------|--------------|
| D1 | Sidebar 260px fixa — não colapsa em mobile | **Alta** | Mobile |
| D2 | Cards de stats com widths fixas | **Média** | Tablets |
| D3 | CSS inline extenso (~400 linhas) sem mobile-first | **Alta** | Mobile |

---

## 5. Problemas Globais

### 5.1 CSS

| # | Problema | Gravidade | Impacto |
|---|----------|-----------|---------|
| G1 | **z-index caótico**: 7+ elementos com `z-index: 9999`, overlay com `10000`, orders-overlay com `10001` | **Crítica** | Empilhamento imprevisível |
| G2 | **Hardcoded colors** em admin.html, relatorios.html, superadmin.html — não respeitam theme.js | **Crítica** | Dark mode quebrado |
| G3 | **Ausência de `env(safe-area-inset-*)`** em qualquer elemento fixed | **Alta** | Conteúdo atrás de notch/home indicator |
| G4 | **3 sistemas de breakpoints** inconsistentes | **Alta** | Comportamento imprevisível |
| G5 | **~2500 linhas de CSS inline** espalhadas em 12 HTMLs | **Alta** | Manutenção difícil |
| G6 | **Nenhum uso de `dvh`/`svh`** — apenas `vh` fixo | **Média** | 100vh maior que viewport real em mobile |
| G7 | **Nenhum `prefers-reduced-motion`** | **Média** | Acessibilidade |
| G8 | **Nenhum `prefers-contrast: more`** | **Média** | Acessibilidade |
| G9 | **Touch targets < 44px** em Several breakpoints | **Alta** | WCAG 2.1 AA violado |
| G10 | **`login.css` é legacy** (70 linhas) — provavelmente não usado | **Baixa** | Código morto |
| G11 | **Diretórios CSS vazios** (`base/`, `components/`, `pages/`) — arquitetura planejada mas não implementada | **Baixa** | Confusão |
| G12 | **`font-size` não usa `clamp()`** na maioria dos lugares | **Média** | Títulos podem ficar grandes demais em mobile |

### 5.2 JavaScript

| # | Problema | Gravidade | Impacto |
|---|----------|-----------|---------|
| J1 | `theme.js` aplica `isDark: true` mas admin.html tem cores hardcoded | **Crítica** | Texto branco em fundo claro |
| J2 | Toast container `bottom: 24px; right: 24px` sem safe areas | **Média** | Toast atrás de home indicator |
| J3 | `navbar.js` usa `translateX(100%)` sem `transition` definida no CSS | **Média** | Transição abrupta |
| J4 | Overlay de pedidos com `align-items: flex-end` — em landscape pode ficar muito alto | **Baixa** | UX ruim em landscape |

### 5.3 Backend (API)

| # | Problema | Gravidade |
|---|----------|-----------|
| K1 | `themeSettings.isDark` do banco causa quebra no frontend se ativado | **Alta** |

---

## 6. Simulações de Dispositivos

### 6.1 Android (11 resoluções)

| Resolução | Problemas Esperados |
|-----------|---------------------|
| 320×568 | Bottom nav e order bar sobrepostos, botões 40px (abaixo de 44px) |
| 360×640 | Dropdown userMenu pode vazar, tabs funcional |
| 360×740 | Balance entre mobile e tablets |
| 375×667 | iPhone SE — problemas de safe area |
| 393×852 | Pixel 7 — ok |
| 412×915 | Pixel 7 Pro — ok |
| 480×800 | Botões reduzem para 40px |
| 540×960 | Tabs podem caber em row |
| 720×1280 | Tablet pequeno — layout admin pode ficar estranho |
| 1080×1920 | Desktop — layout funcional |
| 1440×2560 | Desktop large — ok |

### 6.2 iPhone (13 modelos)

| Modelo | Viewport | Problemas |
|--------|----------|-----------|
| SE | 375×667 | Safe area, botões pequenos |
| 8 | 375×667 | Similar ao SE |
| 11 | 414×896 | Safe area notch |
| 12 | 390×844 | Safe area, Dynamic Island |
| 13 | 390×844 | Similar ao 12 |
| 14 | 390×844 | Similar ao 12 |
| 15 | 393×852 | Dynamic Island |
| 15 Plus | 430×932 | Dynamic Island |
| 15 Pro | 393×852 | Dynamic Island |
| 15 Pro Max | 430×932 | Dynamic Island |
| 16 | 393×852 | Dynamic Island |
| 16 Pro | 402×874 | Dynamic Island |
| 16 Pro Max | 440×932 | Dynamic Island |

### 6.3 Tablets Android (6 tamanhos)

| Tamanho | Orientação | Problemas |
|---------|------------|-----------|
| 7" | Portrait | Sidebar dashboard não colapsa |
| 7" | Landscape | Layout admin com 1 coluna desnecessária |
| 8" | Portrait | Tabs empilhadas cedo |
| 8" | Landscape | OK |
| 10" | Portrait | Dashboard com espaço desperdiçado |
| 10" | Landscape | Layout funcional |
| 11" | Portrait | Similar ao 10" |
| 11" | Landscape | OK |
| 12" | Portrait | Desktop-like |
| 12" | Landscape | OK |
| 13" | Portrait | Desktop-like |
| 13" | Landscape | OK |

### 6.4 iPad (4 modelos)

| Modelo | Viewport | Problemas |
|--------|----------|-----------|
| Mini | 768×1024 | Tabs empilhadas, sidebar não colapsa |
| Air | 820×1180 | Admin.html não trata 820px |
| Pro 11" | 834×1194 | Similar ao Air |
| Pro 13" | 1024×1366 | Layout funcional |

### 6.5 Foldables (4 modelos)

| Modelo | Tela | Problemas |
|--------|------|-----------|
| Galaxy Fold (externa) | 360×512 | Botões muito pequenos, dropdown cortado |
| Galaxy Fold (interna) | 717×512 | Layout quebra em landscape |
| Pixel Fold (externa) | 360×512 | Similar ao Galaxy Fold |
| Pixel Fold (interna) | 600×512 | Layout pode quebrar |
| Galaxy Flip (externa) | 360×512 | Botões pequenos |

### 6.6 Desktop (9 resoluções)

| Resolução | Problemas |
|-----------|-----------|
| 1024×768 | Sidebar dashboard pode ficar apertada |
| 1280×720 | OK |
| 1366×768 | OK |
| 1440×900 | OK |
| 1600×900 | OK |
| 1920×1080 | OK |
| 2560×1440 | Fontes podem ficar pequenas |
| 3440×1440 | Ultra-wide — layout pode ficar estranho |
| 3840×2160 (4K) | Fontes pequenas, espaços grandes |

---

## 7. Simulações de Comportamento

### 7.1 Orientação

| Cenário | Impacto |
|---------|---------|
| Portrait → Landscape | admin.html: order cards podem ficar muito largos |
| Landscape → Portrait | balcao.html: checkout pode ficar muito alto |
| iPad rotacionado | sidebar dashboard não se adapta |

### 7.2 Zoom

| Zoom | Impacto |
|------|---------|
| 80% | Geralmente ok |
| 100% | Padrão |
| 125% | Botões podem ficar grandes demais |
| 150% | Layout pode quebrar em mobile |
| 200% | Quebra em several pages |

### 7.3 Acessibilidade

| Cenário | Status |
|---------|--------|
| Modo escuro do SO | theme.js não responde a `prefers-color-scheme` |
| Fonte aumentada | Não usa `rem`/`em` consistentemente |
| Acessibilidade ativada | Sem `prefers-reduced-motion` |
| Teclado virtual | Sem `interactive-widget=resizes-visual` |

### 7.4 Performance

| Cenário | Impacto |
|---------|---------|
| Scroll rápido | Pode ter layout thrashing |
| Scroll lento | OK |
| Conexão lenta | CSS inline carrega imediatamente (bom) |
| CPU reduzida | Animações podem causar jank |

---

## 8. Lighthouse (Simulado)

### 8.1 Performance

| Métrica | Estimativa | Notas |
|---------|------------|-------|
| FCP | ~1.2s | CSS inline é rápido |
| LCP | ~2.5s | Imagens de cardápio podem ser lentas |
| TBT | ~150ms | JavaScript inline é leve |
| CLS | ~0.05 | Layout shifts possíveis com cards dinâmicos |
| SI | ~2.0s | OK |

### 8.2 Accessibility

| Critério | Estimativa | Notas |
|----------|------------|-------|
| Score | ~75/100 | z-index, contraste, touch targets |
| Contraste | Falha | Hardcoded colors em dark mode |
| Touch targets | Falha | Botões < 44px |
| Labels | Falha | Inputs sem labels em vários formulários |

### 8.3 Best Practices

| Critério | Estimativa | Notas |
|----------|------------|-------|
| Score | ~80/100 | HTTPS ok, sem erros críticos |
| Segurança | Falha | bcryptjs carregado via CDN no frontend |

### 8.4 SEO

| Critério | Estimativa | Notas |
|----------|------------|-------|
| Score | ~85/100 | Meta tags ok, sem structured data |

### 8.5 PWA

| Critério | Estimativa | Notas |
|----------|------------|-------|
| manifest.json | ✅ Presente | |
| service-worker | ✅ Presente | |
| Ícones | ✅ SVG | |
| Installability | ✅ | |

---

## 9. Checklist de Testes

### 9.1 Testes Manuais Recomendados

- [ ] Abrir index.html em iPhone SE (375×667)
- [ ] Abrir index.html em iPhone 15 Pro Max (430×932)
- [ ] Abrir admin.html com theme.js isDark: true
- [ ] Abrir relatorios.html em 768px
- [ ] Abrir superadmin.html em 375px
- [ ] Abrir balcao.html em 320px
- [ ] Abrir cart.html em 375px
- [ ] Navegar todas as páginas com zoom 200%
- [ ] Testar teclado virtual em iOS e Android
- [ ] Verificar safe areas em iPhone com notch
- [ ] Testar orientação landscape em tablet
- [ ] Verificar contraste de cores em todas as páginas
- [ ] Testar navegação por teclado
- [ ] Verificar que todos os touch targets são ≥ 44px

### 9.2 Testes Automatizados Recomendados

| Ferramenta | Uso | Prioridade |
|------------|-----|------------|
| Playwright | Testes de responsividade cross-browser | **Alta** |
| Lighthouse CI | Auditoria automatizada | **Alta** |
| axe-core | Detecção de problemas de acessibilidade | **Alta** |
| Pa11y | Verificação de contraste | **Média** |

---

## 10. Evidências Visuais (Screenshots)

> Todos os screenshots estão em `docs/screenshots/`.
> Capturados via Playwright em 21/07/2026 contra `localhost:5173`.

### 10.1 `index.html` — Cardápio Público

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 1 | `01-index-375px-bottom-nav.png` | 375×812 (iPhone SE) | Full page — bottom nav e order bar visíveis, sem safe area |
| 2 | `02-index-375px-viewport.png` | 375×812 | Viewport — sobreposição bottom nav + order bar |
| 3 | `03-index-430px-iphone15promax.png` | 430×932 (iPhone 15 Pro Max) | Dynamic Island — conteúdo pode ficar atrás |
| 4 | `04-index-768px-ipad.png` | 768×1024 (iPad) | Layout 3 colunas — funciona mas sem adaptação tablet |
| 5 | `18-index-320px-tiny-screen.png` | 320×568 (Galaxy Fold externa) | Cards em 1 coluna, botões pequenos |
| 6 | `19-index-1920px-desktop.png` | 1920×1080 | Desktop — layout funcional, 4 colunas |

### 10.2 `login.html` — Login

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 7 | `05-login-768px.png` | 768×1024 (iPad) | Card com max-width 460px — espaço desperdiçado em tablets |
| 8 | `16-login-375px-mobile.png` | 375×812 | Mobile — funciona mas sem adaptação específica |
| 9 | `17-login-1024px-desktop.png` | 1024×768 | Desktop — card pequeno centralizado, sem tablet/desktop layout |
| 10 | `20-login-480px-breakpoint.png` | 480×800 | Único breakpoint (480px) — acima dele sem mudança |

### 10.3 `admin.html` — Painel Pedidos

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 11 | `06-admin-1280px-desktop.png` | 1280×800 | Desktop — layout funcional, cards com cores hardcoded |
| 12 | `07-admin-375px-mobile.png` | 375×812 | Mobile — apenas 1 media query (768px), ações empilhadas |

### 10.4 `relatorios.html` — Relatórios

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 13 | `08-relatorios-768px-tabs-column.png` | 768×1024 | Tabs viram column em 768px — deveriam manter row |
| 14 | `09-relatorios-375px-mobile-table.png` | 375×812 | Tabela sem overflow-x — conteúdo vaza horizontalmente |

### 10.5 `superadmin.html` — Super Admin

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 15 | `10-superadmin-375px-table-overflow.png` | 375×812 | Tabela usuários sem scroll — vaza horizontalmente |

### 10.6 `view/cart.html` — Carrinho

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 16 | `11-cart-375px-mobile.png` | 375×812 | Carrinho — layout vertical, fundo hardcoded #FAFAFA |

### 10.7 `balcao.html` — PDV Balcão

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 17 | `12-balcao-320px-overflow.png` | 320×568 | **min-width: 340px** cause overflow horizontal |
| 18 | `13-balcao-375px-mobile.png` | 375×812 | Layout vertical em mobile — funciona mas checkout apertado |

### 10.8 `painelLoja.html` — Painel Loja

| # | Arquivo | Resolução | Erro Capturado |
|---|---------|-----------|----------------|
| 19 | `14-painelLoja-1280px-card-half.png` | 1280×800 | **`.card.half { span 12 }`** — cards não dividem a tela em desktop |
| 20 | `15-painelLoja-600px-mobile.png` | 600×800 | Mobile — rows empilham, mas formulários ficam verticais |

---

## 11. Plano de Implementação

### Fase 1 — Correções Críticas (~5h30)

| # | Item | Arquivos | Esforço | Risco | Regressão |
|---|------|----------|---------|-------|-----------|
| 1.1 | **Corrigir dark mode admin.html** — substituir todas as ~20 cores hardcoded por variáveis CSS ou classes condicionais | `admin.html` | ⭐⭐ (2h) | **Baixo** | Baixo — são mudanças de cor |
| 1.2 | **Adicionar `env(safe-area-inset-*)`** em bottomNav, orderBar, statusBar, toastContainer, userDropdown | `style.css`, `admin.html`, `balcao.css`, `cart.css` | ⭐⭐ (1.5h) | **Médio** | Baixo |
| 1.3 | **Resolver z-index** — criar sistema de camadas: base=1, sticky=10, nav=100, overlay=200, modal=300, toast=400 | Todos CSS | ⭐⭐ (1.5h) | **Médio** | Médio |
| 1.4 | **`overflow-x: auto`** em tabelas de relatorios.html e superadmin.html | `relatorios.html`, `superadmin.html` | ⭐ (30min) | **Baixo** | Baixo |

### Fase 2 — Correções Importantes (~7h)

| # | Item | Arquivos | Esforço | Risco | Regressão |
|---|------|----------|---------|-------|-----------|
| 2.1 | **Media queries faltantes** em login.html, superadmin.html, whatsapp.html, alterar-senha.html | 4 HTML | ⭐⭐ (3h) | **Baixo** | Baixo |
| 2.2 | **Corrigir `.card.half`** — `grid-column: span 6` em ≥900px | `painelstyle.css` | ⭐ (30min) | **Baixo** | Baixo |
| 2.3 | **`max-height` com scroll** em tabelas de produtos e usuários | `painelLoja.html`, `superadmin.html` | ⭐ (30min) | **Baixo** | Baixo |
| 2.4 | **`clamp()` para fontes principais** | `style.css`, `admin.html` | ⭐⭐ (2h) | **Baixo** | Baixo |
| 2.5 | **Corrigir min-width do checkout** — remover `min-width: 340px`, usar `min-width: min(340px, 100%)` | `balcao.css` | ⭐ (1h) | **Médio** | Médio |

### Fase 3 — Melhorias de UX (~4h30)

| # | Item | Arquivos | Esforço | Risco | Regressão |
|---|------|----------|---------|-------|-----------|
| 3.1 | **`@media (hover: none)`** — aumentar touch targets para 48px em dispositivos touch | `style.css` | ⭐⭐ (2h) | **Baixo** | Baixo |
| 3.2 | **Feedback visual** de botões em mobile (active state mais visível) | Todos CSS | ⭐ (1h) | **Baixo** | Baixo |
| 3.3 | **`overscroll-behavior: contain`** em modais/overlays | `style.css`, `admin.html` | ⭐ (30min) | **Baixo** | Baixo |
| 3.4 | **Tabs do relatorios** — manter horizontal até 480px | `relatorios.html` | ⭐ (30min) | **Baixo** | Baixo |
| 3.5 | **Chart.js responsivo** — `responsive: true` com `maintainAspectRatio: false` | `relatorios.html`, `caixa.html` | ⭐ (30min) | **Baixo** | Baixo |

### Fase 4 — Melhorias de Acessibilidade (~6h30)

| # | Item | Arquivos | Esforço | Risco | Regressão |
|---|------|----------|---------|-------|-----------|
| 4.1 | **Touch targets ≥ 44px** em todos os botões mobile | Todos CSS | ⭐⭐ (2h) | **Médio** | Baixo |
| 4.2 | **`prefers-reduced-motion`** — desabilitar animações | `style.css` | ⭐ (30min) | **Baixo** | Baixo |
| 4.3 | **`prefers-contrast: more`** — aumentar contraste | `style.css` | ⭐ (1h) | **Baixo** | Baixo |
| 4.4 | **Labels acessíveis** em inputs sem `<label>` | `index.html`, `cart.html`, `balcao.html` | ⭐⭐ (2h) | **Baixo** | Baixo |
| 4.5 | **`aria-label`** em botões de ícone sem texto | Vários HTML | ⭐ (1h) | **Baixo** | Baixo |

### Fase 5 — Melhorias de Performance (~5h45)

| # | Item | Arquivos | Esforço | Risco | Regressão |
|---|------|----------|---------|-------|-----------|
| 5.1 | **Extrair CSS inline** para arquivos compartilhados | `admin.html`, `relatorios.html`, etc | ⭐⭐⭐ (4h) | **Alto** | Alto |
| 5.2 | **`loading="lazy"`** em todas as imagens | Vários HTML | ⭐ (30min) | **Baixo** | Baixo |
| 5.3 | **`font-display: swap`** nas fonts Google | Vários HTML | ⭐ (15min) | **Baixo** | Baixo |

### Fase 6 — Refatorações (~13h)

| # | Item | Arquivos | Esforço | Risco | Regressão |
|---|------|----------|---------|-------|-----------|
| 6.1 | **Unificar design tokens** — criar `tokens.css` compartilhado | Novo + 6+ HTML | ⭐⭐⭐ (6h) | **Alto** | Alto |
| 6.2 | **Migrar `login.css` legacy** | `login.css` + `login.html` | ⭐ (1h) | **Médio** | Baixo |
| 6.3 | **Criar layout system** com mixins de media queries | SCSS | ⭐⭐⭐ (4h) | **Médio** | Médio |
| 6.4 | **Refatorar `theme.js`** — modo dark completo ou exclusão de admin | `theme.js`, `admin.html` | ⭐⭐ (2h) | **Médio** | Médio |

---

## 12. Resumo de Esforço

| Fase | Itens | Esforço | Risco |
|------|-------|---------|-------|
| Fase 1 — Críticas | 4 | ~5h30 | **Alto impacto, baixo risco** |
| Fase 2 — Importantes | 5 | ~7h | Médio impacto |
| Fase 3 — UX | 5 | ~4h30 | Médio impacto |
| Fase 4 — Acessibilidade | 5 | ~6h30 | Baixo impacto |
| Fase 5 — Performance | 3 | ~5h45 | Médio impacto |
| Fase 6 — Refatoração | 4 | ~13h | Alto impacto, **alto risco** |
| **Total** | **26** | **~42h** | |

---

## 13. Estratégia de Rollback

| Tipo | Estratégia |
|------|-----------|
| CSS | Manter valores antigos comentados; commit incremental |
| HTML | Alterações individuais commitadas separadamente |
| JS | Feature flags para dark mode |
| Estrutural | Branch separada + PR + deploy preview Vercel |
| Tokens | Manter fallbacks hardcoded nos novos arquivos |

---

## 14. Priorização Recomendada

**Mínimo viável (semana 1):** Fase 1 completa — corrige o dark mode e safe areas.
**MVP (semana 2):** Fase 1 + 2 — cobre todos os breakpoints faltantes.
**Ideal (semana 3-4):** Fases 1–4 — UX + acessibilidade.
**Perfeito (mês 2):** Fases 1–6 — refatoração completa.

---

**Fim do relatório.**
*Aguardando aprovação para implementação.*
