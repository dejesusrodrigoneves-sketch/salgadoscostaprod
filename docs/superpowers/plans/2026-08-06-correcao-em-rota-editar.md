# Correção: Botão "Em Rota" para retirada + Botão Editar no admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir em `admin.html` (a) a renderização duplicada/incorreta do botão "Em Rota" que aparece em pedidos de retirada/balcão, e (b) fazer o botão "Editar" aparecer **somente quando o pedido está em `producao`**, sem quebra do fluxo existente.

**Architecture:** Centralizar a lógica de visibilidade dos botões de ação do card em uma única função pura `deveMostrarEmRota(tipoEntrega)` que normaliza todos os valores de retirada (`retirada`, `balcao`, `undefined`/vazio). Remover a linha duplicada (289). Renderizar o botão "Editar" condicionado a `p.status === 'producao'` (não mais `finalizado`). Nenhuma mudança de backend.

**Tech Stack:** Vanilla JS (`admin.html`), sem novas deps.

## Global Constraints

- **Só mexer em `admin.html`** — não tocar backend (testado 7/7), nem `dashboard.html`, nem `cart.js`/`balcao.html`.
- **Valores de tipoEntrega no sistema:** `delivery` (entrega) e `retirada` (cart.js) OU `balcao` (balcao.html). Retirada é qualquer valor ≠ `delivery`.
- **Botão "Em Rota" só deve aparecer quando `tipoEntrega === 'delivery'`.** Para retirada/balcao/vazio → esconder.
- **Botão "Editar" aparece apenas para `p.status === 'producao'`** (spec atualizada 2026-08-06). Nunca para pronto/em_rota/finalizado.
- **Guard no handler:** o `[data-action="rota"]` handler já existe — quando botão escondido, não deve quebrar `querySelector` (usar `?.` ou guard).
- Commits convencionais pt-BR, um por task.
- Preservar o padrão do card (ternário `isPendente ? ... : ...`).

---

## File Structure

- **Modify:** `admin.html` — única fonte do frontend admin. Todas as mudanças são neste arquivo.

---

## Task 1: Helper puro `deveMostrarEmRota` + remover botão duplicado

**Files:**
- Modify: `admin.html` (helper após `recalcularTotais`, ~linha 471; bloco de botões ~linha 285-295)

**Interfaces:**
- Consumes: nada
- Produces: `deveMostrarEmRota(tipoEntrega: any): boolean` — retorna `true` somente se `tipoEntrega === 'delivery'`.

- [ ] **Step 1: Adicionar helper puro**

Inserir imediatamente após o fechamento de `recalcularTotais` (localizar pelo comentário `// --- Modal A: Editar Itens ---` e inserir antes dele):

```js
// Retorna true apenas para entrega delivery. Retirada = qualquer valor != 'delivery'.
function deveMostrarEmRota(tipoEntrega) {
  return String(tipoEntrega || '').toLowerCase() === 'delivery';
}
```

- [ ] **Step 2: Remover botão "Em Rota" duplicado/incondicional**

No bloco de botões, remover a linha 289 (a que está **dentro** do bloco `else` sem guard):

De:
```html
          <button class="btn btn-pronto" data-action="pronto"><i class="fas fa-bell"></i> Pronto</button>
          <button class="btn btn-rota" data-action="rota"><i class="fas fa-truck"></i> Em Rota</button>
          <button class="btn btn-finalizar" data-action="finalizar"><i class="fas fa-check"></i> Finalizar</button>
          ${p.status === 'finalizado' ? `<button class="btn btn-edit" data-action="editar"><i class="fas fa-edit"></i> Editar</button>` : ''}
          ${p.tipoEntrega !== 'balcao' ? `<button class="btn btn-rota" data-action="rota"><i class="fas fa-truck"></i> Em Rota</button>` : ''}
          <button class="btn btn-print" data-action="print"><i class="fas fa-print"></i> Imprimir</button>
```

Para:
```html
          <button class="btn btn-pronto" data-action="pronto"><i class="fas fa-bell"></i> Pronto</button>
          ${deveMostrarEmRota(p.tipoEntrega) ? `<button class="btn btn-rota" data-action="rota"><i class="fas fa-truck"></i> Em Rota</button>` : ''}
          <button class="btn btn-finalizar" data-action="finalizar"><i class="fas fa-check"></i> Finalizar</button>
          ${p.status === 'producao' ? `<button class="btn btn-edit" data-action="editar"><i class="fas fa-edit"></i> Editar</button>` : ''}
          <button class="btn btn-print" data-action="print"><i class="fas fa-print"></i> Imprimir</button>
```

**Resultado:** remove a linha incondicional (289) e a linha com guard errado (292); fica um único "Em Rota" guardado por `deveMostrarEmRota`, e o "Editar" passa a depender de `p.status === 'producao'`.

- [ ] **Step 3: Verificar sintaxe e presença**

Run (bash):
```bash
grep -n "deveMostrarEmRota\|data-action=\"rota\"" "/c/Users/djesus/Downloads/projects-vscode/sic-ia - Copy/admin.html"
```
Expected: helper definido **1x** (`function deveMostrarEmRota`), botão rota renderizado **1x** (dentro do ternário guardado). Nenhuma linha `data-action="rota"` solta fora do ternário.

Também confirmar que `data-action="editar"` permanece **1x** no bloco.

- [ ] **Step 4: Commit**

```bash
git add admin.html
git commit -m "fix(admin): botao Em Rota so para delivery — remove duplicado e normaliza tipoEntrega"
```

---

## Task 2: Guard no handler do botão rota (evitar querySelector null)

**Files:**
- Modify: `admin.html` (handler `[data-action="rota"]`, ~linha 327)

**Interfaces:**
- Consumes: nada
- Produces: handler seguro quando botão não renderizado

**Contexto:** Com o botão agora condicional, quando o pedido é retirada o botão não existe no DOM. O código atual `card.querySelector('[data-action="rota"]').onclick = ...` vai lançar TypeError em `null.onclick`. **Porém** — verificar se já há guard: se o renderCard já usa `?.` para outros botões, replicar.

- [ ] **Step 1: Verificar estado atual do handler**

Read `admin.html` linhas 320-345. Se o padrão atual para botões condicionais já usa `const btnRota = card.querySelector('[data-action="rota"]'); if (btnRota) btnRota.onclick = ...`, então este task é N/A — registrar no report e pular.

Se estiver usando acesso direto `.onclick` sem guard, aplicar o fix abaixo.

- [ ] **Step 2: Aplicar guard (se necessário)**

De:
```js
  card.querySelector('[data-action="rota"]').onclick = async function() {
```
Para:
```js
  const btnRota = card.querySelector('[data-action="rota"]');
  if (btnRota) btnRota.onclick = async function() {
```

E fechar o bloco corretamente ao final do handler (o `};` existente passa a fechar `if`+`function` — validar chaves).

- [ ] **Step 3: Verificar com Playwright**

Browser: http://localhost:5173/dashboard.html (logado).
- Abrir pedido retirada/balcao → confirmar **ausência** do botão "Em Rota".
- Abrir pedido delivery → confirmar **presença** do botão "Em Rota".
- Abrir pedido finalizado → confirmar botão "Editar".

`playwright_browser_console_messages` level `error`: **zero** erros novos (ignorar favicon.ico 404 pré-existente e 401 settings-admin pré-existente).

- [ ] **Step 4: Commit**

```bash
git add admin.html
git commit -m "fix(admin): guard no handler em rota quando botao ausente para retirada"
```

---

## Task 3: Verificação E2E do fluxo Editar em pedido em produção

**Files:**
- Modify: nenhum (verificação) — se bug detectado, corrigir inline

**Interfaces:**
- Consumes: `abrirFluxoEdicao`, `modalEditarItens`, `modalEditarValores` (já existentes)
- Produces: confirmação visual de que "Editar" (status `producao`) abre modais e PATCH funciona

- [ ] **Step 1: Localizar pedido em produção no admin**

Browser: abrir aba "Produção". No card do pedido em `producao`, confirmar botão "Editar" visível. Clicar "Editar" e confirmar Modal A abre (título "Editar Itens — Pedido #X").

- [ ] **Step 2: Confirmar ausência do botão Editar em outros status**

Abrir um pedido `pronto` (ou `em_rota`/`finalizado`) e confirmar **sem** botão "Editar".

- [ ] **Step 3: Verificar PATCH no network**

`playwright_browser_network_requests` filtrar `/editar` → confirmar request `PATCH` com payload contendo `itens`, `total`, `formaPagamento`.

- [ ] **Step 4: Reportar achado**

Se PATCH retorna erro, anotar exatamente (status + body) — este é o sinal de que backend `editarPedido` tem bug de runtime não coberto pelos testes unitários (ex: formato de `sabores`, ou validação de status). Reportar como DONE_WITH_CONCERNS com o erro, **não** corrigir backend sem aprovação.

- [ ] **Step 5: Commit**

Se não houve mudança de código, **não commitar** (nada a commitar). Se houver fix no admin.html, commitar:
```bash
git add admin.html
git commit -m "fix(admin): ajustes e2e no fluxo de edicao de pedido em producao"
```

---

## Self-Review Notes

**Spec coverage (spec `2026-08-04-editar-pedido-finalizado-design.md`, atualizada 2026-08-06):**
- ✅ "Botão Em Rota só para delivery" → Task 1 (`deveMostrarEmRota`)
- ✅ "Botão Editar apenas quando status producao" → Task 1 (linha `${p.status === 'producao' ...}`)
- ✅ "Ausência de botão Editar para pronto/em_rota/finalizado" → Task 1 renderização condicional + Task 3 verificação
- ✅ Handler sem quebra quando botão ausente → Task 2
- ✅ E2E de edição → Task 3

**Placeholder scan:** Nenhum TBD/TODO. Task 2 Step 1 pede verificação antes de aplicar (correto — evita duplicar guard já existente).

**Type consistency:** `deveMostrarEmRota(tipoEntrega)` aceita string|undefined|null e retorna boolean — usada no template string e segura contra null.

---

## Execution Handoff

**Plan saved to `docs/superpowers/plans/2026-08-06-correcao-em-rota-editar.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute in this session, checkpoints.

Which approach?
