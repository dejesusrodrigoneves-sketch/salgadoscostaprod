# Design — Gestão de Contas de Clientes (Superadmin)

**Data:** 2026-08-09
**Status:** Aprovado
**Modo:** Sem commit (working tree only)

## Objetivo

Permitir que o superadmin gerencie as contas de **clientes** que se cadastram no site (modelo `Cliente`), com capacidade de editar dados, trocar senha (sem saber a antiga) e excluir contas. UI nova como aba no `superadmin.html`.

## Contexto Atual

- `Usuario` (funcionários/admin) — já tem CRUD no `superadmin.html` via `userRoutes.js` (listar, criar, excluir, resetar senha).
- `Cliente` (clientes do site) — **sem gestão de superadmin**. Só self-service com `authenticatePublic` (perfil, atualizar, excluir própria conta).
- Repositório `sqlRepository.js` já expõe: `listarClientes()`, `buscarCliente(telefone)`, `buscarClientePorId(id)`, `criarCliente()`, `atualizarCliente(id, data)`, `deletarCliente(id)`.
- `adminRoutes.js` já tem guard `router.use(authenticate, authorize('superadmin'))` e é montado em `/api/admin`.
- `js/password-toggle.js` já carregado no `superadmin.html` — adiciona olho 👁 automaticamente a todo `input[type="password"]` (bi-eye ↔ bi-eye-slash).

## Decisões

- **UI:** nova aba "Clientes" no `superadmin.html` (Opção A).
- **Campos editáveis:** todos (nome, telefone, endereco, numero, bairro, cep, pontoReferencia) + senha no mesmo fluxo de gestão.
- **Exclusão:** hard delete (mesmo comportamento da auto-exclusão LGPD — dados pessoais removidos, pedidos retidos por obrigação fiscal).
- **Abordagem backend:** rotas em `adminRoutes.js` + controller novo `clientAdminController.js` (padrão `driverController`: sqlRepository + auditService + asyncHandler).

## Backend

### `backend/src/controllers/clientAdminController.js` (novo)

```
listarClientes   → sql.listarClientes() → select explícito SEM passwordHash
atualizarCliente → valida id → sql.atualizarCliente(id, body) + audit
resetarSenha     → valida senha (min 6) → bcrypt.hash(senha, 10) → sql.atualizarCliente(id, { passwordHash }) + audit
deletarCliente   → sql.deletarCliente(id) + audit (severity critical)
```

Regras:
- Lista nunca retorna `passwordHash` (select explícito).
- Ao editar telefone, verificar duplicidade com outro cliente → `409`.
- Senha: mínimo 6 caracteres; `SALT_ROUNDS = 10` (bcryptjs), igual ao registro.
- Auditoria: `cliente.admin_list`, `cliente.admin_update`, `cliente.admin_reset_password`, `cliente.admin_delete` — actor = superadmin logado.
- 404 quando cliente não existe.

### `backend/src/routes/adminRoutes.js` (editar)

Montar controller e adicionar rotas (guard superadmin já existente):

```
GET    /clientes
PUT    /clientes/:id
PUT    /clientes/:id/password
DELETE /clientes/:id
```

## Frontend

### `superadmin.html` (editar)

1. Nova aba no header: `<button class="tab" onclick="switchTab('clientes',this)">Clientes</button>` com ícone `fa-user-tie`.
2. Novo bloco `tab-content` (id `tabClientes`):
   - Card "Clientes Cadastrados" — tabela: Nome | Telefone | Bairro | Criado em | Ações (✏️ Editar · 🔑 Senha · 🗑️ Excluir).
   - Modal de edição: nome, telefone, endereco, numero, bairro, cep, pontoReferencia → `PUT /api/admin/clientes/:id`.
   - Modal de senha: **Nova senha** + **Confirmar senha** (ambos `type="password"` → olho automático via `password-toggle.js`) → `PUT /api/admin/clientes/:id/password`.
   - Exclusão: `confirmModal('Excluir conta deste cliente? ...')` → `DELETE /api/admin/clientes/:id` → toast + reload.
3. Funções JS: `carregarClientes()`, `abrirModalEditar(id)`, `abrirModalSenha(id)`, `excluirCliente(id)`.
4. CSS: reutilizar `.card`, `.user-table`, `.btn` do `superadmin-page.css`; adicionar estilos de modal conforme necessário.
5. Atualizar `switchTab` map com `clientes: 'tabClientes'`.
6. **Ler query param `?tab=` no load** (bug pré-existente: `?tab=senhas` não auto-switchava): parsear `location.search` no init e chamar `switchTab` correspondente — habilita `superadmin.html?tab=clientes`.

### `dashboard.html` (editar)

Adicionar item no submenu **"Administração"** (bloco `if (role === 'superadmin')`, visível somente para superadmin):

```
{ icon: 'fa-user-tie', label: 'Clientes', page: 'superadmin.html?tab=clientes' }
```

Resultado do submenu Administração (superadmin-only):
- Gerenciar Usuários → `superadmin.html`
- Trocar Senhas → `superadmin.html?tab=senhas`
- **Clientes → `superadmin.html?tab=clientes`**

## Fluxo de Dados

```
superadmin.html (aba Clientes)
   ├─ carregarClientes()    → GET    /api/admin/clientes
   ├─ abrirModalEditar(id)  → PUT    /api/admin/clientes/:id
   ├─ abrirModalSenha(id)   → PUT    /api/admin/clientes/:id/password
   └─ excluirCliente(id)    → DELETE /api/admin/clientes/:id
                ↓
     adminRoutes (guard superadmin)
                ↓
     clientAdminController → sqlRepository → PostgreSQL
                    + auditService
```

## Tratamento de Erros

| Caso | Resposta |
|---|---|
| Cliente não existe | `404 { error: 'Cliente não encontrado' }` |
| Telefone duplicado ao editar | `409 { error: 'Telefone já cadastrado por outro cliente' }` |
| Senha < 6 chars | `400 { error: 'Senha deve ter 6+ caracteres' }` |
| Não superadmin | `403` (guard adminRoutes) |
| `passwordHash` na lista | Nunca retornado |

## Testes (Playwright E2E)

1. Login superadmin (`djesus`) → aba Clientes carrega lista.
2. Editar cliente → dados atualizam na tabela.
3. Trocar senha → cliente loga com nova senha no site.
4. Excluir cliente → some da lista; token antigo rejeitado (401).
5. Admin (não superadmin) → `GET /api/admin/clientes` retorna 403.

## Fora de Escopo (YAGNI)

- Soft delete / reativação de conta.
- Paginação (lista enxuta; adicionar se crescer).
- Exportação CSV.
- Gestão de `Usuario` (já existente no `superadmin.html`).
