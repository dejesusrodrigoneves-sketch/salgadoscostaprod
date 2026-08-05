# Promover/Rebaixar Roles de Usuários — Design

**Status:** DRAFT — aguardando aprovação do usuário
**Data:** 2026-07-21
**Branch:** `feature/hierarquia-usuarios`

---

## Contexto e problema

`superadmin.html` tem 3 tabs: Usuários (lista/cadastrar/excluir), Gerenciar Senhas, Histórico de Login. O papel de cada usuário é texto estático na tabela — o superadmin é forçado a excluir e recriar o usuário para mudar seu nível de acesso.

### Estado atual do sistema
- Roles: `superadmin > admin > user` (imutável no signup)
- API existente: `GET/POST/DELETE /api/usuarios`, `PUT /api/usuarios/:id/password`, `GET /api/usuarios/logs`
- Página standalone em `login.html` para cadastro público; admin dashboard separado
- `superadmin.html` — JavaScript inline dentro da própria página

---

## Decisões do brainstorming

| # | Pergunta | Decisão |
|---|-------------------------------|------------------------------------------------|
| 1 | Onde o controle de role aparece? | Dropdown inline na tabela |
| 2 | Quem pode alterar? | Apenas superadmin (defesa em profundidade) |
| 3 | Auto-save ou botão explícito? | Botão "Salvar papel" por linha (visível só com mudança pendente) |
| 4 | Registrar auditoria? | Sim — quem promoveu/rebaixou, quando, de/para qual role  |
| 5 | Endpoint HTTP? | `PUT /api/usuarios/:id/role` |
| 6 | Abordagem de backend? | Middleware JWT + requireRole + transaction Firestore com log atômico |

---

## Arquitetura

```
Browser (superadmin.html) 
    → JWT via Bearer token (existente)
    → Middleware requireRole("superadmin")
    → PUT /api/usuarios/:id/role { role }
    → Verificação "último superadmin sendo rebaixado"
    → Firestore transaction:
        - users/{id}.update({role})
        - audit_logs/{autoId}.add({ actor, target, oldRole, newRole, createdAt })
    → 200 { ...updatedUser }
```

---

## Componentes

### Backend (novo)

#### `api/_middleware/roles.js`
Middleware reutilizável para verificar role do JWT
```js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ação restrita' });
    }
    next();
  };
}
```

#### `api/usuarios/[id]/role.js`
Handler para `PUT /api/usuarios/:id/role`
1. Validar `role ∈ {user, admin, superadmin}` → 422
2. Buscar target no Firestore → 404 
3. Se target é superadmin sendo promovido (ou seja, `oldRole === 'superadmin' && newRole !== 'superadmin'`):
   - Contar quantos superadmins restam 
   - Se for 1 → 422 ("Pelo menos 1 superadmin deve permanecer")
4. Firestore transaction:
   - `users/{id}.update({ role })`
   - `audit_logs.add({ action: 'role_change', actorUsername: req.user.username, targetUsername, oldRole, newRole, ip: req.ip, createdAt: serverTimestamp() })`
5. Retornar 200 com documento atualizado

#### `api/_lib/audit.js`
Função para encapsular escrita em `audit_logs` — usada também para login logs futuros
```js
async function insertAuditLog(db, entry) {
  await db.collection('audit_logs').add({
    ...entry,
    createdAt: FieldValue.serverTimestamp()
  });
}
```

### Schema novo: `audit_logs`

| Campo | Tipo |
|---|---|
| `action` | string (`"role_change"`) |
| `actorUsername` | string 
| `targetUsername` | string |
| `oldRole` | string |
| `newRole` | string |
| `ip` | string (best-effort) |
| `createdAt` | Firestore server timestamp |

### Frontend (modificações)

#### `superadmin.html` — alterações planejadas

**Guarda client-side adicional:**
```js
if (getAuthUser().role !== 'superadmin') {
  toast('Acesso restrito', 'danger');
  setTimeout(() => location.replace('index.html'), 1500);
}
```

**Tabela — substituir `<td>` de papel por `<select>`:**
```html
<td>
  <select class="role-select" data-id="..." data-old="..." onchange="onRoleChange(this)">
    <option value="user" selected>Usuário</option>
    <option value="admin">Admin</option>
    <option value="superadmin">Super Admin</option>
  </select>
</td>
<td>
  <button class="btn btn-sm btn-primary role-save-btn" style="display:none" 
          onclick="salvarRole('...', '...')">Salvar papel</button>
</td>
```

**JS — `onRoleChange`:** Mostra/oculta botão Salvar; adiciona classe CSS de destaque na linha se há mudança pendente:
```js
function onRoleChange(select) {
  var row = select.closest('tr');
  var saveBtn = row.querySelector('.role-save-btn');
  if (select.value !== select.dataset.old) {
    saveBtn.style.display = 'inline-flex';
    row.classList.add('role-pending');
  } else {
    saveBtn.style.display = 'none';
    row.classList.remove('role-pending');
  }
}
```

**JS — `salvarRole`:** Faz `PUT` na API, mostra toast, faz rollback do select se erro
```js
async function salvarRole(id, username, row) {
  // ... chamada API, try/catch, toast
}
```

**Tab Auditoria:** Renomear "Histórico de Login" para "Auditoria" — mostrar tanto entradas de login quando mudanças de role

### CSS (`css/superadmin-page.css`) — novo seletor

```css
.role-pending { background: rgba(249, 115, 22, 0.08); }
.role-pending td { background: transparent !important; }
```

---

## Fluxo de erros (HTTP p/ frontend)

| Cenário | Status | Mensagem |
|---|---|---|
| Não-autenticado | 401 | `Não autenticado` |
| Não-superadmin tentando | 403 | `Ação restrita` |
| Token nulo/expirado | 401 | `Não autenticado` |
| Role inválida | 422 | `Papel inválido` |
| Usuário-alvo não existe | 404 | `Usuário não encontrado` |
| Último superadmin sendo rebaixado | 422 | `Pelo menos 1 superadmin deve permanecer` |
| Firestore indisponível | 503 | `Tente novamente` |

---

## Testes manuais

1. Promover user → admin
2. Reverter admin → user
3. Unsuperadmin deve redirecionar (403 → barra Acesso restrito)
4. Tentar rebaixar o único superadmin → 422 + toast
5. Após promoção, nova role persiste em recarga
6. Audit log mostra entrada com actor/target/oldRole/newRole/timestamp

---

## Critérios de sucesso

- [x] Superadmin pode promover user → admin
- [x] Superadmin pode reverter admin → user 
- [x] Botão Salvar visível apenas quando há mudança pendente
- [x] Backend barra admin/user comum
- [x] Último superadmin bloqueado (erro 422 + mensagem)
- [x] Dropdown mostra role correta após salvar sem recarregar página
- [x] Log de auditoria registra quem fez a mudança, quando, de/para
- [x] Tab Auditoria/Logs exibe entradas de mudança

---

## YAGNI — fora do escopo

- Sem batch update (promover múltiplos de uma vez)
- Sem notificação por e-mail/WhatsApp do afetado
- Sem undo de mudanças feitas
- Sem roles custom intermediárias
- Sem histórico detalhado com filtros avançados

---

## Próximos passos (após aprovação)

1. Invocar `writing-plans` para criar plano de implementação
2. Criar API handler, middleware, lib de audit
3. Atualizar `superadmin.html` com dropdown select + salvar
4. Adicionar CSS de destaque de linha pendente
5. Rodar bateria de testes manual
6. Commit e push para `origin/prod`