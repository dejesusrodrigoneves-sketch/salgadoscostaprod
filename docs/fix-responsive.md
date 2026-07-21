# Plano de Correções de Responsividade — SIC.ia

> **Data:** 21/07/2026
> **Baseado em:** `responsive.md` + `responsive-2.0.md` + 20 screenshots Playwright
> **Objetivo:** Corrigir 62 problemas, melhorar Lighthouse de ~75 para ~90+, reduzir tempo de carregamento 40%
> **Estimativa Original:** 42h → **Estimativa Otimizada:** 33h (redução de 21%)

---

## Resumo Executivo

| Problema | Quantidade | Impacto |
|----------|------------|---------|
| Dark mode hardcoded (cores quebradas) | 20 ocorrências | **Crítico** — página ilegível |
| z-index caótico (9999+) | 7+ elementos | **Alto** — overlays quebrados |
| Ausência safe-area-inset-* | 13 páginas | **Alto** — conteúdo atrás de notch |
| CSS inline não cacheável | ~2500 linhas | **Alto** — carregamento lento |
| Touch targets < 44px | 5+ botões | **Médio** — violação WCAG |
| Media queries inconsistentes | 3 sistemas | **Médio** — comportamento imprevisível |

---

## Mapa de Dependências

```
                    ┌─────────────────────┐
                    │  A1: Design Tokens  │ ← BLOQUEIA tudo
                    │  (CSS variables)    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼──────┐
     │ A2: Dark Mode  │ │ A3: Z-Index│ │ B1: Extract  │
     │ (admin.html)   │ │ System     │ │ Inline CSS   │
     └────────┬───────┘ └─────┬──────┘ └───────┬──────┘
              │               │                 │
              └───────┬───────┘                 │
                      │                         │
            ┌─────────▼─────────┐      ┌────────▼────────┐
            │ B3: clamp() fonts │      │ B2: CLS Fix     │
            └─────────┬─────────┘      └────────┬────────┘
                      │                         │
              ┌───────▼─────────────────────────▼──────┐
              │  C1-C3: UX + D1-D3: A11y (paralelo)    │
              └─────────────────────────────────────────┘
```

**Dependências Críticas:**
1. **A1 (Tokens)** é pré-requisito para A2, A3, B1, B3
2. **A3 (Z-Index)** deve ser feito ANTES de B1 (extração de CSS)
3. **A2 (Dark Mode)** deve ser feito ANTES de B3 (clamp fonts)

---

## Batch A: Fundação (Semana 1) — ~8h

### A1: Design Tokens Compartilhados

**Objetivo:** Criar variáveis CSS centralizadas para todas as páginas

**Arquivo criar:** `css/tokens.css`

```css
/* ═══════════════════════════════════════════════════════
   Design Tokens — SIC.ia
   Compartilhado por todas as páginas
   ═══════════════════════════════════════════════════════ */

:root {
  /* Brand — Verde (delivery) */
  --primary:         #1FA58D;
  --primary-hover:   #188A75;
  --primary-bg:      #E8F5F2;
  --secondary:       #FAFAFA;
  --surface:         #FFFFFF;
  --text:            #222222;
  --text-muted:      #666666;
  --success:         #1FA58D;
  --warning:         #F59E0B;
  --danger:          #DC2626;
  --border:          #ECECEC;

  /* Status Colors */
  --danger-bg:       #FEF2F2;
  --danger-bg-dark:  #3D1A1A;
  --warning-bg:      #FEF3C7;
  --warning-bg-dark: #3D2E0A;
  --success-bg:      #DCFCE7;
  --success-bg-dark: #0A3D1A;

  /* Typography */
  --font: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;

  /* Spacing (base 4px) */
  --s-4:   4px;
  --s-8:   8px;
  --s-12:  12px;
  --s-16:  16px;
  --s-20:  20px;
  --s-24:  24px;
  --s-32:  32px;
  --s-40:  40px;
  --s-48:  48px;
  --s-64:  64px;
  --s-80:  80px;

  /* Radius */
  --radius-sm:   6px;
  --radius:      8px;
  --radius-lg:   16px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.08);

  /* Layout */
  --max-w: 1280px;

  /* Z-Index System */
  --z-base:     1;
  --z-sticky:   10;
  --z-dropdown: 100;
  --z-overlay:  200;
  --z-modal:    300;
  --z-toast:    400;
}
```

**Esforço:** 2h
**Risco:** Baixo — aditivo

---

### A2: Corrigir Dark Mode no admin.html

**Problema:** 20 cores hardcoded que não respeitam `theme.js`

**Cores hardcoded encontradas (com linhas):**
- `admin.html:212` — `.order-card.status-pendente { background: #FEF2F2 }`
- `admin.html:230` — `.badge-novo { background: #FEE2E2 }`
- `admin.html:320` — `.order-status.status-pendente { background: #FEE2E2 }`
- `admin.html:321` — `.order-status.status-producao { background: #FEF3C7 }`
- `admin.html:324` — `.order-status.status-finalizado { background: #DCFCE7 }`
- `admin.html:459` — `.btn-producao:hover { background: #FEF3C7 }`
- `admin.html:468` — `.btn-finalizar:hover { background: #DCFCE7 }`
- `admin.html:474` — `.btn-delete:hover { background: #FEF2F2 }`

**Solução:** Substituir por variáveis CSS:

```css
/* ANTES */
.order-card.status-pendente { background: #FEF2F2; }
.badge-novo { background: #FEE2E2; }
.order-status.status-pendente { background: #FEE2E2; }
.order-status.status-producao { background: #FEF3C7; }
.order-status.status-finalizado { background: #DCFCE7; }
.btn-producao:hover { background: #FEF3C7; }
.btn-finalizar:hover { background: #DCFCE7; }
.btn-delete:hover { background: #FEF2F2; }

/* DEPOIS */
.order-card.status-pendente { background: var(--danger-bg); }
.badge-novo { background: var(--danger-bg); }
.order-status.status-pendente { background: var(--danger-bg); }
.order-status.status-producao { background: var(--warning-bg); }
.order-status.status-finalizado { background: var(--success-bg); }
.btn-producao:hover { background: var(--warning-bg); }
.btn-finalizar:hover { background: var(--success-bg); }
.btn-delete:hover { background: var(--danger-bg); }
```

**Atualizar theme.js** para setar variáveis de status:

```javascript
// Adicionar em applyTheme() após linha 51:
if (t.isDark) {
  set('--secondary', '#0E100F');
  set('--surface',   '#191919');
  set('--text',      '#FFFCE1');
  set('--text-muted','#7C7C6F');
  // Status backgrounds para dark mode
  set('--danger-bg',  '#3D1A1A');
  set('--warning-bg', '#3D2E0A');
  set('--success-bg', '#0A3D1A');
}
```

**Esforço:** 2h
**Risco:** Baixo — são mudanças de cor

---

### A3: Sistema de Z-Index

**Problema:** 7+ elementos com `z-index: 9999`, overlay `10000`, orders-overlay `10001`

**Mapeamento atual:**
| Elemento | z-index Atual | Novo z-index |
|----------|---------------|--------------|
| `#bottomNav` (style.css:859) | 9999 | `var(--z-sticky)` = 10 |
| `#statusBar` (style.css) | 9999 | `var(--z-sticky)` = 10 |
| `#userMenuBtn` (style.css:925) | 9999 | `var(--z-dropdown)` = 100 |
| `#userDropdown` (style.css:944) | 9999 | `var(--z-dropdown)` = 100 |
| `#orderBar` (style.css) | 9999 | `var(--z-sticky)` = 10 |
| `#registerOverlay` (style.css:1040) | 10000 | `var(--z-overlay)` = 200 |
| `.orders-overlay` (style.css) | 10001 | `var(--z-overlay)` = 200 |
| `.toast-container` (admin.html:503) | 9999 | `var(--z-toast)` = 400 |
| `.modal-overlay` (admin.html:545) | 10000 | `var(--z-modal)` = 300 |

**Substituições em style.css:**
```css
/* ANTES */
#bottomNav { z-index: 9999; }
#statusBar { z-index: 9999; }
#userMenuBtn { z-index: 9999; }
#userDropdown { z-index: 9999; }
#orderBar { z-index: 9999; }
#registerOverlay { z-index: 10000; }

/* DEPOIS */
#bottomNav { z-index: var(--z-sticky); }
#statusBar { z-index: var(--z-sticky); }
#userMenuBtn { z-index: var(--z-dropdown); }
#userDropdown { z-index: var(--z-dropdown); }
#orderBar { z-index: var(--z-sticky); }
#registerOverlay { z-index: var(--z-overlay); }
```

**Substituições em admin.html:**
```css
/* ANTES */
.toast-container { z-index: 9999; }
.modal-overlay { z-index: 10000; }

/* DEPOIS */
.toast-container { z-index: var(--z-toast); }
.modal-overlay { z-index: var(--z-modal); }
```

**Esforço:** 1.5h
**Risco:** Médio — testar cada overlay individualmente

---

### A4: Quick Wins (Batch de 15min)

| # | Fix | Arquivo | Esforço |
|---|-----|---------|---------|
| QW1 | Adicionar `loading="lazy"` em todas as imagens exceto logo/first card | Todos HTML | 15min |
| QW2 | Adicionar `overflow-x: auto` em tabelas (relatorios.html, superadmin.html) | 2 HTML | 15min |
| QW3 | Adicionar `overscroll-behavior: contain` em overlays | style.css, admin.html | 5min |
| QW4 | Remover `login.css` (código morto) | login.css | 5min |
| QW5 | Adicionar `min-height: 100dvh` com fallback `100vh` | style.css | 10min |
| QW6 | Adicionar `prefers-reduced-motion` (desabilita animações) | style.css | 15min |

**Código para prefers-reduced-motion:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Esforço total:** 1h
**Risco:** Baixo — aditivo

---

## Batch B: Performance (Semana 2) — ~7h

### B1: Extrair CSS Inline para Arquivos Cacheáveis

**Problema:** ~2500 linhas de CSS inline em 12 HTMLs — não são cacheáveis pelo browser

**Páginas para extrair (ordem de risco):**

| Página | Linhas Inline | Risco | Ordem |
|--------|---------------|-------|-------|
| `relatorios.html` | ~150 | Baixo | 1 |
| `superadmin.html` | ~75 | Baixo | 2 |
| `login.html` | ~100 | Baixo | 3 |
| `alterar-senha.html` | ~50 | Baixo | 4 |
| `entregador.html` | ~150 | Médio | 5 |
| `whatsapp.html` | ~200 | Médio | 6 |
| `caixa.html` | ~200 | Médio | 7 |
| `dashboard.html` | ~400 | Médio | 8 |
| `painelLoja.html` | ~200 | Médio | 9 |
| `balcao.html` | ~100 | Alto | 10 |
| `admin.html` | ~500 | Alto | 11 |

**Processo para cada página:**
1. Criar arquivo CSS separado (ex: `css/admin-page.css`)
2. Mover todo o `<style>` para o novo arquivo
3. Adicionar `<link rel="stylesheet" href="css/admin-page.css">` no `<head>`
4. Manter `tokens.css` como primeiro CSS carregado
5. Testar em todas as resoluções

**Impacto Performance:**
- **Antes:** CSS re-parseado a cada visita (inline)
- **Depois:** CSS cacheado pelo browser entre navegações
- **Redução estimada:** 40-50% no carregamento de páginas admin

**Esforço:** 4h
**Risco:** Alto — mudança estrutural (fazer após A1 e A3)

---

### B2: Corrigir CLS (Cumulative Layout Shift)

**Problema:** Layout shifts causados por conteúdo dinâmico

| CLS Source | Página | Fix |
|-----------|---------|-----|
| `#showMenu` vazio antes da API | index.html | Adicionar `min-height: 200px` ou skeleton |
| `#coverImg` e `#logoImg` sem src | index.html | Adicionar `width`/`height` e `aspect-ratio` |
| `#statusBar` texto dinâmico | index.html | Usar `min-width` no statusBar |
| Cards de pedido dinâmicos | admin.html | Adicionar `contain: layout` no grid |
| `body { padding-bottom }` muda em breakpoint | index.html | Usar `clamp()` para transição suave |

**Skeleton para #showMenu:**
```css
#showMenu:empty {
  min-height: 200px;
  background: linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Esforço:** 2h
**Risco:** Baixo — aditivo

---

### B3: Mover theme.js para Body com Defer

**Problema:** `theme.js` no `<head>` é render-blocking

**Antes (admin.html:11):**
```html
<script src="js/theme.js"></script>
```

**Depois:**
```html
<!-- No <head>, manter apenas se necessário -->
<!-- No final do <body>, antes de outros scripts -->
<script src="js/theme.js" defer></script>
```

**Impacto:** Desbloqueia first paint em ~200ms

**Esforço:** 30min
**Risco:** Baixo

---

### B4: clamp() para Fontes Principais

**Problema:** Fontes com tamanhos fixos — grandes em mobile, pequenas em desktop

**Substituições em style.css:**
```css
/* ANTES */
.page-header h1 { font-size: 28px; }
.card-title { font-size: 16px; }
.stat-value { font-size: 24px; }

/* DEPOIS */
.page-header h1 { font-size: clamp(22px, 4vw, 28px); }
.card-title { font-size: clamp(14px, 2.5vw, 16px); }
.stat-value { font-size: clamp(20px, 3.5vw, 24px); }
```

**Esforço:** 2h
**Risco:** Baixo

---

### B5: viewport-fit=cover + dvh

**Problema:** Nenhuma página usa `viewport-fit=cover` para notch, apenas `vh` fixo

**Adicionar em todas as 13 páginas:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-visual">
```

**Substituir vh por dvh com fallback:**
```css
/* ANTES */
body { min-height: 100vh; }

/* DEPOIS */
body { min-height: 100dvh; min-height: 100vh; }
```

**Adicionar safe-area-inset em elementos fixed:**
```css
#bottomNav {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

#orderBar {
  bottom: calc(64px + env(safe-area-inset-bottom, 0));
}

.toast-container {
  bottom: calc(var(--s-24) + env(safe-area-inset-bottom, 0));
  right: calc(var(--s-24) + env(safe-area-inset-right, 0));
}
```

**Esforço:** 1h
**Risco:** Médio — testar em dispositivos sem notch

---

## Batch C: Estrutural (Semana 3) — ~4h

### C1: Extrair CSS dos Admin Pages (continuação de B1)

Após extrair as páginas simples (B1), extrair:
- `admin.html` (500 linhas → `css/admin-page.css`)
- `dashboard.html` (400 linhas → `css/dashboard-page.css`)
- `painelLoja.html` (200 linhas → manter em painelstyle.css)
- `balcao.html` (100 linhas → manter em balcao.css)

**Esforço:** 3h
**Risco:** Alto

---

### C2: Corrigir .card.half no painelLoja

**Problema:** `grid-column: span 12` mesmo em ≥900px

**Antes (painelstyle.css:67):**
```css
.card.half { grid-column: span 12; }
```

**Depois:**
```css
.card.half { grid-column: span 12; }

@media (min-width: 900px) {
  .card.half { grid-column: span 6; }
}
```

**Esforço:** 30min
**Risco:** Baixo

---

### C3: Corrigir min-width do checkout

**Problema:** `.checkout { min-width: 340px }` impede < 340px

**Antes (balcao.css:174):**
```css
.checkout { min-width: 340px; }
```

**Depois:**
```css
.checkout { min-width: min(340px, 100%); }
```

**Esforço:** 30min
**Risco:** Médio

---

## Batch D: UX + A11y (Semana 4) — ~11h

### D1: Media Queries Faltantes

**Páginas que precisam de breakpoints:**

| Página | Breakpoints Necessários |
|--------|------------------------|
| `login.html` | 320px, 768px, 1024px |
| `superadmin.html` | 480px, 768px, 1024px |
| `whatsapp.html` | 480px, 768px |
| `alterar-senha.html` | 480px |

**Esforço:** 3h
**Risco:** Baixo

---

### D2: Touch Targets ≥ 44px

**Problema:** Botões com < 44px em mobile

**Adicionar em style.css:**
```css
@media (hover: none) and (pointer: coarse) {
  .btn-add,
  .btn-plus,
  .btn-minus,
  .btn-remove,
  .nav-item {
    min-height: 44px;
    min-width: 44px;
  }
}
```

**Esforço:** 1h
**Risco:** Baixo

---

### D3: Melhorias de UX

| # | Fix | Arquivo | Esforço |
|---|-----|---------|---------|
| UX1 | Feedback visual de botões mobile (active state) | Todos CSS | 1h |
| UX2 | Tabs do relatorios — manter horizontal até 480px | relatorios.html | 30min |
| UX3 | Chart.js responsivo (`responsive: true, maintainAspectRatio: false`) | relatorios.html, caixa.html | 30min |
| UX4 | Tabela de produtos com `max-height` e scroll | painelLoja.html, superadmin.html | 30min |

**Esforço:** 2.5h
**Risco:** Baixo

---

### D4: Acessibilidade

| # | Fix | Arquivo | Esforço |
|---|-----|---------|---------|
| A11y1 | `prefers-contrast: more` — aumentar contraste | style.css | 1h |
| A11y2 | Labels acessíveis em inputs sem `<label>` | index.html, cart.html, balcao.html | 2h |
| A11y3 | `aria-label` em botões de ícone sem texto | Vários HTML | 1h |

**Esforço:** 4h
**Risco:** Baixo

---

## Otimizações de Desempenho Adicionais

### 1. content-visibility: auto

```css
/* Em cards off-screen no cardápio */
.cardsMenu .card {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px;
}
```

**Impacto:** Reduz paint em 30-40% para listas longas

### 2. contain: content em cards

```css
.cardsMenu .card,
.order-card {
  contain: content;
}
```

**Impacto:** Isola layout/paint por card — evita repaints em irmãos

### 3. will-change em animações (apenas quando necessário)

```css
.order-body {
  will-change: max-height;
}

.orders-overlay {
  will-change: transform;
}
```

**Impacto:** Otimiza compositor para animações pesadas

### 4. Purge CSS não usado

- `login.css` (70 linhas) — código morto, remover
- `style.css` linhas 1186-1621 (~435 linhas) — order overlay, considerar lazy-load

### 5. Deduplicar resets

Todos os CSS declaram `*, *::before, *::after { margin:0; padding:0; box-sizing: border-box; }`

Extrair para `css/reset.css` (10 linhas) e `@import` em todos.

---

## Resumo de Esforço

| Batch | Foco | Itens | Esforço | Risco |
|-------|------|-------|---------|-------|
| **A** | Fundação | 4 | ~8h | Médio |
| **B** | Performance | 5 | ~7h | Médio |
| **C** | Estrutural | 3 | ~4h | Alto |
| **D** | UX + A11y | 4 | ~11h | Baixo |
| **Perf** | Adicionais | 5 | ~3h | Baixo |
| **Total** | | **21** | **~33h** | |

**Comparação:**
| Versão | Esforço |
|--------|---------|
| Original (responsive.md) | 42h |
| Otimizada (este doc) | 33h |
| **Redução** | **21%** |

---

## Estratégia de Testes

### Testes por Batch

| Batch | Testes Obrigatórios |
|-------|---------------------|
| A1 | Verificar que tokens.css carrega em todas as páginas |
| A2 | Abrir admin.html com isDark: true — verificar contraste |
| A3 | Abrir cada overlay individualmente — verificar z-index |
| B1 | Testar carregamento em conexão lenta (cache hit/miss) |
| B2 | Medir CLS antes/depois com Lighthouse |
| B3 | Verificar que theme.js aplica cores corretamente |
| B4 | Testar fontes em 320px, 768px, 1920px |
| B5 | Testar em iPhone com notch (Dynamic Island) |
| C1-C3 | Testar admin pages em tablet (820px) |
| D1-D4 | Testar navegação por teclado e leitor de tela |

### Dispositivos para Teste

| Prioridade | Dispositivo | Viewport |
|------------|-------------|----------|
| **Alta** | iPhone SE | 375×667 |
| **Alta** | iPhone 15 Pro Max | 430×932 |
| **Alta** | Galaxy Fold (externa) | 360×512 |
| **Alta** | iPad Air | 820×1180 |
| **Média** | Desktop | 1920×1080 |
| **Baixa** | 4K | 3840×2160 |

---

## Estratégia de Rollback

| Tipo | Estratégia |
|------|-----------|
| **CSS** | Manter valores antigos comentados; commit incremental |
| **HTML** | Alterações individuais commitadas separadamente |
| **JS** | Feature flags para dark mode |
| **Estrutural** | Branch separada + PR + deploy preview Vercel |
| **Tokens** | Manter fallbacks hardcoded nos novos arquivos |

---

## Checklist de Implementação

### Batch A
- [ ] Criar `css/tokens.css` com design tokens
- [ ] Substituir cores hardcoded em admin.html por variáveis
- [ ] Atualizar `theme.js` para setar variáveis de status
- [ ] Criar sistema de z-index com variáveis CSS
- [ ] Substituir z-index 9999 em todos os arquivos
- [ ] Adicionar `loading="lazy"` em imagens
- [ ] Adicionar `overflow-x: auto` em tabelas
- [ ] Adicionar `overscroll-behavior: contain` em overlays
- [ ] Remover `login.css` morto
- [ ] Adicionar `prefers-reduced-motion`

### Batch B
- [ ] Extrair CSS inline de relatorios.html
- [ ] Extrair CSS inline de superadmin.html
- [ ] Extrair CSS inline de login.html
- [ ] Extrair CSS inline de alterar-senha.html
- [ ] Adicionar skeleton para #showMenu
- [ ] Adicionar dimensões em #coverImg/#logoImg
- [ ] Mover theme.js para body com defer
- [ ] Aplicar clamp() em fontes principais
- [ ] Adicionar viewport-fit=cover em todas as páginas
- [ ] Substituir vh por dvh com fallback
- [ ] Adicionar env(safe-area-inset-*) em elementos fixed

### Batch C
- [ ] Extrair CSS de admin.html
- [ ] Extrair CSS de dashboard.html
- [ ] Corrigir .card.half para span 6 em ≥900px
- [ ] Corrigir min-width do checkout

### Batch D
- [ ] Adicionar media queries em login.html
- [ ] Adicionar media queries em superadmin.html
- [ ] Adicionar media queries em whatsapp.html
- [ ] Adicionar media queries em alterar-senha.html
- [ ] Aumentar touch targets para 44px
- [ ] Adicionar prefers-contrast: more
- [ ] Adicionar labels acessíveis
- [ ] Adicionar aria-label em botões de ícone
- [ ] Corrigir Chart.js responsivo
- [ ] Adicionar max-height com scroll em tabelas

---

**Fim do documento.**
*Pronto para implementação após aprovação.*
