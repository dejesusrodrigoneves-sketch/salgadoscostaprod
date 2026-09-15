# Matriz de Segurança — Rotas

| Rota | Método | Auth | Papel | Tenant | ID Access | Isolamento |
|---|---|---|---|---|---|---|
| `/api/produtos` | GET | JWT | admin/clientAdmin | empresaId token | — | service scopa |
| `/api/produtos/:id` | GET | JWT | admin/clientAdmin | empresaId token | sim | service scopa |
| `/api/produtos` | POST | JWT | admin | empresaId token | — | repo scopa |
| `/api/produtos/:id` | PUT | JWT | admin | empresaId token | sim | repo scopa |
| `/api/produtos/:id` | DELETE | JWT | admin | empresaId token | sim | repo scopa |
| `/api/categorias` | GET | JWT | admin/clientAdmin | empresaId token | — | service scopa |
| `/api/categorias` | POST | JWT | admin | empresaId token | — | repo scopa |
| `/api/categorias/:id` | PUT | JWT | admin | empresaId token | sim | repo scopa |
| `/api/categorias/:id` | DELETE | JWT | admin | empresaId token | sim | repo scopa |
| `/api/pedidos` | GET | JWT | admin/clientAdmin | empresaId token | — | service scopa |
| `/api/pedidos/:id` | GET | JWT | admin/clientAdmin | empresaId token | sim | service scopa |
| `/api/pedidos/:id/status` | PUT | JWT | admin/clientAdmin | empresaId token | sim | service scopa |
| `/api/pedidos/:id` | DELETE | JWT | admin | empresaId token | sim | service scopa |
| `/api/clientes` | GET | JWT | admin/clientAdmin | empresaId token | — | service scopa |
| `/api/clientes/:id` | PUT | JWT | superadmin | global | sim | por design |
| `/api/clientes/:id` | DELETE | JWT | superadmin | global | sim | por design |
| `/api/admin/empresas` | GET | JWT | superadmin | global | — | — |
| `/api/admin/empresas` | POST | JWT | superadmin | global | — | — |
| `/api/admin/empresas/:id` | PUT | JWT | superadmin | global | sim | por design |
| `/api/admin/empresas/:id` | DELETE | JWT | superadmin | global | sim | por design |
| `/api/admin/usuarios` | GET | JWT | superadmin | global | — | — |
| `/api/admin/usuarios` | POST | JWT | superadmin | global | — | — |
| `/api/admin/usuarios/:id` | PUT | JWT | superadmin | global | sim | por design |
| `/api/admin/usuarios/:id` | DELETE | JWT | superadmin | global | sim | por design |
| `/api/admin/entregadores/:id` | PUT | JWT | admin | empresaId token | sim | whitelist campos |
| `/api/entregadores` | GET | JWT | admin | empresaId token | — | service scopa |
| `/api/entregadores` | POST | JWT | admin | empresaId token | — | repo scopa |
| `/api/entregadores/:id` | DELETE | JWT | admin | empresaId token | sim | repo scopa |
| `/api/public/produtos` | GET | público | — | `?slug`/Origin | — | scopa |
| `/api/public/categorias` | GET | público | — | `?slug`/Origin | — | scopa |
| `/api/public/pedidos` | POST | público | — | `?slug`/Origin | — | empresaId + server calc |
| `/api/public/pedidos/:id` | GET | público | — | `?slug`/Origin | sim | empresaId |
| `/api/public/cupons/:codigo` | GET | público | — | `?slug`/Origin | — | empresaId |
| `/api/public/loja/status` | GET | público | — | `?slug`/Origin | — | — |
| `/api/public/loja/contact` | GET | público | — | `?slug`/Origin | — | — |
| `/api/auth/login` | POST | público | — | — | — | — |
| `/api/auth/register` | POST | público | — | — | — | rate limit |
| `/api/platform/*` | * | JWT | superadmin | global | — | — |
| `/api/webhooks/*` | POST | assinatura | — | — | — | webhook sig |

## Fixations Applied (Fase 3)

| Achado | Fix | Teste |
|---|---|---|
| Cross-tenant produto lookup | `empresaId` no `findMany` | `pedidoSeguro.test.js` |
| Mass assignment pedido | Whitelist de campos | `pedidoSeguro.test.js` |
| Client controls total | `valoresItens` sempre recalculado | `pedidoSeguro.test.js` |
| Client controls desconto/taxas | Server-side via `pricingPolicy` | `publicController.criarPedido` |
| Coupon double-use | `consumirCupom` atomic `updateMany` | `cupomAtomico.test.js` |
| Stock oversell | `baixarEstoque` atomic `updateMany` | `estoqueAtomico.test.js` |
| Driver mass assignment | Whitelist de campos | `driverWhitelist.test.js` |
| `?slug=` IDOR | Removido fallback `?slug=` | `resolveEmpresa.test.js` |
| `.default` bug | Removido `.default` do import | `publicRoutes.js:4` |
