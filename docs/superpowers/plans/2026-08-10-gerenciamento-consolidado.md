# Consolidação "Gerenciamento" — Super Admin Sidebar Unificada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os 3 itens separados da seção "Administração" do dashboard sidebar ("Gerenciar Usuários", "Trocar Senhas", "Clientes") por 1 único item "Gerenciamento" que leva ao superadmin.html (que já reúne todas as abas).

**Architecture:** Dashboard sidebar renderiza dinamicamente `menuSections[]` via `renderMenu()`. Seção "Administração" (visível só para `superadmin`) contém 3 nav-items apontando para `superadmin.html` com parâmetros `tab` diferentes. A página `superadmin.html` já implementa 4 abas: Usuários, Gerenciar Senhas, Registros, Clientes — consolidando toda a gestão num ponto único. Basta remover os itens redundantes e o parâmetro `tab`.

**Tech Stack:** Vanilla JS, Vite (build), HTML5, CSS3

## Global Constraints

- Manter idioma pt-BR nos labels
- Preservar estrutura `menuSections[]` existente (array de seções com `title` + `items`)
- `superadmin.html` NÃO deve ser alterado — já tem todas as abas
- Build Vite deve ser executado para regenerar `dist/superadmin.html` com aba Clientes
- Manter o padrão de ícones Font Awesome (`fa-*`)

---

### Task 1: Consolidar sidebar "Administração" → "Gerenciamento"

**Files:**
- Modify: `dashboard.html:118-126`

**Interfaces:**
- Consumes: `menuSections[]` array (linha ~60), `renderMenu()` function (linha ~136)
- Produces: "Administração" section with single item → renamed to "Gerenciamento"

**Contexto:** O `superadmin.html` já centraliza toda gestão de usuários, senhas e clientes em 4 abas. Não há razão para manter 3 entradas separadas no sidebar que apontam para a mesma página com parâmetros `tab` diferentes.

- [ ] **Step 1: Substituir os 3 itens por 1 item "Gerenciamento"**

Abrir `dashboard.html` e localizar o bloco da seção "Administração" (linhas 118–126):

```javascript
// Super Admin section
if (role === 'superadmin') {
  menuSections.push({
    title: 'Administração',
    items: [
      { icon: 'fa-users-cog', label: 'Gerenciar Usuários', page: 'superadmin.html' },
      { icon: 'fa-key', label: 'Trocar Senhas', page: 'superadmin.html?tab=senhas' },
      { icon: 'fa-user-tie', label: 'Clientes', page: 'superadmin.html?tab=clientes' },
    ]
  });
}
```

Substituir por:

```javascript
// Super Admin section
if (role === 'superadmin') {
  menuSections.push({
    title: 'Administração',
    items: [
      { icon: 'fa-users-cog', label: 'Gerenciamento', page: 'superadmin.html' },
    ]
  });
}
```

- [ ] **Step 2: Verificar alteração visualmente**

Abrir `dashboard.html` no navegador (via Vite dev server ou direto) e confirmar:
- Sidebar mostra "Administração" com 1 item: "Gerenciamento"
- Clicar em "Gerenciamento" carrega `superadmin.html` com todas as abas (Usuários, Gerenciar Senhas, Registros, Clientes)
- A aba ativa por padrão é "Usuários" (primeira aba)

- [ ] **Step 3: Commit**

```bash
git add dashboard.html
git commit -m "feat: consolidar sidebar admin em único item 'Gerenciamento'"
```

---

### Task 2: Verificar superadmin.html (sem alterações)

**Files:**
- Verify: `superadmin.html:1-381` (nenhuma alteração necessária)

**Interfaces:**
- Consumes: `switchTab(tab, btn)` função de troca de aba (linha 179), `activarTabPorQuery()` (linha 361)
- Produces: 4 abas ativas — Usuários (`tabUsuarios`), Gerenciar Senhas (`tabSenhas`), Registros (`tabRegistros`), Clientes (`tabClientes`)

**Contexto:** `superadmin.html` já contém todas as 4 abas unificadas. Após Task 1, o sidebar linka para `superadmin.html` sem parâmetro `tab`, então a primeira aba ("Usuários") será a ativa por padrão. A função `activarTabPorQuery()` (linha 361) continuará funcionando para links diretos com `?tab=` via URL, mantendo compatibilidade.

- [ ] **Step 1: Confirmar que todas as abas estão presentes**

Verificar `superadmin.html`:
- Linha 19: `<button class="tab active" onclick="switchTab('usuarios',this)">`Usuários
- Linha 20: `<button class="tab" onclick="switchTab('senhas',this)">`Gerenciar Senhas
- Linha 21: `<button class="tab" onclick="switchTab('registros',this)">`Registros
- Linha 22: `<button class="tab" onclick="switchTab('clientes',this)">`Clientes

E as divs de conteúdo:
- Linha 26: `<div class="tab-content active" id="tabUsuarios">`
- Linha 53: `<div class="tab-content" id="tabSenhas">`
- Linha 67: `<div class="tab-content" id="tabClientes">`
- Linha 113: `<div class="tab-content" id="tabRegistros">`

Verificar `switchTab()` (linha 179):
```javascript
const map = { usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', registros: 'tabRegistros', clientes: 'tabClientes' };
```

Verificar `activarTabPorQuery()` (linha 361):
```javascript
if (tab && ['usuarios', 'senhas', 'clientes', 'registros'].includes(tab)) {
```

**Resultado esperado:** Nenhuma alteração necessária. Tudo já consolidado.

- [ ] **Step 2: Commit**

```bash
# Nenhum arquivo alterado — commit vazio é aceitável ou pular
echo "superadmin.html já consolidado — sem alterações necessárias"
```

---

### Task 3: Rebuild dist/superadmin.html (incluir aba Clientes)

**Files:**
- Trigger build: `superadmin.html` (source, 381 linhas com aba Clientes)
- Regenerate: `dist/superadmin.html` (output atual tem 224 linhas, SEM aba Clientes)

**Interfaces:**
- Consumes: `superadmin.html` (source entry no `vite.config.js:20`)
- Produces: `dist/superadmin.html` atualizado com aba Clientes + assets minificados

**Contexto:** O build atual em `dist/` foi gerado antes da adição da aba Clientes. O `vite.config.js` inclui `superadmin` como entry point (linha 20). Rodar o build regenera o dist com a versão atualizada.

- [ ] **Step 1: Rodar build Vite**

```bash
npx vite build
```

- [ ] **Step 2: Verificar dist/superadmin.html contém aba Clientes**

```bash
grep -c "Clientes" dist/superadmin.html
```
Esperado: pelo menos 1 ocorrência (antes era 0).

Ou verificar visualmente que o arquivo tem a tab button:
```html
<button class="tab" onclick="switchTab('clientes',this)"><i class="fas fa-user-tie"></i> Clientes</button>
```

- [ ] **Step 3: Commit**

```bash
git add dist/superadmin.html dist/assets/
git commit -m "build: regenerar dist com aba Clientes"
```

---

## Self-Review

**1. Spec coverage:**
- "deixar tudo num lugar so com nome de `gerenciamento`" → Task 1 consolida 3 itens sidebar em 1 "Gerenciamento"
- "analise o superadmin" → Task 2 verifica que superadmin.html já tem todas as abas
- "quando eu clico em gerenciar usuarios aparecem as abas trocas senhas e clientes" → Task 1 remove itens redundantes do sidebar; abas já existem no superadmin.html

**2. Placeholder scan:** Nenhum TBD, TODO, "implement later", "add error handling" genérico encontrado.

**3. Type consistency:**
- `menuSections[].items[].page` → `string` (URL) — consistente entre Task 1 e código existente
- `switchTab(tab, btn)` → `tab: string` — mapeamento em `superadmin.html:183` inclui 'clientes'
- `activarTabPorQuery()` → array de tabs válidas em `superadmin.html:364` inclui 'clientes'

**Gaps:** Nenhum. Todas as exigências do spec cobertas.
