# SDD Progress — Editar Pedido Finalizado Frontend (2026-08-06)

Plano: `docs/superpowers/plans/2026-08-06-editar-pedido-finalizado-frontend.md`
Branch: `feature/hierarquia-usuarios`
BASE: `30cbee1d5982ec3f37f969700a349ff8b0355e8d`


---
## SDD Progress — Adicionar Itens Overlay Balcão (2026-08-08)

Plano: `docs/superpowers/plans/2026-08-08-adicionar-itens-overlay-balcao.md`
Modo: opção C (zero commits, revisão final única, testes navegador pós-revisão)
BASE: working tree (sem commits)

- Task 1: complete (orderService.js + test, 27/27 pass, no commit)
- Task 2: complete (balcao.html embedded+formatarSabores, node --check OK, no commit)
- Task 3: complete (admin.html head CDNs + btn producao, node --check OK, no commit)
- Task 4: complete + fix (1:1 itens map, bairrosAtendidos fetch, node --check OK)
- Task 5: complete (admin.html agruparItensComNovos, node --check OK, no commit)
- Revisao: complete (inline, 2 findings F1/F2 corrigidos + re-check; 27/27 tests)
- Testes navegador: BLOQUEADO — sem MCP browser conectado (tools ativos: context7 apenas)
- E2E Playwright: 14/15 pass; failed = login.html:112 registerForm null (bug pre-existente, fora do escopo)
- Cleanup E2E: produto+pedidos de teste removidos; server E2E parado

---
## SDD Progress — Gestão de Clientes Superadmin (2026-08-09)

Plano: `docs/superpowers/plans/2026-08-09-gestao-clientes-superadmin.md`
Modo: opção C (zero commits, revisão inline, testes browser pós-revisão)
BASE: working tree (sem commits)

- Task 1: complete (clientService.js + test, 8/8 pass, no commit)
- Task 2: complete (clientAdminController.js + adminRoutes.js, modules load, server starts, no commit)
- Task 3: complete (superadmin.html tab + modais + query param + CSS modais, syntax valid, no commit)
- Task 4: complete (dashboard.html submenu Clientes item added, no commit)
- Task 5: BLOCKED — DB schema mismatch (clientes table missing consentimento_at/consentimento_revogado_at columns). clientService.js returns fields not in Prisma schema. Unit tests pass (mocks), but APIs return 500. Playwright not configured. Zero commits respected.
