## Objective
- Refatorar carrinho para organizar itens por categoria (como no index.html) e melhorar usabilidade/design
- Sem quebrar lógica atual de pedidos, sabores e cupons

## Important Details
- Plan mode: não comitar nem fazer push dos changes da sessão atual
- Produtos já vêm com `category` incluso no payload (`listarProdutos()` faz `include: { category: true }`)
- Evolution API (Railway) retorna QR no formato Baileys antigo (`2@...`), sem `pairingCode` — WhatsApp mobile não reconhece

## Work State
### Completed (sessão atual — sem commit)
- `js/cart.js` — `renderizaItens()` agrupa itens por categoria com headers visuais (`.cat-header` + `.cat-count`)
- `js/cart.js` — geolocalização não bloqueia mais pedido (coords opcionais)
- `js/cart.js` — loading state no botão "Gerar Pedido" (`disabled` + "Gerando...")
- `js/cart.js` — `mostrarConfirmacaoPedido()` + `fecharOverlay()` overlay de confirmação pós-pedido
- `js/cart.js` — `getProductsMap()` síncrona inline (substitui versão async)
- `js/cart.js` — removido `gerarPedidoSequencial()` (dead code)
- `js/cart.js` — CEP (ViaCEP) auto-preenche endereço, bairro, cidade, estado onblur
- `js/cart.js` — hidden fields `cidadeCliente` / `estadoCliente` recebem `userLogged.cidade/estado`
- `view/cart.html` — adicionados hidden inputs `#cidadeCliente`, `#estadoCliente` + overlay HTML
- `css/cart.css` — estilos para `.category-group`, `.cat-header`, `.empty-cart`, `.overlay`, responsivo mobile

### Completed (sessões anteriores — commit `868d89b` pushed)
- `js/menu.js` + `js/cart.js` — imagens usam URL direta do Supabase (sem prefixo `./img/`)
- `backend/prisma/schema.prisma` — removido `type Int?` de Categoria; Produto.type agora `Int @default(0)`
- `backend/src/repositories/sqlRepository.js` — `listarProdutos()` inclui `category`; `listarCategorias()` inclui `produtos`
- `js/painel.js` — submit envia `categoryId`; `carregarCategorias()` renderiza sub-lista de itens + botão **[+ Item]**
- `painelLoja.html` — removido campo `catType` do form de categoria e campo `prodType` do form de produto
- `index.html` — botões de filtro substituídos por container vazio `#categoryFilters`
- `js/menu.js` — `loadCategories()` dinâmico; `showProducts()` filtra por `categoryId`; removed toda lógica baseada em `type` (1‑6)

### Blocked
- Migration Prisma (`remove_legacy_type`) não aplicada: Supabase inacessível deste ambiente. Rodar manualmente no deploy (`cd backend && npx prisma migrate dev --name remove_legacy_type`)

## Relevant Files
- `js/cart.js`: categorias na render, loading, geo opcional, overlay, CEP lookup, dead code removal
- `view/cart.html`: hidden cidade/estado + overlay confirmation modal
- `css/cart.css`: category-group, cat-header, empty-cart, overlay, responsive
- `backend/prisma/schema.prisma`: Categoria.type removido, Produto.type `Int @default(0)`
- `backend/src/repositories/sqlRepository.js`: `include: { category: true }` e `include: { produtos: true }`
- `js/painel.js`: `carregarCategorias()` com sub‑itens, submit usa `categoryId`
- `js/menu.js`: filtros dinâmicos por `categoryId`
- `index.html`: container vazio `#categoryFilters` com "Tudo" + "Promoções"
