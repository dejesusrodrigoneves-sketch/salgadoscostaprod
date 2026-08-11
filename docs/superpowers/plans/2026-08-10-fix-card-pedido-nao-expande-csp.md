# Card de Pedido Não Expande — Fix CSP

> **Para agentes:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plano task-a-task. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Restaurar expansão dos cards de pedido ("Meus Pedidos") permitindo event handlers inline (`onclick`) bloqueados pela CSP do Helmet.

**Architecture:** O servidor Express (`backend/src/app.js:30`) aplica Helmet v8 com `contentSecurityPolicy`. O Helmet injeta por default `script-src-attr 'none'`, que bloqueia TODO `onclick="..."` inline em HTML gerado por JS. Os cards de pedido (`js/menu.js:728`, `:744`) usam `onclick="toggleOrderExpand(this)"` inline — bloqueado. Fix: adicionar `scriptSrcAttr: ["'unsafe-inline'"]` às directives, permitindo event handlers inline sem relaxar `script-src` (scripts externos continuam restritos).

**Tech Stack:** Express, Helmet v8, CSP.

## Global Constraints

- Não alterar `js/menu.js` — onclick inline é padrão do projeto (16 em balcao.html, 14 em superadmin.html); refatorar tudo fora de escopo.
- Não remover o Helmet — CSP é medida de segurança ativa.
- Manter todas as directives CSP existentes intactas.

---

### Task 1: Permitir `script-src-attr 'unsafe-inline'` na CSP

**Files:**
- Modify: `backend/src/app.js:30`

**Interfaces:**
- Consumes: nada (config CSP existente).
- Produces: header `Content-Security-Policy` sem `script-src-attr 'none'`; `onclick` inline volta a executar.

- [ ] **Step 1: Provar bug — header CSP bloqueia inline handlers**

Run:
```bash
curl -sI http://localhost:3000/index.html | grep -i content-security
```
Expected: output contém `script-src-attr 'none'` — causa do bloqueio.

- [ ] **Step 2: Provar bug — click no card não expande**

Run (browser/Playwright): clicar `.order-card-header` do overlay Meus Pedidos.
Expected: `.order-card` NÃO ganha classe `expanded`; console mostra `Executing inline event handler violates ... 'script-src-attr 'none''`.

- [ ] **Step 3: Implementar fix**

Em `backend/src/app.js:30`, dentro de `directives`, adicionar `scriptSrcAttr` logo após `scriptSrc`:

```js
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com"], scriptSrcAttr: ["'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"], fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"], imgSrc: ["'self'", "data:", "https:"] } } }));
```

Diff exato (1 linha adicionada):
```diff
- scriptSrc: ["'self'", "'unsafe-inline'", ...], styleSrc: [...]
+ scriptSrc: ["'self'", "'unsafe-inline'", ...], scriptSrcAttr: ["'unsafe-inline'"], styleSrc: [...]
```

- [ ] **Step 4: Reiniciar servidor**

O backend serve estático na porta 3000. Reiniciar processo (Ctrl+C + `npm start` em `backend/`, ou `start-servers.bat`).

- [ ] **Step 5: Verificar header CSP**

Run:
```bash
curl -sI http://localhost:3000/index.html | grep -i content-security
```
Expected: `script-src-attr 'none'` AUSENTE; `script-src-attr 'unsafe-inline'` presente ou directive ausente.

- [ ] **Step 6: Verificar click expande card**

Run (browser/Playwright): recarregar página, abrir Meus Pedidos, clicar `.order-card-header`.
Expected: `.order-card` ganha classe `expanded`; `.order-card-body` max-height vira `800px`; conteúdo aparece.

- [ ] **Step 7: Verificar não-regressão (outros onclick)**

Run: clicar botões inline existentes (ex: adicionar item ao carrinho no cardápio, abrir overlay admin).
Expected: sem novos erros `script-src-attr` no console; handlers funcionam.

- [ ] **Step 8: Commit**

```bash
git add backend/src/app.js
git commit -m "fix: permitir onclick inline na CSP (script-src-attr) desbloqueia cards de pedido"
```
