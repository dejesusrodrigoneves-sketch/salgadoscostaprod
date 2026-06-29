# Análise Completa do Projeto — SIC D'Jesus

> **Sistema Integrado de Cardápio — Fábrica de Salgados Costa**
>
> **Data**: 2026-06-25 | **Versão**: 2.0.0
>
> **Escopo**: Melhorias Estruturais, Visuais, UX/UI, Segurança, Migração Firebase → NEON e Multi-Tenant

---

## Sumário Executivo

O **SIC D'Jesus** é um sistema completo de cardápio online e gestão de pedidos para uma fábrica de salgados. Atende desde o cliente final (cardápio público, carrinho, checkout) até a operação interna (painel admin, PDV, caixa, entregadores, relatórios).

### Stack Atual

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | HTML5, CSS3/SCSS, JavaScript Vanilla (ES6+) |
| **Build** | Vite 6 + Vitest 2 |
| **Banco (legado)** | Firebase Firestore (SDK v8) — **a remover** |
| **Banco (novo)** | PostgreSQL via Prisma ORM no NEON (serverless) |
| **Backend** | Node.js + Express 5 |
| **Auth** | bcryptjs + JWT customizado (Base64) |
| **Notificações** | Evolution API (WhatsApp) |
| **Mapas** | Mapbox GL, GraphHopper, Geoapify |
| **PWA** | Service Worker + Manifest |

### Estado do Projeto

O sistema é **funcional** e já passou por uma migração significativa de arquitetura (Firebase → PostgreSQL, backend monolítico → em camadas). No entanto, ainda apresenta problemas em cinco áreas críticas:

- **Estrutural**: código morto, organização de arquivos, modularização
- **Visual**: design system inexistente, inconsistências de estilo
- **UX/UI**: feedback pobre ao usuário, acessibilidade, validação frágil
- **Segurança**: chaves expostas, credenciais versionadas, auth vulnerável
- **Banco de Dados**: Firebase ainda é o banco principal no frontend — PostgreSQL (NEON) é o destino final com multi-tenant via `empresaId`

---

## 1. Melhorias Estruturais

### 1.1 Organização de Diretórios

| Problema | Localização | Risco |
|----------|-------------|-------|
| 12 arquivos HTML na raiz do projeto | `/` | Dificulta navegação e manutenção |
| Pastas `pages/admin/` e `pages/public/` vazias | `/pages/` | Placeholders não utilizados |
| Pastas `css/base/`, `css/components/`, `css/pages/` vazias | `/css/` | Estrutura planejada mas não preenchida |
| Duplicação de imagens em `img/` e `img/img/` | `/img/` e `/img/img/` | Redundância, infla o repositório |
| Backend com pasta `.git/` própria | `backend/.git/` | Sub-repositório ou clone incorreto |

**Recomendação**: Mover HTMLs para `pages/admin/` e `pages/public/`, ajustar Vite config, remover pastas não utilizadas, limpar diretório de imagens.

### 1.2 Código Morto e Duplicado

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| `js/shoppingCart.js` | ~483 | Carrinho legado, não usa Firebase, substituído por `cart.js` |
| `js/products.js` | ~276 | Array estático de produtos obsoleto — Firebase é a fonte real |
| `js/cart.js` | ~932 | Arquivo muito grande, mistura UI, cálculo, API e Firebase |

**Recomendação**: Remover `shoppingCart.js` e `products.js`. Refatorar `cart.js` em módulos menores.

### 1.3 Modularização do Frontend

| Problema | Exemplo |
|----------|---------|
| Globais `window.*` sem namespace | `window.products`, `window.userLogged`, `window.cart` |
| Múltiplas inicializações Firebase | `superadmin.html`, `entregador.html`, `alterar-senha.html` redeclaram `firebase.firestore()` |
| ES Modules vs script tags | Parte usa `import/export` (Vite), parte usa script tags globais |
| Lógica de login duplicada | `menu.js` e `login.js` têm implementações sobrepostas |

```js
// ❌ Atual: múltiplas inicializações
const db = firebase.firestore();  // superadmin.html, entregador.html, alterar-senha.html

// ✅ Ideal: centralizado em js/core/firebase-init.js
export const db = firebase.firestore();
```

### 1.4 CSS Fragmentado

| Problema | Detalhe |
|----------|---------|
| SCSS compilado + CSS inline | `style.scss` → `style.css`, mas HTMLs também têm `<style>` inline |
| CSS inline em múltiplos HTMLs | `dashboard.html`, `admin.html`, `painelLoja.html` com estilos embutidos |
| Sem padrão de nomenclatura | Classes em português e inglês misturadas, sem BEM ou similar |

**Recomendação**: Unificar todo CSS em SCSS, remover estilos inline dos HTMLs, adotar BEM ou utility-first.

### 1.5 Backend — Estrutura Atual vs Ideal

O backend **já foi refatorado** seguindo boas práticas (camadas routes → controllers → services → repositories). Pontos de atenção:

- `src/repositories/sqlRepository.js` (~164 linhas) — monolítico, ideal seria um repositório por entidade
- `src/repositories/firestoreRepository.js` — legado, pode ser removido após migração completa
- Testes ausentes na pasta `backend/tests/` (vazia)

---

## 2. Melhorias Visuais

### 2.1 Design System

Não existe um design system documentado. As cores, tipografia e espaçamentos estão espalhados pelo SCSS sem um padrão centralizado.

**Cores identificadas** (extraídas do código):

```scss
// Disperso no style.scss — não centralizado
$primary: #A90E0E;     // Vermelho escuro (marca)
$secondary: #FF7F0A;   // Laranja (CTA)
$bg: #FFFFFF;          // Fundo
$text: #333333;        // Texto
```

**Recomendação**: Criar `css/_variables.scss` com todas as tokens de design:

```scss
// Tokens centralizadas
$colors: (
  'primary': #A90E0E,
  'primary-hover': #8C0B0B,
  'secondary': #FF7F0A,
  'secondary-hover': #E67200,
  'success': #28A745,
  'danger': #DC3545,
  'warning': #FFC107,
  'info': #17A2B8,
  'bg': #FFFFFF,
  'bg-alt': #F8F9FA,
  'text': #333333,
  'text-light': #666666,
);

$fonts: (
  'primary': 'Montserrat',
  'size-base': 16px,
  'size-sm': 14px,
  'size-lg': 18px,
  'size-xl': 24px,
);

$spacing: (
  'xs': 4px,
  'sm': 8px,
  'md': 16px,
  'lg': 24px,
  'xl': 32px,
);
```

### 2.2 Tipografia Inconsistente

| Página | Fonte |
|--------|-------|
| `index.html` (público) | Montserrat |
| `dashboard.html`, `admin.html` (admin) | Inter |
| `login.html` | Inter |

**Recomendação**: Unificar em uma única família tipográfica. Montserrat para consistência com a marca, ou Inter para melhor legibilidade em admin.

### 2.3 Componentes sem Padrão

| Componente | Estado Atual | Recomendação |
|-----------|-------------|-------------|
| **Botões** | `.btn` com `background: #FF7F0A` | Variantes `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-outline` |
| **Cards** | `.card` com `border-radius: 15px` | Padronizar sombra, padding, hover effect |
| **Modais** | Criados dinamicamente em JS | Componente reutilizável com overlay, animação, focus trap |
| **Toasts** | Toastify + inline + `alert()` | Unificar em sistema único |
| **Tabelas** | Estilo inline nos HTMLs | Componente `.table` com header fixo, zebrado, responsivo |
| **Forms** | Sem estilos de estado | Adicionar `.is-valid`, `.is-invalid`, `.is-loading` |

### 2.4 Responsividade

| Problema | Detalhe |
|----------|---------|
| Breakpoints definidos no SCSS | `< 768px` (95%), `768-1024px` (90%), `> 1025px` (70%, max 1500px) |
| Modal de sabores em mobile | Pode ficar muito largo, sem scroll adequado |
| Tabelas em admin sem scroll horizontal | Dados podem vazar em telas pequenas |
| Navbar mobile | Implementado com hamburger, mas falha em alguns submenus |

**Recomendação**: Revisar modais para mobile (fullscreen ou bottom-sheet), adicionar `overflow-x: auto` em tabelas, testar em 320px+.

### 2.5 Estados de Carregamento e Vazio

| Página | Loading | Empty State |
|--------|---------|-------------|
| Cardápio (`index.html`) | ❌ | ❌ |
| Admin pedidos | ❌ | ❌ |
| Painel produtos | ✅ Skeleton (`showSkeleton`) | ❌ |
| Relatórios | ❌ | ❌ |
| Carrinho | ❌ | ❌ |

**Recomendação**: Implementar skeleton loading em todas as listas e empty states com ilustração e mensagem amigável.

### 2.6 Tema Escuro

Não implementado. Seria um diferencial considerando que o painel admin é usado por horas seguidas.

```scss
:root {
  --bg: #FFFFFF;
  --text: #333333;
  --card-bg: #FFFFFF;
}

[data-theme="dark"] {
  --bg: #1A1A2E;
  --text: #E0E0E0;
  --card-bg: #16213E;
}
```

---

## 3. Melhorias UX/UI

### 3.1 Feedback ao Usuário

O maior problema de UX do projeto é a **inconsistência de feedback**. Três sistemas de notificação coexistem:

| Sistema | Onde | Problema |
|---------|------|----------|
| `alert()` nativo | `entregador.html`, `superadmin.html`, `balcao.html`, `cart.js` | Bloqueante, sem estilo |
| `confirm()` nativo | `entregador.html` | Bloqueante |
| Toastify (CDN) | `menu.js`, `cart.js` (parcialmente) | Biblioteca externa em desuso |
| Toasts inline (`utils.js`) | Vários arquivos | Já implementado e superior |

**Recomendação**: Eliminar todo `alert()` e `confirm()` do código. Usar apenas o sistema de toasts inline de `utils.js`. Remover dependência do Toastify CDN.

```js
// utils.js — usar este, padronizar
showToast('Pedido criado com sucesso!', 'success');
showToast('Erro ao salvar produto', 'error');
showToast('Aguardando pagamento...', 'info');
```

### 3.2 Validação de Formulários

| Problema | Detalhe |
|----------|---------|
| Validação apenas no submit | Usuário só descobre erros após clicar |
| Sem máscaras de input | Telefone, CEP, CPF sem formatação |
| Sem estilos visuais de erro | Nenhum campo fica vermelho, só mensagem de texto |
| Sem validação em tempo real | `onblur` ou `oninput` não utilizados |

**Recomendação**: Implementar validação inline:

```js
// utils.js — função de validação reutilizável
function validateField(input, rules) {
  const value = input.value.trim();
  let error = null;

  if (rules.required && !value) error = 'Campo obrigatório';
  else if (rules.minLength && value.length < rules.minLength)
    error = `Mínimo de ${rules.minLength} caracteres`;
  else if (rules.pattern && !rules.pattern.test(value))
    error = rules.message || 'Formato inválido';

  input.classList.toggle('is-invalid', !!error);
  input.classList.toggle('is-valid', !error && value.length > 0);
  const feedback = input.parentElement.querySelector('.invalid-feedback');
  if (feedback) feedback.textContent = error || '';
  return !error;
}
```

Máscaras sugeridas:

```js
function maskPhone(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    if (v.length > 10) v = `${v.slice(0,10)}-${v.slice(10)}`;
    input.value = v;
  });
}
```

### 3.3 Performance Percebida

| Problema | Impacto |
|----------|---------|
| Imagens sem `loading="lazy"` | Carregamento desnecessário de imagens abaixo da dobra |
| Sem skeleton/spinner em requisições | Usuário não sabe se algo está carregando |
| Re-renderização completa do DOM no admin | `admin.html` substitui `innerHTML` inteiro a cada `onSnapshot` |
| Sem cache local de produtos | Cada visita ao cardápio = N reads no Firestore |

```html
<img src="..." alt="..." loading="lazy" />
```

```js
// Cache local simples com sessionStorage
async function getCachedProducts() {
  const cached = sessionStorage.getItem('products');
  if (cached) return JSON.parse(cached);
  const products = await loadProducts();
  sessionStorage.setItem('products', JSON.stringify(products));
  return products;
}
```

### 3.4 Acessibilidade

| Critério | Estado Atual |
|----------|-------------|
| `aria-label` em botões de ação | Ausente |
| `role` em elementos interativos | Ausente |
| Focus trap em modais | Ausente |
| Navegação por teclado (Tab) | Parcial (sem ordem lógica) |
| Contraste de cores | A verificar |
| Textos alternativos em imagens | Parcial |

**Recomendação mínima**:

```html
<button aria-label="Fechar modal" onclick="closeModal()">×</button>
<button aria-label="Adicionar ao carrinho">Comprar</button>
```

```js
// Focus trap em modais
function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === 'Escape') closeModal();
  });
  first.focus();
}
```

### 3.5 Fluxo do Cliente (Checkout)

Fluxo atual: `Cardápio → Adicionar ao carrinho → Carrinho → Login/Cadastro → Checkout → Confirmar → Pedido criado`

**Atritos identificados**:

1. **Login obrigatório para finalizar** — cliente precisa criar conta mesmo para retirada
2. **Modal de sabores complexo** — UX confusa para produtos com múltiplos sabores
3. **Sem confirmação visual** — após criar pedido, não há tela de "Pedido confirmado!"
4. **Sem rastreamento pós-pedido** — cliente não consegue ver status do pedido

**Recomendação**: Permitir pedido sem login, simplificar modal de sabores, adicionar tela de confirmação pós-pedido, adicionar página de rastreamento público via link do WhatsApp.

### 3.6 Debounce e Otimizações de Input

```js
// Implementar em cart.js e menu.js
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

cepInput.addEventListener('input', debounce(async () => {
  if (cepInput.value.length === 8) {
    const address = await fetchAddress(cepInput.value);
    fillAddress(address);
  }
}, 500));
```

---

## 4. Melhorias de Segurança

> Uma análise de segurança detalhada já existe em [`docs/analise_seguranca.md`](./analise_seguranca.md).
> Esta seção resume os achados críticos e complementa com o estado atual das correções.

### 4.1 Resumo de Vulnerabilidades

| # | Vulnerabilidade | Localização | Severidade | Status |
|---|---------------|-------------|-----------|--------|
| 1 | Chaves de API expostas no frontend (Geoapify, Mapbox, GraphHopper) | `cart.js:709`, `entregador.html:199-201` | **Crítico** | ❌ |
| 2 | Arquivos de API key na raiz do projeto | `api google iaStudio.txt`, `api openrouter ai.txt` | **Crítico** | ❌ |
| 3 | `.env` versionado com Evolution API key | `backend/.env` | **Crítico** | ❌ |
| 4 | Senha superadmin hardcoded no seed | `backend/scripts/seed.js` | **Crítico** | ❌ |
| 5 | postMessage sem validação de origem (`"*"`) | `dashboard.html:615`, `admin.html:697` | **Alto** | ❌ |
| 6 | WebSocket de rastreamento sem autenticação | `entregador.html:201` | **Alto** | ❌ |
| 7 | Auth token em localStorage (vulnerável a XSS) | `localStorage.getItem('authUser')` | **Alto** | ❌ |
| 8 | Hashing bcrypt no cliente (legacy) | `menu.js:378,421` | **Alto** | ⚠️ |
| 9 | Firebase Security Rules não auditáveis | Console Firebase | **Alto** | ❌ |
| 10 | Catch vazios sem tratamento de erro | `admin.html:759,768,794` | **Médio** | ❌ |
| 11 | Upload sem validação de magic bytes | `uploadRoutes.js` | **Médio** | ❌ |
| 12 | Sem Content-Security-Policy configurada | `backend/src/app.js` | **Médio** | ❌ |

### 4.2 Correções Prioritárias Imediatas

#### 4.2.1 Remover Chaves de API do Frontend

Criar endpoints proxy no backend (já existe `proxyRoutes.js` — ampliar):

```js
// backend/src/routes/proxyRoutes.js
router.get('/geoapify/geocode', async (req, res) => {
  const { text } = req.query;
  const response = await axios.get(
    `https://api.geoapify.com/v1/geocode/search?text=${text}&apiKey=${process.env.GEOAPIFY_KEY}`
  );
  res.json(response.data);
});
```

```js
// cart.js — ❌ Antes
const geo = await fetch(
  `https://api.geoapify.com/v1/geocode/search?text=${endereco}&apiKey=AIzaSy...`
);

// cart.js — ✅ Depois
const geo = await fetch(`/api/proxy/geoapify/geocode?text=${endereco}`);
```

#### 4.2.2 Proteger `.env` e Credenciais

```bash
git rm --cached backend/.env
git rm --cached "api google iaStudio.txt"
git rm --cached "api openrouter ai.txt"
echo "backend/.env" >> .gitignore
echo "api *.txt" >> .gitignore
```

#### 4.2.3 Validar Origem no postMessage

```js
window.addEventListener('message', (event) => {
  const allowedOrigins = [
    'https://salgadoscosta.com.br',
    window.location.origin
  ];
  if (!allowedOrigins.includes(event.origin)) return;
  // processamento
});
```

#### 4.2.4 Migrar Auth Token para Cookie HttpOnly

```js
// backend — configurar cookie
res.cookie('authToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000
});
```

### 4.3 Boas Práticas

```js
// ❌ Catch vazio
.catch(() => {});

// ✅ Catch com feedback
.catch((err) => {
  console.error('Erro:', err);
  showToast('Erro ao processar. Tente novamente.', 'error');
});
```

```js
// ❌ innerHTML sem sanitização
div.innerHTML = `<p>${produto.nome}</p>`;

// ✅ textContent ou sanitizar
div.textContent = produto.nome;
div.innerHTML = `<p>${escapeHtml(produto.nome)}</p>`;
```

---

## 5. Plano de Ação Consolidado — Roteiro Otimizado

### Visão Geral das Tracks

O plano foi organizado em **6 tracks paralelas** executadas em sequência otimizada. A ordem recomendada:

```
Track A  🔴 Segurança & Limpeza    │ Semana 1      │ 4h
Track B  🟡 UX Quick Wins          │ Semana 1-2    │ 6h     (paralelo à A)
Track C  🟢 Migração Firebase→NEON │ Semanas 2-5   │ 19 dias
Track D  🔵 Design System & Visual │ Semanas 3-5   │ 25h    (paralelo à C)
Track E  🟣 Auth & Infra           │ Semanas 6-7   │ 18h    (após Track C)
Track F  ⚪ Longo Prazo            │ Mês 3+        │ 80h+
```

### Track A — 🔴 Segurança & Limpeza (Semana 1)

*Pode começar imediatamente. Sem dependências. Elimina riscos financeiros e de imagem.*

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| A1 | Remover chaves de API do frontend (criar proxy no backend) | 2h | Crítico |
| A2 | Remover `.env` e API keys do versionamento (git rm + .gitignore) | 30min | Crítico |
| A3 | Validar origem no `postMessage` (`dashboard.html`, `admin.html`) | 15min | Alto |
| A4 | Esconder senha superadmin em variável de ambiente | 15min | Crítico |
| A5 | Remover `shoppingCart.js` e `products.js` (código morto) | 15min | Médio |
| A6 | Adicionar catch com feedback ao usuário nos `.catch(() => {})` | 1h | Médio |
| | **Total** | **~4h** | |

### Track B — 🟡 UX Quick Wins (Semana 1-2)

*Paralelo à Track A. Melhorias rápidas que o usuário percebe.*

| # | Ação | Esforço |
|---|------|---------|
| B1 | Adicionar `loading="lazy"` em imagens de produtos | 30min |
| B2 | Substituir `alert()`/`confirm()` nativos por toasts inline | 2h |
| B3 | Adicionar debounce (300ms) no input de CEP | 15min |
| B4 | Padronizar toasts (remover dependência Toastify CDN) | 1h |
| B5 | Implementar máscaras de input (telefone `(XX) XXXXX-XXXX`, CEP) | 2h |
| | **Total** | **~6h** |

### Track C — 🟢 Migração Firebase → NEON (Semanas 2-5)

*Track principal. Começa após Track A. Desbloqueia multi-tenant, performance e segurança real.*

#### Semana 2 — Setup + Dados

| # | Ação | Esforço |
|---|------|---------|
| C1 | Provisionar NEON, configurar `DATABASE_URL`, rodar migrations + seed | 2 dias |
| C2 | Adicionar modelo `Cliente` no Prisma, rodar migration | — |
| C3 | Criar `publicRoutes.js` — endpoints públicos (produtos, clientes, pedidos, loja, cupons) | 2 dias |
| C4 | Exportar dados do Firebase e importar no NEON | 2 dias |

#### Semana 3 — Primeiras páginas

| # | Ação | Esforço |
|---|------|---------|
| C5 | Migrar `painel.js` — produtos CRUD via API (substituir Firebase) | 2 dias |
| C6 | Migrar `menu.js` — cardápio via API pública + slug | 2 dias |
| C7 | Migrar `menu.js` — cadastro/login de clientes via API | — |

#### Semana 4 — Carrinho + PDV + Admin

| # | Ação | Esforço |
|---|------|---------|
| C8 | Migrar `cart.js` — carrinho 100% via API pública | 2 dias |
| C9 | Migrar `balcao.html` (PDV) — produtos e pedidos via API | 1 dia |
| C10 | Migrar demais páginas (admin, dashboard, relatorios, superadmin, entregador) | 2 dias |

#### Semana 5 — Finalização

| # | Ação | Esforço |
|---|------|---------|
| C11 | Remover SDK Firebase de todos os HTMLs + pacotes npm | 1 dia |
| C12 | Testar fluxo completo (cadastro → cardápio → carrinho → pedido) | 3 dias |
| C13 | Testar multi-loja (criar 2ª empresa, verificar isolamento) | — |

> Detalhamento completo de cada endpoint e migração página-a-página na **Seção 6**.

### Track D — 🔵 Design System & Visual (Semanas 3-5)

*Paralelo à Track C. Enquanto um dev migra o banco, outro melhora o visual.*

| # | Ação | Esforço | Semana |
|---|------|---------|--------|
| D1 | Criar design system SCSS (tokens: cores, tipografia, spacing) | 4h | 3 |
| D2 | Remover CSS inline dos HTMLs para arquivos SCSS | 3h | 3 |
| D3 | Unificar tipografia (escolher Montserrat ou Inter) | 1h | 3 |
| D4 | Adicionar skeletons e empty states em todas as listas | 3h | 4 |
| D5 | Implementar validação inline nos formulários (is-valid/is-invalid) | 3h | 4 |
| D6 | Implementar ARIA labels e focus trap em modais | 4h | 5 |
| D7 | Adicionar transições CSS em modais e toasts | 2h | 5 |
| D8 | Implementar tema escuro (CSS custom properties) | 3h | 5 |
| D9 | Mover HTMLs para `pages/admin/` e `pages/public/`, ajustar Vite | 2h | 5 |
| | **Total** | **~25h** | |

### Track E — 🟣 Auth & Infra (Semanas 6-7)

*Começa após Track C estabilizar. Foco em segurança de sessão e infraestrutura.*

| # | Ação | Esforço |
|---|------|---------|
| E1 | Migrar auth token de localStorage para HttpOnly cookie | 4h |
| E2 | Adicionar Content-Security-Policy header customizado | 30min |
| E3 | Validar magic bytes no upload de imagens (não só extensão) | 1h |
| E4 | Melhorar PWA (página offline, background sync de pedidos) | 4h |
| E5 | Adicionar tela de confirmação pós-pedido | 3h |
| E6 | Adicionar página de rastreamento público (via link WhatsApp) | 4h |
| E7 | Implementar cache local (sessionStorage) para produtos do cardápio | 1h |
| | **Total** | **~18h** |

### Track F — ⚪ Longo Prazo (Mês 3+)

*Após tudo estabilizado. Melhorias estruturais e de qualidade.*

| # | Ação | Esforço |
|---|------|---------|
| F1 | Refatorar frontend para framework (React/Vue/Svelte) | 40h+ |
| F2 | Implementar testes E2E (Playwright) | 20h+ |
| F3 | CI/CD pipeline (GitHub Actions) | 8h |
| F4 | Fila de processamento (BullMQ) para notificações WhatsApp | 8h |
| F5 | Migrar JWT customizado (base64) para padrão HS256 | 4h |

### Timeline Visual Consolidada

```
         Track A (segurança)
Semana 1 |■■■■■■■■■■■■■■■■■■■■|  4h
         Track B (UX quick wins)
         |■■■■■■■■■■■■■■■■■■■■|  6h

         Track C (migração NEON)
Semana 2 |■■■■■■■■■■■■■■■■■■■■|  setup + dados
Semana 3 |■■■■■■■■■■■■■■■■■■■■|  painel + menu via API
Semana 4 |■■■■■■■■■■■■■■■■■■■■|  cart + balcao + admin
Semana 5 |■■■■■■■■■■■■■■■■■■■■|  remover Firebase + testes
         Track D (design system)
         |■■■■■■|              Semana 3
         |■■■■■■■■|            Semana 4
         |■■■■■■■■|            Semana 5

         Track E (auth + infra)
Semana 6 |■■■■■■■■■■■■■■■■■■■■|  18h
Semana 7 |■■■■■■■■■■■■■■■■■■■■|  ajustes finos

         Track F (longo prazo)
Mês 3+   |····················|  framework, testes, CI/CD
```

### Rota Recomendada

1. **Sprint 1 (Semana 1)** — Foco total em **Track A** + **Track B**. Segurança crítica resolvida em horas, UX quick wins entregues. O sistema já fica mais seguro e agradável sem mudanças estruturais.

2. **Sprint 2-3 (Semanas 2-3)** — **Track C** começa com NEON + endpoints públicos. **Track D** começa em paralelo (outro dev). Produtos e clientes migrados para API.

3. **Sprint 4 (Semana 4)** — **Track C** termina com cart, balcão, admin. **Track D** continua com skeletons e validação.

4. **Sprint 5 (Semana 5)** — Firebase removido. Testes multi-loja. **Track D** finaliza com ARIA, dark mode e pages organizadas.

5. **Sprint 6-7 (Semanas 6-7)** — **Track E**: auth com HttpOnly, CSP, PWA, rastreamento.

6. **Mês 3+** — **Track F**: framework, testes, CI/CD (se ainda fizer sentido).

## 6. Migração Firebase → NEON + Multi-Tenant

### 6.1 Visão Geral

O sistema atualmente opera em **modo híbrido**: o backend já usa PostgreSQL via Prisma (apontando para um banco local ou Railway), mas o frontend ainda consome Firebase Firestore diretamente para produtos, pedidos, clientes e cupons. O objetivo é:

1. **Migrar todo o banco para NEON** (serverless PostgreSQL, free tier 500MB)
2. **Remover completamente o Firebase** do frontend e backend
3. **Implementar multi-tenant completo**: cada loja com seus próprios produtos, clientes e pedidos, isolados por `empresaId`
4. **Clientes cadastrados por loja**: quando um cliente se cadastra no cardápio público (`index.html`) ou no PDV (`balcao.html`), ele é vinculado à loja específica via slug

### 6.2 Diagnóstico — O Que Ainda Usa Firebase

#### Frontend (Firebase Firestore direto)

| Arquivo | Coleções Firebase | Uso |
|---------|------------------|-----|
| `js/menu.js` | `products`, `users`, `settings/horarios`, `orders` | Cardápio público, cadastro/login clientes |
| `js/cart.js` | `products`, `pedidos`, `cupons`, `counters` | Carrinho, finalização de pedido |
| `js/painel.js` | `products`, `settings/horarios` | Painel loja (parcialmente migrado — categorias já usam API) |
| `balcao.html` | `products` | PDV |
| `admin.html` | `pedidos` (onSnapshot) | Acompanhamento de pedidos |
| `dashboard.html` | Firebase SDK (verificar) | Dashboard |
| `superadmin.html` | `usuarios` | Superadmin |
| `relatorios.html` | `relatoriosdeCaixa` | Relatórios |
| `entregador.html` | `entregadores` | Gestão entregadores |
| `alterar-senha.html` | Firebase auth | Alterar senha |

#### Backend (firebase-admin)

| Arquivo | Uso |
|---------|-----|
| `backend/src/repositories/firestoreRepository.js` | Repositório legado (paralelo ao SQL) |
| `backend/src/services/whatsappService.js` (possível) | Verificar dependência |

### 6.3 Schema — Modelo `Cliente`

Adicionar ao `backend/prisma/schema.prisma`:

```prisma
model Cliente {
  id              Int      @id @default(autoincrement())
  empresaId       Int      @map("empresa_id")
  empresa         Empresa  @relation(fields: [empresaId], references: [id])
  nome            String
  telefone        String
  passwordHash    String?  @map("password_hash")
  endereco        String?
  numero          String?
  bairro          String?
  cep             String?
  cidade          String?
  estado          String?
  pontoReferencia String?  @map("ponto_referencia")
  createdAt       DateTime @default(now()) @map("criado_em")

  @@unique([empresaId, telefone])
  @@map("clientes")
}
```

Rodar migration:

```bash
npx prisma migrate dev --name add_clientes
```

Adicionar repositório em `backend/src/repositories/sqlRepository.js`:

```js
async buscarCliente(empresaId, telefone) {
  return prisma.cliente.findUnique({ where: { empresaId_telefone: { empresaId, telefone } } });
},
async criarCliente(data) {
  return prisma.cliente.create({ data });
},
async atualizarCliente(id, data) {
  return prisma.cliente.update({ where: { id }, data });
},
```

### 6.4 Endpoints Públicos (slug-based)

Criar `backend/src/routes/publicRoutes.js`:

```js
const { Router } = require('express');
const sql = require('../repositories/sqlRepository');
const bcrypt = require('bcryptjs');

const router = Router();

// GET /api/public/produtos?slug=salgadoscosta
router.get('/produtos', async (req, res) => {
  const { slug } = req.query;
  const empresa = await sql.buscarEmpresaPorSlug(slug || 'salgadoscosta');
  if (!empresa) return res.status(404).json({ error: 'Loja não encontrada' });
  const produtos = await sql.listarProdutos(empresa.id);
  const ativos = produtos.filter(p => p.status !== 'paused' && p.status !== 'removed');
  res.json(ativos);
});

// POST /api/public/clientes
router.post('/clientes', async (req, res) => {
  const { slug, nome, telefone, password, endereco, numero, bairro, cep, cidade, estado, pontoReferencia } = req.body;
  if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone obrigatórios' });

  const empresa = await sql.buscarEmpresaPorSlug(slug);
  if (!empresa) return res.status(404).json({ error: 'Loja não encontrada' });

  const existing = await sql.buscarCliente(empresa.id, telefone);
  if (existing) return res.status(409).json({ error: 'Cliente já cadastrado' });

  const hash = password ? await bcrypt.hash(password, 10) : null;
  const cliente = await sql.criarCliente({
    empresaId: empresa.id, nome, telefone,
    passwordHash: hash,
    endereco, numero, bairro, cep, cidade, estado, pontoReferencia,
  });
  res.status(201).json(cliente);
});

// POST /api/public/pedidos
router.post('/pedidos', async (req, res) => {
  const orderService = require('../services/orderService');
  const { slug, ...orderData } = req.body;
  const empresa = await sql.buscarEmpresaPorSlug(slug);
  if (!empresa) return res.status(404).json({ error: 'Loja não encontrada' });
  const pedido = await orderService.criar({ ...orderData, empresaId: empresa.id });
  res.status(201).json(pedido);
});

// GET /api/public/loja?slug=salgadoscosta
router.get('/loja', async (req, res) => {
  const { slug } = req.query;
  const empresa = await sql.buscarEmpresaPorSlug(slug || 'salgadoscosta');
  if (!empresa) return res.status(404).json({ error: 'Loja não encontrada' });
  res.json({
    nome: empresa.nome, slug: empresa.slug, logo: empresa.logo,
    telefone: empresa.telefone, descricao: empresa.descricao,
    endereco: empresa.endereco, bairro: empresa.bairro,
    cidade: empresa.cidade, estado: empresa.estado,
    cep: empresa.cep, openingTime: empresa.openingTime,
    closingTime: empresa.closingTime, isOpen: empresa.isOpen,
  });
});

module.exports = router;
```

Registrar em `backend/src/app.js`:

```js
const publicRoutes = require('./routes/publicRoutes');
app.use('/api/public', publicRoutes);
```

### 6.5 Identificação da Loja no Frontend (Slug)

Cada página pública precisa saber de qual loja está carregando dados:

```js
function getSlug() {
  // 1. Query param: ?slug=nomedaloja
  const params = new URLSearchParams(window.location.search);
  if (params.get('slug')) return params.get('slug');

  // 2. Subdomínio: nomedaloja.dominio.com.br
  const host = window.location.hostname.split('.');
  if (host.length >= 3) return host[0];

  // 3. Fallback (comportamento atual)
  return 'salgadoscosta';
}
```

Usar em todas as chamadas à API pública:

```js
const slug = getSlug();
const res = await fetch(`/api/public/produtos?slug=${slug}`);
```

Nos links entre páginas, propagar o slug:

```html
<a href="view/cart.html?slug=salgadoscosta">Carrinho</a>
```

### 6.6 Migração — Frontend

#### 6.6.1 painel.js — Produtos via API

Substituir operações Firebase por chamadas à API com JWT:

```js
// ANTES (Firebase):
const snapshot = await db.collection("products").get();
snapshot.forEach(doc => { products.push(doc.data()); });

// DEPOIS (API - já autenticado via JWT):
async function carregarProdutos() {
  const data = await apiRequest('/produtos'); // GET /api/produtos
  renderTabela(data);
}

// Criar produto:
await apiRequest('/produtos', {
  method: 'POST',
  body: JSON.stringify({ name, price, description, type, ... })
});

// Atualizar:
await apiRequest(`/produtos/${id}`, {
  method: 'PUT',
  body: JSON.stringify({ name, price, ... })
});

// Deletar:
await apiRequest(`/produtos/${id}`, { method: 'DELETE' });
```

#### 6.6.2 menu.js — Cardápio e Clientes via API

**Produtos** (substituir `onSnapshot` do Firebase):

```js
// ANTES: db.collection("products").orderBy("id").onSnapshot(...)
// DEPOIS:
async function loadProducts() {
  const slug = getSlug();
  const res = await fetch(`/api/public/produtos?slug=${slug}`);
  const data = await res.json();
  products = data.filter(p => p.status !== "removed" && p.status !== "paused");
  showProducts(0);
  allPromotions();
}
loadProducts();
setInterval(loadProducts, 30000); // polling a cada 30s
```

**Cadastro de cliente** (substituir Firebase):

```js
// ANTES: db.collection("users").doc(phone).set({ ... })
// DEPOIS:
const slug = getSlug();
await fetch('/api/public/clientes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slug, nome, telefone: phone, password,
    endereco, numero, bairro, cep, cidade, estado,
  })
});
```

#### 6.6.3 cart.js — Carrinho via API

Substituir todas as operações Firebase:

| Operação | Firebase (remover) | API (novo) |
|----------|-------------------|------------|
| Carregar produtos | `db.collection("products").get()` | `fetch('/api/public/produtos?slug=X')` |
| Validar cupom | `db.collection("cupons").doc(code).get()` | `fetch('/api/public/cupons/X?slug=X')` |
| Gerar ID pedido | `db.collection("counters")...transaction` | `POST /api/public/pedidos` (auto) |
| Salvar pedido | `db.collection("pedidos").doc(id).set()` | `POST /api/public/pedidos` |

#### 6.6.4 balcao.html — PDV via API

```js
// ANTES: db.collection("products").get()
// DEPOIS:
const token = localStorage.getItem('authUser')?.token;
const res = await fetch('/api/produtos', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const produtos = await res.json();
```

#### 6.6.5 Demais páginas

Seguir o mesmo padrão: identificar o que usa Firebase, substituir por chamada à API correspondente. Checklist completo:

| Página | Firebase → API |
|--------|---------------|
| `admin.html` | `pedidos` → `GET /api/pedidos` (com JWT) |
| `dashboard.html` | Verificar dependências e migrar |
| `relatorios.html` | `relatoriosdeCaixa` → `GET /api/caixa/relatorios` |
| `superadmin.html` | `usuarios` → `GET/POST /api/admin/usuarios` |
| `entregador.html` | `entregadores` → `GET/POST /api/entregadores` |
| `alterar-senha.html` | Firebase → `PUT /api/auth/change-password` |

### 6.7 Migração — Dados

#### 6.7.1 Script de exportação/importação

Usar ou atualizar os scripts existentes em `backend/scripts/`:

```bash
# 1. Exportar Firebase → JSON
node scripts/exportFirestore.js

# 2. Transformar JSON → SQL INSERTs
node scripts/transformToSql.js

# 3. Importar no NEON
psql $DATABASE_URL -f output/import.sql
```

#### 6.7.2 Mapeamento coleções → tabelas

| Coleção Firebase | Tabela PostgreSQL | observação |
|-----------------|-------------------|------------|
| `products` | `produtos` | Adicionar `empresa_id = 1` nos existentes |
| `pedidos` | `pedidos` + `itens_pedido` | Parsear campo `itens` (string) para linhas |
| `users` | `clientes` | Mapear `phone` → `telefone`, adicionar `empresa_id = 1` |
| `usuarios` | `usuarios` | Já existe, verificar duplicatas |
| `cupons` | `cupons` | Adicionar `empresa_id` |
| `counters` | `counters` | Já existe |
| `settings/horarios` | `horarios` | Vincular à empresa |
| `entregadores` | `entregadores` | Já migrado |
| `caixa` | `caixa_diario` | Já migrado |
| `relatoriosdeCaixa` | `caixa_diario` | Mesclar com caixa |

### 6.8 Remoção do Firebase

Após toda a migração do frontend, remover:

**De todos os HTMLs** (14 arquivos):

```diff
- <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
- <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
- <script src="js/firebase-init.js"></script>
```

**Arquivos a deletar**:

```bash
git rm js/firebase-init.js
git rm backend/src/repositories/firestoreRepository.js
```

**Dependências npm**:

```bash
# Frontend
npm uninstall firebase

# Backend
cd backend
npm uninstall firebase-admin
```

### 6.9 Arquitetura Final (pós-migração)

```
                    FRONTEND (Vite)
                    
  Páginas Públicas:          Páginas Admin:
  index.html (slug=X)        login.html (JWT)
  view/cart.html (slug=X)    painelLoja.html (JWT)
                             admin.html (JWT)
                             balcao.html (JWT)

  API Client único: fetch() para /api/*
                    Token: JWT (admin) ou slug (público)
                              │
                              ▼
                    BACKEND (Express + Prisma)
                    
  /api/public/*  (sem auth → slug)
    ├── GET  /produtos?slug=X
    ├── POST /clientes
    ├── POST /pedidos
    ├── GET  /loja?slug=X
    └── GET  /cupons/:codigo?slug=X

  /api/*  (com JWT → empresaId do token)
    ├── produtos, pedidos, categorias
    ├── entregadores, caixa, horarios
    ├── admin (superadmin)
    └── auth/login

  Middleware: authenticate → req.user.empresaId
                              │
                              ▼
                    NEON (Serverless PostgreSQL)
                    
  empresas | produtos | clientes | usuarios
  pedidos | itens_pedido | categorias | entregadores
  caixa_diario | horarios | counters | cupons
  whatsapp_instances

  Toda tabela tem empresa_id → isolamento multi-tenant
```

### 6.10 Plano de Ação Detalhado (Track C — 4 semanas)

> Este plano corresponde à **Track C** do roteiro consolidado (Seção 5). As tracks A, B, D, E e F rodam em paralelo conforme indicado na Seção 5.

| Semana | Dia | Tarefa | Código |
|--------|-----|--------|--------|
| **2** | 1-2 | Provisionar NEON, configurar DATABASE_URL, rodar migrations + seed | C1 |
| | 2-3 | Adicionar modelo `Cliente` no Prisma, rodar migration | C2 |
| | 3-4 | Criar `publicRoutes.js` (produtos, clientes, pedidos, loja) | C3 |
| | 4-5 | Exportar dados do Firebase e importar no NEON | C4 |
| **3** | 1-2 | Migrar `painel.js` — produtos CRUD para API | C5 |
| | 2-3 | Migrar `menu.js` — produtos via API + slug | C6 |
| | 3 | Migrar `menu.js` — cadastro/login clientes via API | C7 |
| | 4 | Migrar `cart.js` — carrinho via API pública | C8 |
| | 5 | Migrar `balcao.html` — produtos e pedidos via API | C9 |
| **4** | 1 | Migrar `admin.html` — pedidos via API | C10 |
| | 2 | Migrar `dashboard.html`, `relatorios.html`, `caixa.html` | C10 |
| | 3 | Migrar `superadmin.html`, `entregador.html`, `alterar-senha.html` | C10 |
| | 4 | Remover SDK Firebase de todos os HTMLs | C11 |
| | 5 | Remover `firebase-init.js`, pacotes npm, testar | C11 |
| **5** | 1-2 | Testar fluxo completo: cadastro → cardápio → carrinho → pedido | C12 |
| | 2-3 | Testar multi-loja: criar 2ª empresa, produtos isolados | C13 |
| | 3-4 | Testar admin: painel, PDV, relatórios, entregadores | C12 |
| | 4-5 | Corrigir bugs, atualizar docs, deploy | C12 |

### 6.11 Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Perda de dados na migração | Média | Manter Firebase ativo em paralelo até validação completa |
| Slug routing quebra URLs/bookmarks existentes | Baixa | Fallback para `salgadoscosta` (comportamento atual) |
| Performance sem `onSnapshot` (real-time) | Média | Polling a cada 15-30s ou SSE (Server-Sent Events) |
| Auth de cliente (login) quebra | Média | Testar exaustivamente cadastro → login → pedido |
| Token JWT customizado (base64) inseguro | Alta | Migrar para JWT padrão HS256 (fase 5) |
| Compatibilidade de dados legados (itens como string) | Média | Script de transformação com parser robusto |

---

## Referências Cruzadas

- **Análise de Segurança Detalhada**: [`docs/analise_seguranca.md`](./analise_seguranca.md)
- **Análise Arquitetural Completa**: [`docs/analyser_2.md`](./analyser_2.md)
- **Análise Inicial (Arquitetura)**: [`docs/arquitetura.md`](./arquitetura.md)
- **README do Projeto**: [`README.md`](../README.md)
- **README do Backend**: [`backend/README.md`](../backend/README.md)

---

*Documento gerado em 2026-06-25 como parte do processo de análise contínua do projeto SIC D'Jesus.*
