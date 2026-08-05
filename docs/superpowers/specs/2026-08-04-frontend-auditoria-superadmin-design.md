# Frontend de Auditoria — Super Admin (Etapa 4)

Data: 2026-08-04
Status: Aprovado (brainstorming)

## Objetivo

Adicionar aba "Registros" no `superadmin.html` exibindo a timeline de auditoria com filtros completos. Backend de consulta já existe e não muda além de um ajuste de 1 linha.

## Contexto

- Backend pronto: `GET /api/audit` (filtros `actorId`, `module`, `action`, `severity`, `dataInicio`, `dataFim`, `page`, `limit`; retorno `{items, total, page, limit, totalPages}`) e `GET /api/audit/usuarios` (`listActors` — atores agrupados com `lastActivity` e `totalActions`). Rotas protegidas por `authenticate` + `authorize('superadmin')`.
- Frontend: `superadmin.html` vanilla JS com tabs (`usuarios`, `senhas`, `logs`), função `api()` inline, helpers `toast`/`escapeHtml`/`authGuard` em `js/utils.js`.
- Dados sensíveis já mascarados/redactados no backend (`maskDeep` em `auditService.js`).

## Decisões aprovadas

1. Timeline com **filtros completos** (usuário, módulo, severidade, datas).
2. **Cards com linha do tempo** (não tabela).
3. Cards **expandíveis** com before/after/changedFields.
4. Navegação **"Carregar mais"** (load more), não paginação numerada.
5. Implementação em **JS separado** (`js/superadmin-audit.js`), HTML só com markup, CSS no `css/superadmin-page.css`.

## Arquitetura

### `superadmin.html`
- Nova tab "Registros" (`tabRegistros`), só markup:
  - Filtros: `#filtroUsuario` (select), `#filtroModulo` (select), `#filtroSeveridade` (select), `#filtroInicio` / `#filtroFim` (`type="date"`), botão "Limpar filtros".
  - Container `#timeline` (cards + estado vazio/erro inline).
  - Botão `#btnLoadMore` com contador "X de Y eventos".
- `switchTab` ganha case `'registros'` → `carregarAudit(1)` ao abrir.
- Select de módulo (estático): "Todos os módulos" + `cliente`, `whatsapp`, `auth`, `pedido`, `geral` (valores = `module` do audit).
- Script tags: `js/utils.js` (já existe), `js/superadmin-audit.js` (novo).

### `js/superadmin-audit.js` (novo)
- Estado: `page`, `total`, `hasMore`, filtros atuais.
- `carregarAudit(page)`: monta query string com filtros, fetch `/api/audit`, renderiza ou faz append.
- `carregarMaisAudit()`: `page+1`, append, scroll preservado (sem scroll automático).
- `renderTimeline(items)`: cards; usa `escapeHtml` em todo valor renderizado.
- `expandirCard(id)`: toggle detalhes (before/after/changedFields).
- `formatarAcao(action)`: traduz `modulo.acao` → label legível pt-BR (ex. `cliente.register` → "Cadastro de cliente", `cliente.login_failed` → "Login de cliente falhou", `whatsapp.qr_gerado` → "QR gerado", `whatsapp.instance_create` → "Instância criada", `auth.login` → "Login", `auth.login_failed` → "Login falhou", `pedido.create` → "Pedido criado"); fallback = string original.
- `formatarSeveridade()`: `info` → "Info", `warning` → "Aviso", `critical` → "Crítico".
- `popularSelectUsuarios()`: fetch `/api/audit/usuarios`; opção "Todos os usuários" + atores `nome (papel)` com `title` contendo total de ações e última atividade; ator `actorId === null` → "Visitante (sem login)" com valor `anon`. Falha no select não bloqueia a timeline.
- Load initial: `carregarAudit(1)` + `popularSelectUsuarios()` no `DOMContentLoaded`.

### `css/superadmin-page.css`
- `.audit-filters` (grid responsivo), `.timeline` (linha vertical), `.timeline-item` (dot), `.audit-card`, `.severity-info/warning/critical` (dot + borda/label), `.audit-details` (expandido), `.chips`, `.timeline-empty`, responsivo mobile.

### `backend/src/routes/auditRoutes.js` (ajuste)
- `actorId=anon` ou `actorId=null` → `where.actorId = null` (atualmente `Number('anon')` = `NaN` → filtro ignorado silenciosamente). Demais valores mantêm `Number(actorId)`.

## Data flow

1. Abrir tab → `carregarAudit(1)` (limit 50) + `popularSelectUsuarios()`.
2. Aplicar filtro (change em qualquer filtro ou botão limpar) → limpar timeline, `carregarAudit(1)` com filtros.
3. Datas: `dataInicio=YYYY-MM-DDT00:00:00`, `dataFim=YYYY-MM-DDT23:59:59` (fuso local do usuário).
4. "Carregar mais" → `page+1` (append).
5. `critical` → destaque vermelho no card.

## Segurança

- Todo valor renderizado passa por `escapeHtml` (username, action, módulo, reason, IP, targetId, JSON dos detalhes).
- Payloads exibidos são os já mascarados pelo backend (`maskDeep`): senhas/tokens/QR → `[REDACTED]`, telefones mascarados.
- Apenas `superadmin` acessa as rotas (middleware `authorize`).

## Error handling

- Fetch falhou → `toast(e.message, 'danger')` + mensagem inline "Erro ao carregar registros" com botão "Tentar novamente".
- Lista vazia → "Nenhum registro encontrado" (mantém filtros aplicados).
- Select de usuários falha → timeline segue funcional sem filtro de usuário.
- Erro no load more → toast, botão permanece clicável (sem estado quebrado).

## Testes (verificação manual E2E)

1. Login `djesus` → aba Registros → timeline carrega com eventos.
2. Select usuários populado (atores reais + anon "Visitante (sem login)").
3. Gerar eventos de teste (login falho, pedido público) → aparecem com ator correto.
4. Filtros por usuário/módulo/severidade/datas → resultado correto; limpar restaura.
5. Load more com página cheia; expandir card mostra before/after; critical destacado.
6. Confirmar ausência de dados sensíveis no JSON expandido.
7. Responsivo mobile (< 480px).

## Fora de escopo

- Rota nova no backend (listar módulos) — lista de módulos é estática no frontend.
- Exportação CSV/PDF de registros.
- Filtro por `action` específica (backend suporta, frontend não expõe — YAGNI).
- Auto-refresh periódico da timeline (recarrega só ao abrir tab/aplicar filtro).
- Login logs (`/api/usuarios/logs`) — tab existente permanece.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `superadmin.html` | Tab + markup da seção de registros; script `superadmin-audit.js`; case `'registros'` no `switchTab` |
| `js/superadmin-audit.js` | Novo — lógica completa da timeline |
| `css/superadmin-page.css` | Estilos timeline/filtros/cards |
| `backend/src/routes/auditRoutes.js` | Aceitar `actorId=anon`/`null` → `where.actorId = null` |
