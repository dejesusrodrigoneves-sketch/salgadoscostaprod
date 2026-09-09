# Design: Admin criar filiais (somente loja matriz)

Data: 2026-09-08
Status: Aprovado

## Objetivo

Permitir que admin (papel `admin`) crie **filiais** sob a própria loja matriz, com fluxo de
aprovação pelo superadmin. Somente a loja **matriz** pode criar filiais — admin de filial
não pode criar outras filiais.

## Contexto atual

- `backend/src/routes/adminRoutes.js:8` → `router.use(authenticate, authorize('superadmin'))`
  bloqueia todas as rotas de filiais para admin (403).
- `backend/src/controllers/adminController.js:96` → `criarFilial` já existe, mas sem check
  de ownership e sem estado de aprovação.
- `dashboard.html:76` → menu admin referencia `filiais.html`, que **não existe**.
- `js/superadminDashboard.js:244` → frontend superadmin chama `/api/admin/empresas/filiais`
  mas a rota real é `/api/admin/filiais` (bug URL, "Criar Filial" já quebrado no superadmin).
- **`empresaTipo` nunca vira `'matriz'`**: schema default é `'independente'`; só
  `atualizarParent` escreve (`'filial'`/`'independente'`). Nenhum código seta `'matriz'`.
- **Login não retorna `empresaTipo`**: `authService.js:115` retorna `{ id, username, role,
  lojaNome }`. Logo `authUser.empresaTipo` no frontend é sempre `undefined` e o menu
  "Filiais" (`dashboard.html` checa `=== 'matriz'`) **nunca aparece**.

## Definição de "loja matriz"

Neste código, **"matriz" = loja de topo que não é filial** (`empresaTipo !== 'filial'`
ou `parentEmpresaId === null`). Loja filial (`empresaTipo === 'filial'`) não pode criar
filiais. Adotamos a definição `empresaTipo !== 'filial'` como sinal de "pode criar filiais".

## Modelo de papéis

- `superadmin` — dono da plataforma. Cria/gerencia qualquer empresa. Aprova filiais.
- `admin` — gerente de UMA empresa (`req.user.empresaId`). Só gerencia a própria matriz.
- `user` — básico.
- `entregador` — app do entregador.

## Seção 1 — Schema (Prisma)

Adicionar campos ao model `Empresa`:

```prisma
status       String  @default("active") @map("status")
createdBy    Int?    @map("created_by")
justificativa String? @map("justificativa")
createdByUser Usuario? @relation("FilialCreator", fields: [createdBy], references: [id])
```

- `status` — `"active"` (normal/aprovada) | `"pending"` (aguardando aprovação).
- `createdBy` — ID do `Usuario` que criou a filial (para superadmin saber quem pediu).
- `justificativa` — Motivo/descrição da nova filial (ex: "expansão bairro X").
- `createdByUser` — relation Prisma para JOIN direto (username do criador).

Requerido: migração Prisma + `prisma generate`.

## Seção 2 — Backend: rotas (`adminRoutes.js`)

Mover rotas de filiais **antes** do gate `router.use(authenticate, authorize('superadmin'))`,
com autorização individual:

```js
router.post('/filiais', authenticate, authorize('superadmin','admin'), adminController.criarFilial);
router.get('/filiais/pendentes', authenticate, authorize('superadmin'), adminController.listarFiliaisPendentes);
router.get('/empresas/:id/filiais', authenticate, authorize('superadmin','admin'), adminController.listarFiliais);
router.put('/filiais/:id/approve', authenticate, authorize('superadmin'), adminController.aprovarFilial);
router.delete('/filiais/:id', authenticate, authorize('superadmin','admin'), adminController.deletarFilial);
router.put('/empresas/:id/parent', authenticate, authorize('superadmin','admin'), adminController.atualizarParent);

router.use(authenticate, authorize('superadmin'));
// resto (empresas, clientes, usuarios, theme) continua superadmin only
```

## Seção 3 — Backend: controller (`adminController.js`)

### `criarFilial` (alterado)

- Aceita `{ nome, justificativa? }` — slug auto-gerado via `normalizarSlug(nome)`.
  - Colisão de slug (`P2002` ou pré-check) → 409 `"Já existe loja com esse nome"`.
- Admin: `parentEmpresaId` forçado para `req.user.empresaId` (própria matriz), ignorando
  valor enviado no body.
- Admin: busca a própria empresa (`sql.buscarEmpresa(req.user.empresaId)`); se
  `empresaTipo === 'filial'` → 403 `"Somente loja matriz pode criar filiais"`.
- Superadmin: deve receber `parentEmpresaId` no body (escolhe a matriz) — mantém
  comportamento atual.
- Grava `createdBy: req.user.id` e `justificativa` (se fornecido) na empresa criada.
- `status` = admin → `"pending"`; superadmin → `"active"`.

### `aprovarFilial` (novo, superadmin)

- Busca filial por id. `status` → `"active"`.
- Filial não encontrada → 404.

### `deletarFilial` (novo, soft delete)

- Admin só deleta filial cujo `parentEmpresaId === req.user.empresaId` → senão 403.
- Usa `sql.softDeleteEmpresa(id)` → define `deletedAt`.
- **Preserva** todos os dados gerados (pedidos, clientes, categorias, financeiro,
  settlements/valores-a-receber).
- **Não** bloqueia por settlements pendentes (comportamento distinto do `deletar` atual).

### `listarFiliais` (manter)

- Adicionar filtro `deletedAt: null` ao where (não mostrar filiais deletadas).
- Mantém check ownership: `admin && empresaId !== id` → 403.

### `atualizarParent` (adicionar ownership)

- Admin só pode desvincular/reatribuir filial cujo `parentEmpresaId === req.user.empresaId`.
- Reatribuir para matriz que não seja a própria → 403.

### `listarFiliaisPendentes` (novo, superadmin-only)

- Chama `sql.listarFiliaisPendentes()` (retorna filiais `status='pending'` com `parentEmpresa` e `createdByUser` via include Prisma).
- Retorna lista enriquecida direto do repository (sem segunda query).

## Seção 4 — Backend: repositório (`sqlRepository.js`)

- `criarFilial` — aceitar `status`, `createdBy`, `justificativa` no data (default `status='active'` se não informado).
- Adicionar `aprovarFilial(id)` → `prisma.empresa.update({ where: { id }, data: { status: 'active' } })`.
- Adicionar `listarFiliaisPendentes()` → filiais com `status='pending'` e `deletedAt: null`,
  incluindo `parentEmpresa: { select: { id, nome, slug } }` via Prisma include.
- `listarFiliais(parentEmpresaId)` — adicionar `deletedAt: null` ao where.
- Reusar `softDeleteEmpresa(id)` existente.

## Seção 5 — Frontend: nova página `filiais.html`

Página carregada no iframe do dashboard (menu admin matriz → "Gerenciar Filiais").

- **Lista de filiais**: nome, slug, status badge
  ("Pendente de aprovação" / "Ativa"). Filiais soft-deletadas (`deletedAt` definido)
  **não aparecem** na lista.
- **Botão "Criar Filial"** → modal com:
  - Campo "Nome da filial" (obrigatório; slug gerado no backend).
  - Campo "Justificativa" (textarea, opcional — ex: "expansão bairro X").
- **Botões por filial**: "Desvincular" (PUT `/empresas/:id/parent` com `parentEmpresaId:null`)
  e "Excluir" (DELETE `/filiais/:id`, com confirmação).
- `parentEmpresaId` = própria empresa do admin logado (lido do token/localStorage).

## Seção 6 — Frontend: superadmin

`superadmin.html` + `js/superadminDashboard.js`:

- **Corrigir bug URL**: `/api/admin/empresas/filiais` → `/api/admin/filiais`.
- Mostrar badge de status nas filiais (Pendente/Ativa).
- Botão **"Aprovar"** em filiais `pending` (PUT `/filiais/:id/approve`).
- Botão **"Excluir"** em filiais (DELETE `/filiais/:id`).
- Atualizar formulário de criar filial: **3 campos** — "Nome da filial" (obrigatório),
  "Justificativa" (textarea, opcional), "Selecionar Matriz" (dropdown com todas as
  matrizes `empresaTipo !== 'filial'`).

### Dados exibidos ao superadmin na tabela de filiais

**Layout:** Lista flat (todas as filiais de todas as matrizes, sem agrupamento).
Ordenação: `createdAt desc` (mais recentes primeiro). Apenas filiais ativas ou
pendentes (soft-deletadas não aparecem).

Para cada filial, a tabela mostra:

| Coluna | Fonte |
|--------|-------|
| Nome da filial | `empresa.nome` |
| Slug | `empresa.slug` |
| Matriz pai | `empresa.parentEmpresa.nome` (JOIN) |
| Quem criou | `usuario.username` via `empresa.createdBy` (JOIN) |
| Data criação | `empresa.createdAt` (já existe no schema) |
| Justificativa | `empresa.justificativa` |
| Status | Badge: "Pendente de aprovação" / "Ativa" |
| Ações | Botões: Aprovar (só pending) / Excluir |

### Novo endpoint: filiais pendentes

`GET /api/admin/filiais/pendentes` — superadmin-only.

Retorna todas as filiais com `status='pending'`, incluindo:
- Dados da filial (nome, slug, justificativa, createdAt)
- Nome da matriz pai (`parentEmpresa.nome`)
- Username do criador (`createdByUser.username`)

Prisma query (com relation `createdByUser`):
```js
prisma.empresa.findMany({
  where: { status: 'pending', empresaTipo: 'filial', deletedAt: null },
  include: {
    parentEmpresa: { select: { id: true, nome: true, slug: true } },
    createdByUser: { select: { id: true, username: true } },
  },
  orderBy: { createdAt: 'desc' },
})
```

## Seção 7 — Auth: login response + dashboard menu

### `authService.js` — login response

Adicionar `empresaId` e `empresaTipo` ao objeto `user` retornado no login
(movendo fetch da empresa para escopo da função, fora do bloco `if`):

```js
// Capturar empresa antes do return
let empresa = null;
if (user.empresaId) {
  empresa = await sql.buscarEmpresa(user.empresaId);
  if (empresa && empresa.deletedAt) {
    throw Object.assign(new Error('Empresa inativa'), { status: 403 });
  }
}

return {
  token, refreshToken,
  user: {
    id: user.id, username: user.username, role: user.role,
    lojaNome: user.lojaNome,
    empresaId: user.empresaId || null,
    empresaTipo: empresa?.empresaTipo || null,
  },
};
```

Isso faz `localStorage.authUser` conter `empresaId` e `empresaTipo` após login.

### `login.html` — authUser localStorage

Incluir os novos campos no spread (mudança automática via `...data.user`).

### `dashboard.html` — menu Filiais

Trocar:
```js
if (authUser.empresaTipo === 'matriz') {
```
por:
```js
if (authUser.empresaTipo !== 'filial') {
```

Assim o menu "Filiais" aparece para qualquer loja top-level (independente ou matriz),
mas não para filial.

## Seção 8 — Regras de negócio / segurança

1. Somente `admin` cuja empresa **não é filial** (`empresaTipo !== 'filial'`) cria filial.
2. Filial criada por admin nasce `status = 'pending'` — não utilizável até aprovação.
3. Superadmin aprova (`status='active'`) ou exclui (soft delete).
4. Excluir filial NÃO apaga dados nem valores a receber — só marca `deletedAt`.
5. Admin não pode criar filial para outra matriz, nem aprovar (aprovação é superadmin-only).
6. Admin de filial (empresa filial) não vê menu nem acessa rotas de filiais (403).

## Seção 9 — Testes (Playwright)

Fluxos a verificar no browser:

1. **Login admin matriz** → `authUser` contém `empresaTipo: 'independente'` (ou 'matriz') → menu "Filiais" visível.
2. **Login admin filial** → `authUser` contém `empresaTipo: 'filial'` → menu "Filiais" ausente.
3. **Admin matriz** → cria filial "Loja X" com justificativa "expansão bairro Y" → filial aparece com "Pendente de aprovação".
4. **Admin filial** → tenta criar filial via API → 403.
5. **Admin** tentando criar filial para outra matriz → 403 (parentEmpresaId ignorado/sobrescrito).
6. **Superadmin** → vê filial pendente na tabela → colunas: nome, matriz pai, quem criou, data, justificativa → "Aprovar" → status vira "Ativa".
7. **Superadmin** → "Excluir" filial → desativada; pedidos/financeiro preservados.
8. **Regressão**: superadmin cria filial diretamente → nasce "Ativa" (aprovada).
9. **Regressão**: bug URL `/api/admin/filiais` corrigido (criar funciona no superadmin).
10. **Regressão**: slug auto-gerado do nome; nome duplicado → erro 409.

## Fora de escopo (YAGNI)

- Atribuição automática de usuário admin à filial criada.
- Notificação por e-mail/whatsapp de aprovação.
- Hierarquia de filiais com múltiplos níveis (filial de filial).

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `backend/prisma/schema.prisma` | + campos `status`, `createdBy`, `justificativa` no model `Empresa` |
| `backend/src/services/authService.js` | login response: + `empresaId`, `empresaTipo` |
| `backend/src/routes/adminRoutes.js` | reordenar + autorização filiais + rota `GET /filiais/pendentes` |
| `backend/src/controllers/adminController.js` | `criarFilial` (justificativa+createdBy), `aprovarFilial` (novo), `deletarFilial` (novo), `listarFiliaisPendentes` (novo), `atualizarParent` ownership |
| `backend/src/repositories/sqlRepository.js` | `criarFilial` (status+createdBy+justificativa), `aprovarFilial` (novo), `listarFiliaisPendentes` (novo) |
| `filiais.html` | **novo** — página admin (lista + criar + excluir + desvincular) |
| `js/filiais.js` (novo) | lógica da página filiais.html |
| `js/superadminDashboard.js` | fix URL, aprovar/excluir, campo nome único, carregar pendentes |
| `superadmin.html` | tabela filiais com colunas expandidas (quem criou, data, justificativa, matriz pai), botões aprovar/excluir |
| `dashboard.html` | menu Filiais: `!== 'filial'` (antes nunca funcionava) |
| `login.html` | authUser inclui `empresaId` + `empresaTipo` (via spread `data.user`) |