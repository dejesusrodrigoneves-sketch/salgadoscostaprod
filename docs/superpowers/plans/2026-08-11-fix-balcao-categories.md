# Fix balcao.html Product Categories

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make products in balcao.html filter by their registered categories instead of showing as "Tipo 0"

**Architecture:** Update frontend to use `category.nome` from API response instead of legacy `type` field

**Tech Stack:** Vanilla JS frontend, Prisma/PostgreSQL backend

---

## Root Cause Analysis

The `balcao.html` page uses a legacy `type` field (numeric, defaults to `0`) for product filtering. Products now use `categoryId` (linked to `Categoria` model). The backend API already returns `category` data (via `include: { category: true }` in `sqlRepository.js:7`), but the frontend ignores it.

**Current behavior:**
- Products show as "Tipo 0" in filters
- All products grouped under single "Tipo 0" button
- No category separation visible

**Expected behavior:**
- Products filter by `category.nome` (e.g., "Salgados", "Bebidas", etc.)
- Products without category show as "Sem categoria"

---

## File Structure

| File | Change | Purpose |
|------|--------|---------|
| `balcao.html:104-111` | Remove | Remove hardcoded `nomesTipos` mapping |
| `balcao.html:136-168` | Modify | Update `criarFiltros()` to use `category.nome` |
| `balcao.html:170-182` | Modify | Update `atualizarBotoes()` for category matching |
| `balcao.html:185-213` | Modify | Update `renderizarProdutos()` to filter by category |

---

## Task 1: Remove Legacy nomesTipos Mapping

**Files:**
- Modify: `balcao.html:104-111`

**Interfaces:**
- No dependencies

- [ ] **Step 1: Remove nomesTipos constant**

Delete lines 104-111 in `balcao.html`:

```javascript
const nomesTipos = {
  1: "Salgados 45g",
  2: "Massas",
  3: "Combos",
  4: "Bebidas",
  5: "Doces",
  6: "Congelados"
};
```

- [ ] **Step 2: Run test to verify no console errors**

Open balcao.html in browser. Expected: No console errors, page loads normally.

- [ ] **Step 3: Commit**

```bash
git add balcao.html
git commit -m "chore: remove unused nomesTipos constant"
```

---

## Task 2: Update criarFiltros() to Use Categories

**Files:**
- Modify: `balcao.html:136-168`

**Interfaces:**
- Consumes: `todosProdutos` array with `category` objects from API
- Produces: Updated filter buttons with category names

- [ ] **Step 1: Update criarFiltros() function**

Replace lines 136-168 with:

```javascript
function criarFiltros() {
  const filtrosDiv = document.getElementById("filtros");
  filtrosDiv.innerHTML = "";

  // Extract unique category names from products
  const categorias = [...new Set(todosProdutos.map(p => p.category?.nome || 'Sem categoria'))];

  // Botão Todos
  const btnTodos = document.createElement("button");
  btnTodos.innerText = "Todos";
  btnTodos.className = "filtro-btn ativo";
  btnTodos.onclick = () => {
    typeAtual = null;
    atualizarBotoes();
    renderizarProdutos();
  };
  filtrosDiv.appendChild(btnTodos);

  // Botões por categoria
  categorias.forEach(categoria => {
    const btn = document.createElement("button");
    btn.innerText = categoria;
    btn.className = "filtro-btn";
    btn.onclick = () => {
      typeAtual = categoria;
      atualizarBotoes();
      renderizarProdutos();
    };
    btn.dataset.category = categoria;
    filtrosDiv.appendChild(btn);
  });
}
```

- [ ] **Step 2: Run test to verify filter buttons show category names**

Open balcao.html in browser. Expected: Filter buttons show category names from database (e.g., "Salgados", "Bebidas") instead of "Tipo 0".

- [ ] **Step 3: Commit**

```bash
git add balcao.html
git commit -m "fix: update criarFiltros to use category.nome instead of type"
```

---

## Task 3: Update atualizarBotoes() for Category Matching

**Files:**
- Modify: `balcao.html:170-182`

**Interfaces:**
- Consumes: `typeAtual` (now category name string or null)

- [ ] **Step 1: Update atualizarBotoes() function**

Replace lines 170-182 with:

```javascript
function atualizarBotoes() {
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.classList.remove("ativo");

    if (
      (btn.innerText === "Todos" && typeAtual === null) ||
      btn.dataset.category === typeAtual
    ) {
      btn.classList.add("ativo");
    }
  });
}
```

- [ ] **Step 2: Run test to verify active button highlighting**

Open balcao.html in browser. Expected: Clicking a category button highlights it correctly.

- [ ] **Step 3: Commit**

```bash
git add balcao.html
git commit -m "fix: update atualizarBotoes to match category names"
```

---

## Task 4: Update renderizarProdutos() to Filter by Category

**Files:**
- Modify: `balcao.html:185-213`

**Interfaces:**
- Consumes: `typeAtual` (category name string or null)
- Produces: Filtered products displayed in grid

- [ ] **Step 1: Update renderizarProdutos() function**

Replace lines 185-213 with:

```javascript
function renderizarProdutos() {
  const grid = document.querySelector(".grid-produtos");
  grid.innerHTML = "";

  const produtosFiltrados = typeAtual
    ? todosProdutos.filter(p => (p.category?.nome || 'Sem categoria') === typeAtual)
    : todosProdutos;

  produtosFiltrados.forEach(produto => {
    const div = document.createElement("div");
    div.className = "produto";

    div.innerHTML = `
      <img src="${produto.img || ''}" alt="${produto.name}" loading="lazy">
      <h4>${produto.name}</h4>
      <span>R$ ${Number(produto.price).toFixed(2)}</span>
    `;

    div.addEventListener("click", () => {
      adicionarAoCarrinho(produto);
    });

    grid.appendChild(div);
  });
}
```

- [ ] **Step 2: Run test to verify products filter by category**

Open balcao.html in browser. Expected: Clicking a category button filters products to show only those in that category.

- [ ] **Step 3: Commit**

```bash
git add balcao.html
git commit -m "fix: update renderizarProdutos to filter by category.nome"
```

---

## Task 5: Verify Backend API Returns Category Data

**Files:**
- No changes needed (already working)

**Interfaces:**
- Backend: `GET /api/produtos` returns products with `category` object

- [ ] **Step 1: Test API response**

Run: `curl http://localhost:3000/api/produtos -H "Authorization: Bearer <token>"`

Expected: Response includes `category: { id: 1, nome: "Salgados", ... }` for products with categories.

- [ ] **Step 2: Document verification**

Note: Backend already includes category via `include: { category: true }` in `sqlRepository.js:7`. No backend changes needed.

---

## Self-Review Checklist

- [ ] All products now filter by `category.nome` instead of `type`
- [ ] Products without category show as "Sem categoria"
- [ ] Filter buttons display actual category names from database
- [ ] No console errors in browser
- [ ] All commits follow conventional format

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-11-fix-balcao-categories.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
