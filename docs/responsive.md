# Auditoria de Responsividade — Fábrica de Salgados Costa

> **Data:** 21/07/2026  
> **Projeto:** SIC.ia — Sistema de Cardápio Online e Gerenciamento  
> **Branch:** `feature/hierarquia-usuarios`  
> **Analista:** opencode (Full Stack Staff Engineer)

---

## 1. Inventário de Arquivos

### 1.1 Páginas HTML (13 páginas)

| Arquivo | Linhas | Função | Nível de Criticidade |
|---------|--------|--------|----------------------|
| `index.html` | 203 | Cardápio público (vitrine + busca + carrinho) | **Crítico** (público) |
| `login.html` | 269 | Login administrativo | **Crítico** |
| `admin.html` | 1218 | Painel de pedidos (cozinha) | **Crítico** |
| `dashboard.html` | 687 | Dashboard principal com cards | **Alto** |
| `balcao.html` | 645 | PDV Balcão | **Alto** |
| `painelLoja.html` | 485 | Configurações da loja (horários, produtos) | **Alto** |
| `relatorios.html` | 319 | Relatórios com Chart.js | **Médio** |
| `superadmin.html` | 260 | Gerenciamento de usuários | **Médio** |
| `whatsapp.html` | ~280 | Integração WhatsApp | **Médio** |
| `caixa.html` | 360 | Caixa | **Alto** |
| `entregador.html` | 301 | Painel do entregador | **Médio** |
| `alterar-senha.html` | 133 | Alteração de senha | **Baixo** |
| `view/cart.html` | ~250 | Carrinho de compras | **Crítico** (público) |

### 1.2 CSS (6 arquivos fonte, 4 dist)

| Arquivo | Linhas | Função | Usado por |
|---------|--------|--------|-----------|
| `css/style.css` | 1621 | Design tokens + cardápio público | index.html |
| `css/painelstyle.css` | 300 | Painel admin (dark theme) | painelLoja.html |
| `css/login.css` | 70 | Login legado (substituído por inline) | — |
| `css/balcao.css` | — | Balcão PDV | balcao.html |
| `css/cart.css` | — | Carrinho | view/cart.html |
| `css/cart.scss` | — | SCSS do carrinho | compilado para cart.css |
| `dist/assets/main-BWsquxyB.css` | 1 (min) | Cardápio (build) | dist/index.html |
| `dist/assets/balcao-ClttcXWF.css` | 1 (min) | Balcão (build) | dist/balcao.html |
| `dist/assets/cart-TBKy9AV9.css` | 1 (min) | Carrinho (build) | dist/view/cart.html |
| `dist/assets/painelLoja-SUNDLatG.css` | 1 (min) | Painel (build) | dist/painelLoja.html |

### 1.3 JavaScript (13 arquivos)

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `js/theme.js` | 112 | Engine de theming (CSS custom properties via API) |
| `js/utils.js` | 116 | Utilitários (toast, modal, máscaras, debounce) |
| `js/apiHelper.js` | 77 | Cliente REST público |
| `js/menu.js` | 857 | Cardápio, categorias, busca, auth clientes |
| `js/cart.js` | 829 | Carrinho, sabores, pedidos |
| `js/navbar.js` | 11 | Menu mobile toggle |
| `js/painel.js` | 824 | Painel admin (CRUD produtos, config, tema) |
| `js/core/auth.js` | 42 | Módulo ES6 de autenticação |
| `js/core/api.js` | 31 | Módulo ES6 de API |
| `js/services/*.js` | ~17 cada | Services (caixa, entregador, order, product) |

---

## 2. Arquitetura de Responsividade

### 2.1 Viewport

Todas as páginas usam:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

**Problemas encontrados:**
- ❌ Nenhuma página usa `viewport-fit=cover` para dispositivos com notch
- ❌ Nenhuma página usa `interactive-widget=resizes-visual` para teclado virtual
- ❌ Nenhum CSS usa unidades `dvh`, `svh`, `lvh` — apenas `vh` fixo
- ❌ Nenhum padding usa `env(safe-area-inset-*)` para áreas seguras

### 2.2 Breakpoints Utilizados

| Breakpoint | Onde | Propósito |
|-----------|------|-----------|
| 320px | style.css | Telas muito pequenas (1 coluna) |
| 321px–412px | style.css | Android/iOS pequeno (2 colunas) |
| 413px–767px | style.css | iPhone Plus/Android grande |
| 480px | style.css, login.css, admin.html | Mobile refinements |
| 600px | painelstyle.css, painelLoja.html | Mobile painel |
| 640px | style.css | Tablet pequeno (3 colunas) |
| 768px | style.css, admin.html, relatorios.html, superadmin.html | Tablet |
| 900px | painelLoja.html | Tablet painel |
| 1024px | style.css, balcao.css, cart.css | Desktop / grid 4 colunas |
| 1200px | painelstyle.css | Desktop painel |

### 2.3 Técnicas CSS Utilizadas

| Técnica | Onde | Status |
|---------|------|--------|
| CSS Grid (`grid-template-columns`) | style.css, painelstyle.css, balcao.css | ✅ |
| CSS Flexbox | Em todo o projeto | ✅ |
| `clamp()` | painelLoja.html (fonte título) | ⚠️ Apenas 1 uso |
| CSS Custom Properties | style.css, admin.html, theme.js | ✅ |
| `aspect-ratio` | style.css (cover, cards) | ✅ |
| `object-fit` | style.css (cover, logo, cards) | ✅ |
| `overflow-x: auto` | style.css (categorias), painelstyle.css (tabelas) | ✅ |
| `scroll-snap-type` | style.css (categorias menu) | ✅ |
| `-webkit-overflow-scrolling: touch` | style.css, painelstyle.css | ✅ |
| Media queries inline | Em várias páginas (embedded `<style>`) | ⚠️ Duplicação |

---

## 3. Análise Detalhada por Página

### 3.1 `index.html` — Cardápio Público (Crítico)

**CSS:** `css/style.css` (1621 linhas)

**Problemas encontrados:**

| # | Problema | Linha | Gravidade | Impacto | Dispositivos |
|---|----------|-------|-----------|---------|-------------|
| P1 | `padding-bottom: calc(64px + 56px + var(--s-24))` no body resolve sobreposição da bottom nav + order bar, mas não considera `env(safe-area-inset-bottom)` | style.css:62 | **Média** | Conteúdo pode ficar atrás da home indicator em iPhones X+ | iPhone X–16, Pixel Fold, Galaxy Fold |
| P2 | `#orderBar` com `position: fixed; bottom: 64px` — não considera safe areas | style.css (inline) | **Média** | Order bar pode ficar atrás da home indicator | iPhones com notch |
| P3 | `#userMenuBtn` com `position: fixed; top: 52px` — sobrepõe `#statusBar` (também fixed) | style.css | **Baixa** | Botão usuário pode sobrepor status bar em alguns breakpoints | Todos |
| P4 | Múltiplos elementos com `z-index: 9999` (statusBar, bottomNav, userMenuBtn, userDropdown, orderBar, registerOverlay, ordersOverlay) | style.css | **Alta** | Empilhamento imprevisível; overlays podem ficar atrás de outros elementos | Todos |
| P5 | Categoria "Promoções" é um link `<a>` dentro de botões `<button>` — comportamento inconsistente | index.html:35 | **Baixa** | Experiência de navegação inconsistente | Todos |
| P6 | `#userDropdown` tem `width: 240px` fixa — pode vazar em telas < 280px | style.css | **Baixa** | Dropdown cortado | Galaxy Fold (tela externa), 320px |
| P7 | Botões `.btn-add`, `.btn-plus`, `.btn-minus` tem `height: 48px` (bom), mas no breakpoint 480px reduzem para `40px` | style.css | **Baixa** | Touch target mínimo WCAG é 44px; 40px é abaixo | Android < 480px |
| P8 | `#orderBarTotal` com `background: rgba(255,255,255,0.2)` — contraste pode ser baixo com texto branco | style.css | **Média** | Legibilidade reduzida | Todos |
| P9 | CardsMenu têm `animation: fadeInUp` com delays sequenciais até 10 filhos — após o 10º item, sem animação | style.css | **Baixa** | Inconsistência visual | Todos |

### 3.2 `login.html` — Login Administrativo (Crítico)

**CSS:** Inline `<style>` (70 linhas)

**Problemas:**

| # | Problema | Linha | Gravidade | Impacto |
|---|----------|-------|-----------|---------|
| L1 | Apenas 1 media query em `480px` — sem adaptação para 320px, tablets, desktop, etc | Fim do style | **Alta** | Telas muito pequenas podem ter padding excessivo; tablets tem card estreito |
| L2 | `.container { max-width: 460px }` — não ocupa largura total em telas < 320px | style | **Média** | Pode haver overflow horizontal mínimo |
| L3 | Nenhum `overflow-y: auto` no body — se o conteúdo crescer, não há scroll garantido | style | **Baixa** | Risco mínimo |
| L4 | O ícone tem `width: 64px; height: 64px` que reduz para `52px` no mobile — tamanho fixo sem unidades fluidas | style | **Baixa** | Em tablets, o ícone poderia ser maior |

### 3.3 `admin.html` — Painel de Pedidos (Crítico)

**CSS:** Inline `<style>` (~400 linhas) + theme.js

**Problemas:**

| # | Problema | Linha | Gravidade | Impacto |
|---|----------|-------|-----------|---------|
| A1 | **Dark mode quebra contraste**: `order-card.status-pendente` com `background: #FEF2F2` hardcoded — quando theme.js aplica `isDark: true`, `--text` vira `#FFFCE1` e o texto fica ilegível em fundo claro | CSS ~linha 80 | **CRÍTICA** | Página inteira ilegível no dark mode |
| A2 | Media query `768px` é a única — para tablets médios (820px), não há adaptação | Fim do style | **Média** | iPad Air portrait (820px) usa regras mobile desnecessariamente |
| A3 | `.order-actions` com `flex-direction: column` em mobile — 6+ botões empilhados verticalmente ocupam muito espaço | style | **Média** | Muito scroll vertical no mobile |
| A4 | `.order-info-grid` usa `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))` — 180px pode ser largo demais para 320px | style | **Baixa** | Apenas 1 coluna em telas < 180px (raro) |
| A5 | `.order-header` muda para `flex-direction: column` em 768px — em telas 768px–1024px, poderia manter row | style | **Baixa** | Cards de pedido desnecessariamente verticais em tablet |

### 3.4 `painelLoja.html` — Painel da Loja (Alto)

**CSS:** Inline `<style>` + `css/painelstyle.css`

**Problemas:**

| # | Problema | Linha | Gravidade | Impacto |
|---|----------|-------|-----------|---------|
| PL1 | `.card.half` com `grid-column: span 12` mesmo no `@media(min-width: 900px)` — cards half deveriam ser `span 6` mas são `span 12` | style | **Média** | Cards não ocupam meia largura em desktop |
| PL2 | `.row` usa `grid-template-columns: 140px 1fr` em painelLoja.html — em 600px vira 1 coluna, mas labels ficam acima dos inputs | style | **Média** | Formulários ficam muito verticais |
| PL3 | Tabela de produtos não tem `max-height` com scroll; conteúdo pode ocupar tela inteira | style | **Média** | Em mobile, a lista de produtos pode dominar a viewport |
| PL4 | `.btn` com `padding: 12px 16px; font-size: 16px` em todas as telas — em mobile fica proporcionalmente grande | painelstyle.css | **Baixa** | Botões ocupam muito espaço |
| PL5 | Toolbar em mobile fica `flex-direction: column` com inputs 100% — bom para usabilidade, mas poderia ter gap maior | style | **Baixa** | Toque acidental entre elementos |

### 3.5 `relatorios.html` — Relatórios (Médio)

**Problemas:**

| # | Problema | Linha | Gravidade | Impacto |
|---|----------|-------|-----------|---------|
| R1 | `@media (max-width: 768px)` faz `tabs` virarem `column` — em 768px ainda caberiam em row | style | **Média** | Tabs empilhadas desnecessariamente em iPad portrait |
| R2 | Tabela de relatório não tem `overflow-x: auto` — em mobile, tabela pode vazar | style | **Média** | Scroll horizontal indesejado |
| R3 | Canvas do Chart.js não é redimensionado responsivamente — `height="100"` fixo | HTML | **Média** | Gráfico pode ficar distorcido em mobile |

### 3.6 `superadmin.html` — Super Admin (Médio)

**Problemas:**

| # | Problema | Linha | Gravidade | Impacto |
|---|----------|-------|-----------|---------|
| S1 | Tabela de usuários sem `overflow-x: auto` — colunas podem vazar | style | **Média** | Scroll horizontal |
| S2 | `max-width: 400px` no formulário de cadastro — em telas > 400px fica centralizado e esquisito | HTML | **Baixa** | Espaço desperdiçado |
| S3 | Apenas 1 media query em 768px | style | **Média** | Pouca adaptação para diferentes tamanhos |

### 3.7 `balcao.html` — Balcão PDV (Alto)

**Problemas:**

| # | Problema | Gravidade | Impacto |
|---|----------|-----------|---------|
| B1 | `body` com `overflow: hidden` + `display: flex` em row — em telas < 600px o layout quebra horizontalmente | **Alta** | Conteúdo pode vazar para fora da tela |
| B2 | `.checkout` com `min-width: 340px` fixo — impede que o checkout ocupe menos que isso | **Alta** | Overflow horizontal em telas < 340px |
| B3 | `@media(max-width:1024px)` faz `flex-direction: column` — bom, mas entre 768px e 1024px o min-width de 340px pode causar overflow | **Média** | Apenas em tablets médios |
| B4 | `.grid-produtos` com `repeat(auto-fill, minmax(140px, 1fr))` — em 320px, 140px força 1 coluna com gap grande | **Baixa** | Cards muito largos para tela pequena |

### 3.8 `view/cart.html` — Carrinho (Crítico)

**CSS:** `css/cart.css` + inline

**Problemas:**

| # | Problema | Gravidade | Impacto |
|---|----------|-----------|---------|
| C1 | `.total { width: 35% }` e `.items { width: 64% }` — em mobile (767px) viram 100%, mas o código inline `@media(max-width:1024px)` também força 100% para ambos | **Média** | Entre 768px e 1024px, items + total podem não caber lado a lado |
| C2 | `.items .item .bottom` usa `flex-wrap: wrap` — em telas muito estreitas, preço e contador podem se sobrepor | **Baixa** | Quebra de layout visual |
| C3 | Inputs em `#campoBairro` etc com `font-size: 1rem` — sem zoom prevention em iOS (font-size < 16px causa zoom automático) | **Média** | iOS pode dar zoom em inputs |
| C4 | `img { width: 120px }` fixo em items — em mobile (767px) reduz para 100px. Em telas < 360px, ainda ocupa espaço demais | **Baixa** | Imagem proporcionalmente grande |

---

## 4. Problemas Globais

### 4.1 CSS — Geral

| # | Problema | Gravidade | Explicação |
|---|----------|-----------|------------|
| G1 | Ausência de `env(safe-area-inset-*)` em qualquer elemento fixed | **Alta** | iPhones X–16, Pixel Fold, Galaxy Fold — elementos fixed ficam atrás da home indicator/notch |
| G2 | Nenhum uso de `dvh`/`svh`/`lvh` — apenas `vh` fixo | **Média** | Em mobile com barra de endereço visível, `100vh` é maior que a viewport real |
| G3 | Z-index 9999 em 7+ elementos diferentes | **Alta** | Conflitos de empilhamento; overlay de pedidos (`z-index: 10001`) pode ficar atrás de modais |
| G4 | Cores hardcoded em vários lugares sem usar CSS variables | **Média** | `admin.html` tem `background: #FEF2F2` etc — não respeita tema escuro |
| G5 | `login.css` é legacy inline (70 linhas) — provavelmente não usado | **Baixa** | Código morto pode causar confusão |
| G6 | Duplicação de estilos entre páginas (cada admin page tem seu próprio `<style>` inline) | **Média** | Manutenção difícil; inconsistências |
| G7 | `font-size` não usa `clamp()` na maioria dos lugares | **Média** | Títulos podem ser grandes demais em mobile ou pequenos demais em desktop |

### 4.2 JavaScript — Geral

| # | Problema | Gravidade | Explicação |
|---|----------|-----------|------------|
| J1 | `theme.js` aplica `isDark: true` sem considerar que admin.html tem cores hardcoded | **CRÍTICA** | Texto branco em fundo claro |
| J2 | Menu mobile (`navbar.js`) transforma com `translateX(100%)` para `translateX(0%)` — sem `transition` definida no CSS | **Média** | Transição pode não ser suave |
| J3 | Overlay de pedidos no `index.html` usa `orders-overlay` com `align-items: flex-end` — em landscape em telas pequenas, pode ficar muito alto | **Baixa** | UX estranha em landscape |
| J4 | Toast container fixo em `bottom: 24px; right: 24px` — sem considerar safe areas | **Média** | Toast pode ficar atrás da home indicator |

### 4.3 Backend — API

| # | Problema | Gravidade |
|---|----------|-----------|
| K1 | `themeSettings.isDark` vindo do banco causa quebra no frontend se ativado | **Alta** |
| K2 | Nenhum tratamento de CORS específico para diferentes origins | **Média** |

---

## 5. Plano de Implementação

### Fase 1 — Correções Críticas

| Item | Descrição | Arquivos | Esforço | Risco |
|------|-----------|----------|---------|-------|
| 1.1 | **Corrigir dark mode no admin.html** — substituir `background: #FEF2F2`, `#FEE2E2` etc por variáveis CSS que se adaptam ao tema | `admin.html` | ⭐ (1h) | Baixo — são mudanças de cor CSS |
| 1.2 | **Adicionar `env(safe-area-inset-*)`** em todos os elementos fixed (bottomNav, orderBar, statusBar, userDropdown, toastContainer) | `style.css`, `admin.html`, `painelstyle.css`, `balcao.css`, `cart.css` | ⭐⭐ (2h) | Médio — pode mudar padding visual |
| 1.3 | **Resolver conflitos de z-index** — criar um sistema de camadas (ex: 100 overlay, 200 modal, 300 toast) | Todos os CSS com z-index | ⭐⭐ (2h) | Médio — risco de overlay não aparecer |
| 1.4 | **Adicionar `overflow-x: auto`** em tabelas que não têm (relatorios.html, superadmin.html) | `relatorios.html`, `superadmin.html` | ⭐ (30min) | Baixo |

### Fase 2 — Correções Importantes

| Item | Descrição | Arquivos | Esforço | Risco |
|------|-----------|----------|---------|-------|
| 2.1 | **Adicionar media queries para breakpoints faltantes** em login.html, superadmin.html, whatsapp.html, alterar-senha.html | 4 páginas HTML | ⭐⭐ (3h) | Baixo |
| 2.2 | **Corrigir `.card.half`** no painelLoja.html — `grid-column: span 6` em telas ≥ 900px | `painelLoja.html` | ⭐ (30min) | Baixo |
| 2.3 | **Adicionar `max-height` com scroll** na tabela de produtos e usuários | `painelLoja.html`, `superadmin.html` | ⭐ (30min) | Baixo |
| 2.4 | **Usar `clamp()` para fontes principais** em vez de valores fixos | `style.css`, `admin.html` | ⭐⭐ (2h) | Baixo |
| 2.5 | **Corrigir min-width do checkout** no balcão para permitir < 340px | `balcao.html` / `balcao.css` | ⭐ (1h) | Médio |

### Fase 3 — Melhorias de UX

| Item | Descrição | Arquivos | Esforço | Risco |
|------|-----------|----------|---------|-------|
| 3.1 | **Adicionar `@media (hover: none)`** para dispositivos touch — aumentar touch targets para 48px | `style.css` | ⭐⭐ (2h) | Baixo |
| 3.2 | **Melhorar feedback visual** de botões em mobile (active state mais visível) | Todos CSS | ⭐ (1h) | Baixo |
| 3.3 | **Adicionar `overscroll-behavior: contain`** em modais/overlays para evitar scroll do fundo | `style.css` | ⭐ (30min) | Baixo |
| 3.4 | **Melhorar tabs do relatórios** — manter horizontal até 480px | `relatorios.html` | ⭐ (30min) | Baixo |
| 3.5 | **Responsividade do Chart.js** — usar `responsive: true` com `maintainAspectRatio: false` | `relatorios.html` | ⭐ (30min) | Baixo |

### Fase 4 — Melhorias de Acessibilidade

| Item | Descrição | Arquivos | Esforço | Risco |
|------|-----------|----------|---------|-------|
| 4.1 | **Garantir touch targets ≥ 44px** em todos os botões (especialmente nos breakpoints mobile) | Todos CSS | ⭐⭐ (2h) | Médio |
| 4.2 | **Adicionar `prefers-reduced-motion`** para desabilitar animações | `style.css` | ⭐ (30min) | Baixo |
| 4.3 | **Adicionar `prefers-contrast: more`** — aumentar contraste de cores | `style.css` | ⭐ (1h) | Baixo |
| 4.4 | **Adicionar labels acessíveis** em inputs que não têm `<label>` explícito | `index.html`, `view/cart.html` | ⭐⭐ (2h) | Baixo |
| 4.5 | **Adicionar `aria-label`** em botões de ícone sem texto | Vários HTML | ⭐ (1h) | Baixo |

### Fase 5 — Melhorias de Performance

| Item | Descrição | Arquivos | Esforço | Risco |
|------|-----------|----------|---------|-------|
| 5.1 | **Extrair CSS inline das páginas** para arquivos compartilhados (reduzir duplicação) | `admin.html`, `relatorios.html`, etc | ⭐⭐⭐ (4h) | Alto — mudança estrutural |
| 5.2 | **Usar `loading="lazy"`** em todas as imagens (já usado em cart.html, verificar outras) | Vários HTML | ⭐ (30min) | Baixo |
| 5.3 | **Minificar CSS/JS** no build (já feito via Vite no dist) | build config | — | Já implementado |
| 5.4 | **Adicionar `font-display: swap`** nas fonts do Google | Vários HTML | ⭐ (15min) | Baixo |

### Fase 6 — Refatorações

| Item | Descrição | Arquivos | Esforço | Risco |
|------|-----------|----------|---------|-------|
| 6.1 | **Unificar sistema de design tokens** — criar um `tokens.css` compartilhado em vez de duplicar `:root` em cada página | Novo arquivo + 6+ HTML | ⭐⭐⭐ (6h) | Alto |
| 6.2 | **Migrar `login.css` legacy** para o novo sistema de tokens | `login.css` + `login.html` | ⭐ (1h) | Médio |
| 6.3 | **Criar layout system** com mixins de media queries reutilizáveis | SCSS | ⭐⭐⭐ (4h) | Médio |
| 6.4 | **Refatorar `theme.js`** para não aplicar dark mode em páginas admin (ou criar CSS dark mode completo) | `theme.js`, `admin.html` | ⭐⭐ (2h) | Médio |

---

## 6. Resumo de Esforço

| Fase | Itens | Esforço Total | Risco |
|------|-------|---------------|-------|
| Fase 1 — Críticas | 4 | ~5h30 | **Alto impacto, baixo risco** |
| Fase 2 — Importantes | 5 | ~7h | Médio impacto |
| Fase 3 — UX | 5 | ~4h30 | Médio impacto |
| Fase 4 — Acessibilidade | 5 | ~6h30 | Baixo impacto |
| Fase 5 — Performance | 4 | ~5h45 | Médio impacto (estrutural) |
| Fase 6 — Refatoração | 4 | ~13h | Alto impacto, **alto risco** |
| **Total** | **27** | **~42h** | |

---

## 7. Estratégia de Rollback

Para cada alteração:

| Tipo | Estratégia |
|------|-----------|
| CSS | Manter valores antigos comentados ou versionados no git |
| HTML | Alterações incrementais commitadas individualmente |
| JS | Feature flags para dark mode |
| Estrutural | Branch separada + PR + deploy preview Vercel |

---

**Fim do relatório.**  
*Aguardando aprovação para implementação.*
