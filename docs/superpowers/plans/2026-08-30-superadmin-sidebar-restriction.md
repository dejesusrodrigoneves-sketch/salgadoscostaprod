# Superadmin Sidebar Restriction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a superadmin logs in, hide all lojista-specific menus (Principal, Financeiro, Entregas, Painel, Integrações) from the sidebar and land directly on the Gerenciamento page.

**Architecture:** Modify `dashboard.html` sidebar logic to conditionally render menu sections based on role. Superadmin sees only Administração > Gerenciamento. The sidebar container is preserved for future options. Default iframe target changes to `superadmin.html` for superadmin role.

**Tech Stack:** Vanilla JS (frontend), no backend changes needed.

## Global Constraints

- Single-tenant project at `C:\Users\djesus\Downloads\projects-vscode\sic-ia - Copy`
- Branch `main` → push to `prod main` remote
- Frontend: vanilla HTML/JS, no build system
- Auth stored in `localStorage.authUser` = `{ id, username, role, lojaNome, token, _expiry }`
- Role values: `superadmin`, `admin`, `user`
- No commits until user requests

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `dashboard.html` | Modify (lines 73-134, 51, 69) | Sidebar menu logic, default iframe target |

Single file change — minimal diff.

---

### Task 1: Restrict sidebar menus for superadmin role

**Files:**
- Modify: `dashboard.html:73-134` (menuSections), `dashboard.html:51` (iframe src), `dashboard.html:69` (currentPage)

**Interfaces:**
- Consumes: `authUser.role` from localStorage (already available at line 71)
- Produces: Modified `menuSections` array and `currentPage` variable

- [ ] **Step 1: Read current sidebar logic**

Verify current state at `dashboard.html:73-134`:
```javascript
const menuSections = [
  {
    title: 'Principal',
    items: [
      { icon: 'fa-box', label: 'Pedidos', page: 'admin.html' },
      { icon: 'fa-cash-register', label: 'Lançar Pedido', page: 'balcao.html' },
    ]
  }
];

// Admin+ sections
if (role === 'admin' || role === 'superadmin') {
  menuSections.push(
    { title: 'Financeiro', items: [...] },
    { title: 'Entregas', items: [...] },
    { title: 'Painel', items: [...] }
  );
}

// Todos veem Integrações
menuSections.push({ title: 'Integrações', items: [...] });

// Super Admin section
if (role === 'superadmin') {
  menuSections.push({ title: 'Administração', items: [{ label: 'Gerenciamento', page: 'superadmin.html' }] });
}
```

- [ ] **Step 2: Replace menuSections logic**

Replace lines 73-134 with role-gated menu construction:

```javascript
const menuSections = [];

if (role === 'superadmin') {
  // Superadmin: only Gerenciamento
  menuSections.push({
    title: 'Administração',
    items: [
      { icon: 'fa-users-cog', label: 'Gerenciamento', page: 'superadmin.html' },
    ]
  });
} else {
  // Lojista/Admin: all operational menus
  menuSections.push({
    title: 'Principal',
    items: [
      { icon: 'fa-box', label: 'Pedidos', page: 'admin.html' },
      { icon: 'fa-cash-register', label: 'Lançar Pedido', page: 'balcao.html' },
    ]
  });

  if (role === 'admin') {
    menuSections.push(
      {
        title: 'Financeiro',
        items: [
          { icon: 'fa-chart-bar', label: 'Relatórios', page: 'relatorios.html' },
          { icon: 'fa-wallet', label: 'Controle de Caixa', page: 'caixa.html' },
          { icon: 'fa-landmark', label: 'Central Financeira', page: 'financeiro.html' },
        ]
      },
      {
        title: 'Entregas',
        items: [
          { icon: 'fa-truck', label: 'Cadastro de Entregadores', page: 'entregador.html' },
          { icon: 'fa-chart-line', label: 'Relatório de Entregadores', page: 'relatorios-entregadores.html' },
        ]
      },
      {
        title: 'Painel',
        items: [
          { icon: 'fa-store', label: 'Painel Loja', page: 'painelLoja.html' },
        ]
      }
    );
  }

  menuSections.push({
    title: 'Integrações',
    items: [
      { icon: 'fab fa-whatsapp', label: 'WhatsApp', page: 'whatsapp.html' },
      { icon: 'fa-plug', label: 'Integrações Financeiras', page: 'integracoes.html' },
    ]
  });

  menuSections.push({
    title: 'Conta',
    items: [
      { icon: 'fa-key', label: 'Alterar Senha', page: 'alterar-senha.html' },
    ]
  });
}
```

- [ ] **Step 3: Change default iframe target for superadmin**

At line 51, change:
```html
<iframe id="mainFrame" src="admin.html"></iframe>
```
To:
```html
<iframe id="mainFrame"></iframe>
```

At line 69, change:
```javascript
let currentPage = 'admin.html';
```
To:
```javascript
let currentPage = role === 'superadmin' ? 'superadmin.html' : 'admin.html';
```

After `renderMenu()` call (line 281), add:
```javascript
// Set initial iframe src based on role
mainFrame.src = currentPage;
```

- [ ] **Step 4: Verify in browser**

1. Login as superadmin (`djesus`/`tsa110594`)
2. Sidebar should show ONLY "Administração > Gerenciamento"
3. Main content should load `superadmin.html` directly
4. No Principal, Financeiro, Entregas, Painel, Integrações menus visible
5. Login as admin/user → all menus should appear as before

- [ ] **Step 5: Commit**

```bash
git add dashboard.html
git commit -m "feat: restrict superadmin sidebar to Gerenciamento only"
```
