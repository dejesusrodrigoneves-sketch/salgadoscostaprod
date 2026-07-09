# Design System — SIC D'Jesus

> **Objetivo:** Documentar o sistema de design atual (cores, tipografia, componentes, responsividade, theming) para referência e futuras melhorias.

---

## 1. Identidade Visual

### 1.1 Marca

| Atributo | Valor |
|---|---|
| Nome do sistema | SIC.ia (Sistema Integrado de Cardápio) |
| Slug da loja | `salgadoscosta` |
| Tema atual | "Vibrant Hospitality" |
| Público-alvo | Clientes finais (cardápio online) e operadores (painel admin) |

### 1.2 Conceito

Sistema de cardápio online + PDV + gestão de pedidos multi-loja com identidade visual baseada em cores vibrantes (laranja como primária), tipografia arredondada moderna e cards com cantos suaves.

---

## 2. Tokens de Design

### 2.1 Paleta de Cores (Público — `css/style.css` + `js/theme.js`)

```css
:root {
  /* Brand — Cores Principais */
  --primary:         #F26D3D;  /* Laranja Vibrante — CTAs, links, preços */
  --primary-hover:   #E05A2A;  /* Laranja escuro — hover de botões */
  --primary-bg:      #FFF0EA;  /* Laranja claro — fundo de badges/áreas destacadas */

  /* Neutras */
  --secondary:       #FFFAF8;  /* Fundo geral da página */
  --surface:         #FFFFFF;  /* Cards, modais, inputs */
  --text:            #2D1A12;  /* Texto principal (marrom escuro) */
  --text-muted:      #7C7C7C;  /* Texto secundário, labels */
  --border:          #E8E4DF;  /* Bordas de inputs, cards */

  /* Semânticas (sistema) */
  --success:         #4CAF50;  /* Verde — sucesso, ativo */
  --warning:         #F59E0B;  /* Amarelo — aviso, atenção */
  --danger:          #DC2626;  /* Vermelho — erro, perigo */
}
```

### 2.2 Paleta do Painel Admin (`css/painelstyle.css`)

```css
:root {
  --bg: #0f172a;     /* Fundo escuro */
  --card: #0b1224;   /* Card mais escuro que o fundo */
  --muted: #94a3b8;  /* Texto secundário */
  --text: #e2e8f0;   /* Texto claro */
  --brand: #22c55e;  /* Verde — botão salvar, destaque */
  --brand-2: #3b82f6;/* Azul — botão refresh */
  --warn: #f59e0b;   /* Amarelo — aviso */
  --danger: #ef4444;  /* Vermelho — perigo */
  --ok: #10b981;     /* Verde — sucesso */
  --ring: #22c55e55; /* Sombra de foco verde translúcida */
}
```

> **⚠ INCONSISTÊNCIA:** O tema público e o admin têm paletas separadas com nomes de variáveis diferentes. Nenhum consome as variáveis do outro.

### 2.3 Tema Escuro (aplicado via `js/theme.js`)

```css
:root {
  --secondary:  #0E100F;  /* Fundo escuro */
  --surface:    #191919;  /* Cards escuros */
  --text:       #FFFCE1;  /* Texto claro */
  --text-muted: #7C7C6F;  /* Texto secundário escuro */
}
```

### 2.4 Tipografia

| Nível | Fonte | Peso | Tamanho (Desktop) | Tamanho (Mobile) |
|---|---|---|---|---|
| Hero título | `Plus Jakarta Sans` | 700 | 66px | 28px |
| Hero subtítulo | `Plus Jakarta Sans` | 400 | 19px | 16px |
| Título de card | `Plus Jakarta Sans` | 600 | 16px | 14px |
| Preço | `Plus Jakarta Sans` | 700 | 20px | 18px |
| Corpo | `Plus Jakarta Sans` | 400 | 16px | 14px |
| Label/Subtítulo | `Plus Jakarta Sans` | 500 | 14px | 12px |
| Admin título | `Montserrat` (hardcoded inline) | 700 | 22px | 18px |
| Admin corpo | `Arial, sans-serif` (login) | 400 | 14px | 14px |

> **⚠ INCONSISTÊNCIA:** Admin usa Montserrat e Arial, enquanto o público usa Plus Jakarta Sans. Login.css herda Arial do navegador sem definição explícita.

### 2.5 Escala de Espaçamento

```css
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
```

### 2.6 Border Radius

```css
--radius-sm:   8px;     /* Inputs, badges pequenos */
--radius:      16px;    /* Cards, modais, container */
--radius-lg:   24px;    /* Cards grandes, hero */
--radius-pill: 9999px;  /* Botões, chips */
```

### 2.7 Sombras

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06);   /* Cards, elevação baixa */
--shadow-md: 0 4px 12px rgba(0,0,0,0.08);  /* Modais, dropdowns */
```

### 2.8 Layout

```css
--max-w: 1280px;  /* Largura máxima do conteúdo */
```

---

## 3. Componentes

### 3.1 Botões

#### Público (`style.css`)
| Variante | Classes | Estilo |
|---|---|---|
| Primary outline | `.btn` + `.card:nth-child .btn` | Borda `--primary`, texto `--primary`, `border-radius: --radius-pill`, fundo transparente |
| Primary filled (hover) | `.btn:hover` | Fundo `--primary`, texto `--surface` |
| Floating | `.whatsappFloating`, `.cartFloating` | Fixed no canto inferior direito, `border-radius: 50%`, sombra |

#### Admin (`painelstyle.css`)
| Variante | Classe | Estilo |
|---|---|---|
| Salvar | `.btn.save` | Gradiente verde (`#22c55e → #16a34a`) |
| Refresh | `.btn.refresh` | Gradiente azul |
| Pausar | `.btn.pause` | Gradiente cinza |
| Perigo | `.btn.danger` | Gradiente vermelho |
| Fantasma | `.btn.ghost` | Fundo transparente, borda |

### 3.2 Cards

#### Cardápio Público
```
┌─────────────────────┐
│  ┌───────────────┐  │
│  │    Imagem      │  │  aspect-ratio: 4/3, object-fit: cover
│  │    (200×150)   │  │  hover: scale(1.05)
│  └───────────────┘  │
│                      │
│  Nome do Produto     │  font-weight: 600, color: --text
│  Descrição curta     │  font-size: 12px, color: --text-muted
│                      │
│  R$ 12,00   R$ 15,00 │  price: bold --primary, oldPrice: riscado muted
│  [ Adicionar ]       │  botão outline → filled no hover
└─────────────────────┘
```

#### Painel Admin
```
┌──────────────────────────────────┐
│ ID  Nome       Preço   Status    │
│ 123 Coxinha     R$5,00  ● Ativo  │
│ 124 Pastel      R$7,00  ● Pausado│
│ [Editar] [Pausar] [Excluir]      │
└──────────────────────────────────┘
```

### 3.3 Modais

| Propriedade | Público (cart.js) | Admin (utils.js) |
|---|---|---|
| Fundo | Overlay escuro `rgba(0,0,0,0.5)` | `confirmModal()` retorna Promise |
| Conteúdo | `border-radius: --radius` | `border-radius: 12px` |
| Fechamento | Botão X + clique fora | Botões Confirmar/Cancelar |

### 3.4 Toast (`utils.js`)

```js
toast(msg, type) // type: 'success' (verde #4CAF50), 'warning' (laranja), 'error' (vermelho #ef4444)
```
- Posição: canto superior direito
- Duração: ~3s
- Animação: slide-in

### 3.5 Header/Status Bar

```
┌─────────────────────────────────────┐
│ ● Aberto  Seg-Sex: 08:00-18:00     │  #statusBar
│   Sáb: 08:00-12:00                  │  Cor: --success (aberto) / --danger (fechado)
└─────────────────────────────────────┘
```

### 3.6 Menu de Navegação (Mobile)

```html
<button onclick="toggleBtn()">
<span class="hamburger">...</span>
</button>
<div class="itemsMobile" style="transform: translateX(100%)">
  <!-- Links ocultos, slide-in quando toggle -->
</div>
```

---

## 4. Layout e Grid

### 4.1 Breakpoints Responsivos

| Nome | Largura | Público (style.css) | Carrinho (cart.css) | Admin (painelstyle.css) |
|---|---|---|---|---|
| Mobile pequeno | < 480px | Hero 28px, cards 1 col | — | — |
| Mobile | ≤ 600px | — | — | Row 1 col, padding reduzido |
| Mobile médio | ≤ 640px | Cards 2 col | — | — |
| Tablet | ≤ 767px | — | Container 95% | — |
| Tablet | ≤ 768px | Hero 34px, service 2 col | Sabores font-size reduzido | — |
| Tablet/Desktop | 768-1024px | — | Container 90% | — |
| Desktop médio | ≤ 900px | — | — | Cards half 100% |
| Desktop | ≥ 1024px | Cards 4 col | — | — |
| Desktop | 1025px+ | — | Container 70% | — |
| Desktop largo | ≤ 1200px | — | — | Cards half span 12 |

> **⚠ INCONSISTÊNCIA:** 3 conjuntos de breakpoints diferentes. Os limites de 767px e 768px coexistem.

### 4.2 Grid do Cardápio Público

```css
.cardsMenu {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* mobile default */
  gap: var(--s-12);
}
@media (min-width: 640px) { grid-template-columns: repeat(3, 1fr); }
@media (min-width: 1024px) { grid-template-columns: repeat(4, 1fr); }
```

### 4.3 Layout do Painel Admin

```
┌─────────────────────────────────────┐
│ [Sidebar]  [Topbar: Título | User]  │
│            ┌──────────────────────┐  │
│  Navegação │                      │  │
│  Horários  │    Conteúdo (tabs)   │  │
│  Produtos  │    Formulários       │  │
│  Categorias│    Tabelas           │  │
│  Config.   │                      │  │
│  Personal. └──────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 5. Sistema de Theming Multi-loja

### 5.1 Fluxo de Carregamento

```
1. Página carrega js/theme.js
2. theme.js:init()
   ├─ Página pública: lê <body data-slug="salgadoscosta">
   │     → GET /api/loja/settings?slug=salgadoscosta
   │     → themeSettings: { primaryColor, backgroundColor, ... }
   │
   └─ Página admin: lê authUser do localStorage
         → GET /api/loja/settings-admin (auth header)
         → themeSettings

3. applyTheme(themeSettings)
   → Injeta 14 variáveis CSS no :root

4. Fallback: localStorage 'themeCache' (TTL 5 min)
   Se cache ainda válido → usa cache
   Senão → DEFAULT_THEME (cores padrão)
```

### 5.2 Variáveis Injetadas por `theme.js`

| Variável CSS | Default (Vibrant Hospitality) |
|---|---|
| `--primary` | `#F26D3D` |
| `--primary-hover` | `#E05A2A` (calculado: `adjustBrightness(-10)`) |
| `--primary-bg` | `#FFF0EA` |
| `--secondary` | `#FFFAF8` |
| `--surface` | `#FFFFFF` |
| `--text` | `#2D1A12` |
| `--text-muted` | `#7C7C7C` |
| `--success` | `#4CAF50` |
| `--warning` | `#F59E0B` |
| `--danger` | `#DC2626` |
| `--font` | `'Plus Jakarta Sans', sans-serif` |
| `--radius` | `16px` |
| `--radius-sm` | `8px` |
| `--radius-lg` | `24px` |

### 5.3 Editor de Tema (Painel Admin)

Localizado em `painelLoja.html` aba `#tab-personalizacao`:

| Controle | Alvo | Tipo |
|---|---|---|
| Cor Primária | `#themePrimary` → `themeSettings.primaryColor` | Color picker |
| Cor de Fundo | `#themeBackground` → `themeSettings.backgroundColor` | Color picker |
| Cor de Superfície | `#themeSurface` → `themeSettings.surfaceColor` | Color picker |
| Cor de Texto | `#themeText` → `themeSettings.textColor` | Color picker |
| Modo Escuro | `#themeIsDark` → `themeSettings.isDark` | Checkbox |
| Visualizar | Atualiza `:root` em tempo real | Preview |
| Salvar | `PUT /api/loja/settings` com `themeSettings` | Botão |
| Resetar | Restaura `DEFAULT_THEME` | Botão |

### 5.4 Cobertura do Tema

| Área | Consome `theme.js`? | Observação |
|---|---|---|
| `style.css` (cardápio público) | ✅ SIM | ~911 linhas, 16 variáveis |
| `painelstyle.css` (admin) | ❌ NÃO | Variáveis próprias, ignora theme.js |
| `cart.css` (carrinho) | ❌ NÃO | Cores hardcoded |
| `login.css` (login) | ❌ NÃO | Cores hardcoded |
| CSS inline (~2500 linhas) | ❌ NÃO | Cores fixas em 12 páginas |

---

## 6. IDs e Classes JS-bound

### 6.1 index.html (consumidos por `menu.js`, `theme.js`, `navbar.js`)

| ID / Classe | JS-bound em | Uso |
|---|---|---|
| `#statusBar` | menu.js | Barra aberto/fechado |
| `#showMenu` | menu.js | Container grid de produtos |
| `#showPromotions` | menu.js | Container promoções |
| `#showAll` | menu.js | Filtro "Tudo" |
| `#showSnacks` | menu.js | Filtro "Salgadinhos" |
| `#showCombos` | menu.js | Filtro "Massas" |
| `#showPortions` | menu.js | Filtro "Salgadinhos de Festa" |
| `#showDrinks` | menu.js | Filtro "Bebidas" |
| `#showFrozen` | menu.js | Filtro "Congelados" |
| `.linkMenu` | menu.js | Botões de filtro |
| `.active` | menu.js | Filtro ativo |
| `.cardsMenu` | menu.js | Grid de cards |
| `#regCep` | menu.js | Input CEP cadastro |
| `#regEndereco` | menu.js | Input endereço cadastro |
| `#userMenuBtn` | menu.js | Toggle dropdown usuário |
| `#userDropdown` | menu.js | Dropdown login |
| `#btnLogin` | menu.js | Botão "Entrar" |
| `#btnRegister` | menu.js | Botão "Cadastrar" |
| `#daysContainer` | menu.js | Container horários |
| `#logo` | menu.js | Logo footer |
| `#whatsappFloatLink` | menu.js | Link WhatsApp flutuante |

### 6.2 view/cart.html (consumidos por `cart.js`)

| ID | JS-bound em | Uso |
|---|---|---|
| `#showItems` | cart.js | Container itens |
| `#showAllItemsValue` | cart.js | Subtotal |
| `#showDelivery` | cart.js | Taxa entrega |
| `#showDiscount` | cart.js | Desconto |
| `#showTotal` | cart.js | Total |
| `#promotionCode` | cart.js | Input cupom |
| `#generateOrder` | cart.js | Botão finalizar |
| `#formaPagamento` | cart.js | Select pagamento |
| `[name="tipoEntrega"]` | cart.js | Radio retirada/delivery |
| `#enderecoCEP` | cart.js | Input CEP |
| `#bairroCliente` | cart.js | Input bairro |
| `#campoNome` | cart.js | Campo nome |
| `#campoWhatsapp` | cart.js | Campo WhatsApp |
| `#campoEndereco` | cart.js | Campo endereço |
| `#campoBairro` | cart.js | Campo bairro |

### 6.3 painelLoja.html (consumidos por `painel.js`)

| ID | JS-bound em | Uso |
|---|---|---|
| `#tab-horarios` | painel.js | Aba horários |
| `#tab-produtos` | painel.js | Aba produtos |
| `#tab-categorias` | painel.js | Aba categorias |
| `#tab-config` | painel.js | Aba configurações |
| `#tab-personalizacao` | painel.js | Aba personalização |
| `#horarios-form` | painel.js | Formulário horários |
| `#formProduto` | painel.js | Formulário produto |
| `#tbodyProdutos` | painel.js | Tabela produtos |
| `#busca` | painel.js | Input busca produto |
| `#prodName` | painel.js | Input nome produto |
| `#prodPrice` | painel.js | Input preço produto |
| `#prodImg` | painel.js | Input imagem produto |
| `#themePrimary` | painel.js | Color picker primary |
| `#themeIsDark` | painel.js | Checkbox dark mode |

---

## 7. Problemas Identificados no Design

### 🔴 Críticos

1. **3 sistemas de cores paralelos** — público (style.css + theme.js), admin (painelstyle.css), e inline (~2500 linhas). Incoerência total de identidade visual.
2. **cart.css e login.css ignoram variáveis CSS** — cores hardcoded não respondem ao tema da loja.
3. **Admin não consome tema público** — painel tem paleta verde/azul independente do laranja do cardápio.
4. **CSS inline massivo** (~2500 linhas) — manutenção inviável, sem reaproveitamento.

### 🟡 Importantes

5. **Breakpoints inconsistentes** — 3 conjuntos diferentes (style.css, cart.css, painelstyle.css).
6. **Tipografia fragmentada** — Plus Jakarta Sans (público), Montserrat (admin inline), Arial (login.css).
7. **Dupla aplicação de tema** — `theme.js` aplica primeiro, `menu.js` reaplica depois. Potencial flicker.
8. **Sem fallback server-side** — se JS falha, tema não é aplicado.

### 🟢 Melhorias

9. **Cache curto** (5 min) — fetch frequente ao backend.
10. **Preview de tema incompleto** — dark mode não mostra preview real.
11. **Slug hardcoded** — `data-slug="salgadoscosta"` não é dinâmico.
12. **Sem componente de modal reutilizável** — cada página implementa seu próprio modal.
13. **Print/impressão não otimizado** — usa `window.print()` genérico.

---

## 8. Próximos Passos Recomendados

1. **Unificar tokens de design** em um único `:root` compartilhado entre todas as folhas
2. **Extrair CSS inline** para folhas dedicadas por página/componente
3. **Migrar cart.css e login.css** para usar variáveis do theme.js
4. **Alinhar paleta admin** com o tema público (ou criar tema separado com consistência)
5. **Padronizar breakpoints** em uma única convenção (ex: 480, 768, 1024, 1280)
6. **Criar componentes reutilizáveis** (Modal, Toast, Card, Button) com classes CSS unificadas
7. **Implementar fallback de tema no servidor** (renderizar variáveis CSS no HTML)
