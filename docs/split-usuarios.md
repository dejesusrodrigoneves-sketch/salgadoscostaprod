# Plano: Hierarquia de Usuários e Controle de Acesso por Papel

## Objetivo

Implementar hierarquia de permissões no painel administrativo com três níveis:

```
superadmin > admin > user
```

Onde:
- **superadmin**: acesso total ao sistema, gerencia todos os usuários
- **admin**: acesso total exceto gerenciamento de usuários
- **user**: acesso restrito — vê apenas Pedidos, Lançar Pedido e Alterar Senha

---

## Status atual

- Todo usuário criado via `superadmin.html` recebe `role: 'user'` (não há seletor de papel)
- O menu do `dashboard.html` é o mesmo para todos os papéis — a única diferença é que `superadmin` vê a seção "Administração"
- **Nenhuma restrição existe**: qualquer usuário autenticado consegue acessar `admin.html`, `painelLoja.html`, `relatorios.html`, `caixa.html`, `entregador.html` diretamente pela URL
- O token de autenticação NÃO é JWT válido — é base64 simples sem assinatura

---

## O que muda em cada camada

### 1. Backend — Token JWT verdadeiro (migração do base64)

**Arquivos afetados:**
- `backend/src/services/authService.js`
- `backend/src/middleware/auth.js`

**Mudança:**
- `authService.login()`: gerar token com `tokenService.gerarToken()` (JWT assinado com `JWT_SECRET`) em vez de `Buffer.from().toString('base64url')`
- `authService.criarConta()`: idem
- `middleware/auth.js`: `authenticate()` passa a usar `tokenService.verificarToken()` em vez de decodificar base64 manualmente

**Motivo:** sem JWT válido, qualquer usuário pode forjar um token com `role: 'superadmin'` e burlar o controle de acesso. Esta migração é pré-requisito para segurança.

**Efeito colateral:** todos os tokens existentes (salvos no localStorage) serão invalidados — usuários precisam refazer login uma vez.

---

### 2. Backend — Middleware de autorização por papel

**Arquivos afetados:**
- `backend/src/middleware/auth.js` — adicionar `authorizeRole()`

**Função nova:**
```js
function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}
```
(Já existe `authorize()` no mesmo arquivo com a mesma lógica — apenas renomear/consolidar)

**Rotas que recebem proteção extra:**

| Rota | Método | Papel mínimo | Situação atual | Mudança |
|------|--------|-------------|----------------|---------|
| `/api/admin/*` | GET/POST | `superadmin` | Já protegido | Nenhuma |
| `/api/usuarios/*` | GET/POST/DELETE/PUT | `superadmin` | Já protegido | Nenhuma |
| `/api/caixa/*` | GET/POST | `admin` | Só `authenticate` | Adicionar `authorizeRole('superadmin','admin')` |
| `/api/entregadores/*` | POST/PUT/DELETE/PATCH | `admin` | `authorize('superadmin','admin')` | Já OK |
| `/api/produtos/*` | POST/PUT/DELETE | `admin` | `authorize('superadmin','admin')` | Já OK |
| `/api/categorias/*` | POST/PUT/DELETE | `admin` | `authorize('superadmin','admin')` | Já OK |
| `/api/loja/settings` | PUT | `admin` | `authorize('superadmin','admin')` | Já OK |

**Conclusão:** as rotas de backend já estão majoritariamente protegidas. A única adição necessária é em `cashierRoutes.js` e `entregaRoutes.js` (GET também).

---

### 3. Frontend — Menu condicional por papel

**Arquivo:** `dashboard.html`

**Lógica atual (linha ~510):**
```js
if (isSuperAdmin) {
  menuSections.push({ title: 'Administração', items: [...] });
} else {
  menuSections.push({ title: 'Conta', items: [...] });
}
```

**Nova lógica:**

```js
const role = authUser.role;

// 1. SEMPRE aparece (qualquer papel)
const menu = [
  {
    title: 'Principal',
    items: [
      { icon: 'fa-box', label: 'Pedidos', page: 'admin.html' },
      { icon: 'fa-cash-register', label: 'Lançar Pedido', page: 'balcao.html' },
    ]
  },
  { title: 'Conta', items: [ ... ] }
];

// 2. Só admin+ (admin e superadmin)
if (role === 'admin' || role === 'superadmin') {
  menu.push(
    { title: 'Financeiro', items: [
      { icon: 'fa-chart-bar', label: 'Relatórios', page: 'relatorios.html' },
      { icon: 'fa-wallet', label: 'Controle de Caixa', page: 'caixa.html' },
    ]},
    { title: 'Entregas', items: [
      { icon: 'fa-truck', label: 'Entregadores', page: 'entregador.html' },
    ]},
    { title: 'Painel', items: [
      { icon: 'fa-store', label: 'Painel Loja', page: 'painelLoja.html' },
    ]}
  );
}

// 3. Só superadmin
if (role === 'superadmin') {
  menu.push({ title: 'Administração', items: [
    { icon: 'fa-users-cog', label: 'Gerenciar Usuários', page: 'superadmin.html' },
    { icon: 'fa-key', label: 'Trocar Senhas', page: 'superadmin.html?tab=senhas' },
  ]});
}
```

---

### 4. Frontend — Seletor de papel no cadastro de usuário

**Arquivo:** `superadmin.html`

**Mudança:**
- Adicionar `<select>` com opções `user`, `admin`, `superadmin` no formulário de cadastro
- Enviar `role` no body do POST `/api/usuarios`
- Mostrar apenas `admin` e `user` como opções padrão (com confirmação extra para `superadmin`)

**Formulário novo:**
```html
<select id="newRole">
  <option value="user">Usuário</option>
  <option value="admin">Administrador</option>
  <option value="superadmin">Super Admin</option>
</select>
```

**API call:**
```js
await api('/usuarios', {
  method: 'POST',
  body: JSON.stringify({ username, password, lojaNome: username, role: selectedRole })
});
```

---

### 5. Frontend — Bloqueio de acesso direto por URL

**Arquivos:** `admin.html`, `painelLoja.html`, `relatorios.html`, `caixa.html`, `entregador.html`, `alterar-senha.html`

**Problema:** qualquer usuário pode digitar `painelLoja.html` na URL e acessar, mesmo sem o menu aparecer.

**Solução:** adicionar `authGuard()` em todas as páginas (já existe em algumas, adicionar nas demais). Adicionar verificação de papel mínima nas páginas restritas:

```js
// No topo de relatorios.html, caixa.html, entregador.html, painelLoja.html:
const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
if (!authUser || !['admin', 'superadmin'].includes(authUser.role)) {
  window.location.href = 'dashboard.html';
}
```

---

### 6. Backend — Log de login

**Arquivos novos:**
- Model `LoginLog` no schema Prisma
- Migration para criar tabela `login_logs`

**Arquivos alterados:**
- `backend/prisma/schema.prisma` — adicionar model
- `backend/src/services/authService.js` — registrar login após sucesso
- `backend/src/controllers/authController.js` — passar `ip` e `user-agent` para o service
- `backend/src/routes/userRoutes.js` — nova rota `GET /api/usuarios/logs` (superadmin only) para consultar logs

**Schema novo:**
```prisma
model LoginLog {
  id         Int      @id @default(autoincrement())
  usuarioId  Int      @map("usuario_id")
  username   String
  ip         String?
  userAgent  String?  @map("user_agent")
  loggedAt   DateTime @default(now()) @map("logado_em")

  @@map("login_logs")
}
```

**superadmin.html:** nova aba "Histórico de Login" com tabela paginada.

---

### 7. Frontend — Ajuste na página "Trocar Senhas"

Atualmente `superadmin.html?tab=senhas` é linkada no menu "Trocar Senhas" (visível para superadmin). Deve permanecer apenas para superadmin. Já está correto.

Para usuário comum (role `user`), manter a página `alterar-senha.html` já existente.

---

## Resumo de arquivos alterados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `backend/src/services/authService.js` | Backend | Migrar token base64 → JWT; adicionar log de login |
| `backend/src/controllers/authController.js` | Backend | Capturar IP/user-agent e passar para service |
| `backend/src/middleware/auth.js` | Backend | Migrar verify para JWT; consolidar `authorize` |
| `backend/src/routes/cashierRoutes.js` | Backend | Adicionar `authorize` nas rotas |
| `backend/prisma/schema.prisma` | Backend | Adicionar model `LoginLog` |
| `backend/src/routes/userRoutes.js` | Backend | Nova rota `GET /logs` para consultar login logs |
| `dashboard.html` | Frontend | Menu condicional por papel |
| `superadmin.html` | Frontend | Seletor de papel no cadastro; aba de login logs |
| `relatorios.html` | Frontend | Guard de acesso (admin+) |
| `caixa.html` | Frontend | Guard de acesso (admin+) |
| `entregador.html` | Frontend | Guard de acesso (admin+) |
| `painelLoja.html` | Frontend | Guard de acesso (admin+) |

---

## Ordem de implantação sugerida

1. **Token JWT** (authService.js + middleware/auth.js) — pré-requisito de segurança
2. **Proteção de rotas backend** (cashierRoutes.js + entregaRoutes.js)
3. **Menu condicional** (dashboard.html)
4. **Guard de URL** (relatorios.html, caixa.html, entregador.html, painelLoja.html)
5. **Seletor de papel** (superadmin.html)
6. **Log de login** (schema + authService + superadmin.html)
7. **Deploy** (commit + push → Vercel)

---
