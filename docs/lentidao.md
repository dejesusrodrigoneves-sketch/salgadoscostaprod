# Análise de Lentidão do Sistema — Salgados Costa

> **Data:** 2026-08-10  
> **Escopo:** Frontend público (index.html, menu.js, cart.html) + Backend Express + Prisma/PostgreSQL  
> **Ambientes:** Desenvolvimento (localhost:3000) + Produção (Vercel)  
> **Sintoma:** Lentidão geral — carregamento inicial, busca no DB, abertura de overlays, criação de pedidos

---

## 1. Causas Raiz Identificadas

### 1.1 Backend — Database & Prisma

| # | Causa | Arquivo:Linha | Evidência | Impacto |
|---|-------|---------------|-----------|---------|
| DB-1 | **N+1 em `criarPedido`** | `sqlRepository.js:74-84` | Loop `for` chama `buscarProduto` por item do carrinho | Criação de pedido O(n) queries; 10 itens = 10 queries extras |
| DB-2 | **`listarCategorias` carrega TODOS produtos** | `sqlRepository.js:174` | `include: { produtos: true }` | Retorna catálogo completo (~KB/MB) só para popular dropdown de categorias |
| DB-3 | **`listarProdutos` sempre inclui categoria** | `sqlRepository.js:7` | `include: { category: true }` | Overhead desnecessário se frontend não usa categoria na listagem inicial |
| DB-4 | **`listarPedidosCliente` inclui itens + produto** | `publicController.js:239` | `include: { itens: { include: { produto: true } } }` | Histórico pesado; cada pedido traz itens completos com produto |
| DB-5 | **Sem índices no banco** | `schema.prisma` | Campos `clienteWhatsapp`, `status`, `createdAt`, `empresaId` sem `@@index` | Full table scan em queries filtradas |
| DB-6 | **Pool de conexão não configurado** | `prisma.js:4-6` | Apenas `log: ['warn','error']` | Conexões esgotam sob carga; timeouts em produção serverless |
| DB-7 | **`buscarPedidoComItens` duplicado** | `sqlRepository.js:63-67` | Igual a `buscarPedido` mas com select no produto | Código duplicado, manutenção |

### 1.2 Backend — Middleware & Express

| # | Causa | Arquivo:Linha | Evidência | Impacto |
|---|-------|---------------|-----------|---------|
| MW-1 | **`contextMiddleware` em TODAS rotas** | `app.js:29` | Executa antes de qualquer rota | Gera UUID v4 + extrai IP + UA a cada request (mesmo `/health`, assets estáticos) |
| MW-2 | **Helmet CSP pesado** | `app.js:30` | Diretivas longas inline | Headers `Content-Security-Policy` grandes (~500 bytes) em todas respostas |
| MW-3 | **Rate limit global 60 req/min** | `app.js:41` + `rateLimit.js:12-18` | `apiLimiter` aplicado em `/api/*` | Throttle legítimo em picos (ex: carregar menu + categorias + status) |
| MW-4 | **Sem compressão HTTP** | `app.js` (ausente) | Sem `compression()` middleware | JSON responses grandes (produtos, pedidos) trafegam sem gzip/brotli |
| MW-5 | **Static duplo em dev** | `app.js:38-39` | Duas pastas: `public` + root | Lookup duplicado de arquivos estáticos |
| MW-6 | **CORS wildcard** | `app.js:31-35` | `origin: '*'` | Sem cache CORS; preflight em requests autenticados |

### 1.3 Frontend — Carregamento & Assets

| # | Causa | Arquivo:Linha | Evidência | Impacto |
|---|-------|---------------|-----------|---------|
| FE-1 | **CSS não minificado (1752 linhas)** | `style.css` | ~50KB+ bloqueando render | Parser CSS bloqueia first paint |
| FE-2 | **JS monolíticos grandes** | `menu.js` 37KB, `painel.js` 34KB, `cart.js` 28KB | Single files, sem code splitting | Parse + execução única grande no main thread |
| FE-3 | **Google Fonts bloqueante** | `index.html:7-9` | `<link rel="preconnect">` + `<link href="...css2?family=Plus+Jakarta+Sans...">` | Request extra crítico antes de texto renderizar |
| FE-4 | **Iconify CDN externo** | `index.html:180` | `<script src="https://code.iconify.design/...">` | Terceiro partido; pode falhar ou ser lento |
| FE-5 | **Google Maps iframe no load** | `index.html:70-75` | `<iframe src="https://www.google.com/maps/...">` loading="lazy" ajuda mas ainda carrega | Recursos pesados (map tiles, JS) competem com main thread |
| FE-6 | **Sem cache de produtos/categorias** | `menu.js:176-187` | `loadProducts()` / `loadCategories()` fetch a cada reload | Round-trip desnecessário em navegação interna |
| FE-7 | **Calls sequenciais desnecessários** | `menu.js:197-198` | `loadCategories()` → `loadProducts()` (await serial) | Latência somada; podem ser `Promise.all` |
| FE-8 | **Skeleton loading mas sem streaming** | `menu.js:148-154` | HTML de skeleton gerado em JS | Poderia vir do server via streaming/SSR parcial |
| FE-9 | **Imagens sem otimização** | `menu.js:85` | `<img src="${prod.img}" loading="lazy">` | Sem WebP/AVIF, sem srcset, sem placeholder blur |

### 1.4 Produção (Vercel) — Serverless Específicos

| # | Causa | Evidência | Impacto |
|---|-------|-----------|---------|
| PR-1 | **Cold starts frequentes** | Função única Express + Prisma init | 500ms-2s na primeira request após idle |
| PR-2 | **Sem connection pooling gerenciado** | Prisma direto no PostgreSQL gerenciado (Supabase/Neon/Railway) | Conexões esgotam rápido; `P1001` / `P1008` errors |
| PR-3 | **Função única (monolito serverless)** | Todo Express em uma função Vercel | Escala tudo junto; memória/CPU desperdiçada |
| PR-4 | **Assets estáticos via Express em dev** | `app.use(express.static(...))` | Em produção Vercel serve via `@vercel/static` — comportamentos diferentes |
| PR-5 | **Logs síncronos no startup** | `server.js:9-18` — audit cleanup no `listen` | Atraso no ready; pode falhar health check |

---

## 2. Plano de Correção — 3 Alternativas

### Alternativa A — Quick Wins (⭐ Recomendada para começar)
**Esforço:** 1-2 dias | **Risco:** Baixo | **Impacto estimado:** 60-70% redução latência percebida

| Etapa | Ação | Arquivos | Validação |
|-------|------|----------|-----------|
| A1 | Adicionar índices no Prisma schema | `schema.prisma` | `npx prisma migrate dev`; `EXPLAIN ANALYZE` mostra Index Scan |
| A2 | Corrigir N+1 em `criarPedido` — batch fetch produtos | `sqlRepository.js:69-91` | Log queries: 1 query `IN (...)` em vez de N |
| A3 | Remover `include: { produtos: true }` de `listarCategorias` | `sqlRepository.js:174` | Payload `/categorias` cai de ~50KB para ~2KB |
| A4 | Tornar `category` opcional em `listarProdutos` (param `?includeCategory=true`) | `sqlRepository.js:7`, `productRoutes.js`, `productController.js` | Default sem categoria; admin passa flag |
| A5 | Adicionar `compression()` middleware | `app.js` (novo import + `app.use(compression())`) | `Content-Encoding: gzip` nas respostas JSON |
| A6 | Cache-Control em endpoints públicos read-only | `publicController.js:36-43` | `res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')` |
| A7 | Paralelizar `loadCategories` + `loadProducts` no frontend | `menu.js:197-198` | `Promise.all([loadCategories(), loadProducts()])` |
| A8 | Mover `contextMiddleware` para rotas `/api/*` apenas | `app.js:29` → após static | Assets estáticos não geram UUID/IP/UA |
| A9 | Ajustar rate limit: separar auth (restrito) de API pública (mais permissivo) | `rateLimit.js`, `app.js:41` | `apiLimiter` 120 req/min; `authLimiter` mantém 5/15min |
| A10 | Configurar Prisma connection pool | `prisma.js` | `new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=10' } } })` |

---

### Alternativa B — Otimizações Estruturais (Médio prazo)
**Esforço:** 1-2 semanas | **Risco:** Médio | **Impacto:** +20-30% sobre A (escalabilidade real)

| Etapa | Ação | Arquivos/Infra | Validação |
|-------|------|----------------|-----------|
| B1 | **Pagination** em `listarProdutos`, `listarPedidos`, `listarPedidosCliente` | `sqlRepository.js`, controllers, frontend (infinite scroll / load more) | `take/skip` ou cursor; response < 50KB |
| B2 | **Code splitting frontend** — lazy load `painel.js`, `cart.js`, `superadmin-audit.js` | `index.html`, `cart.html`, `view/*`, build (Vite/esbuild) | `menu.js` inicial < 15KB; chunks sob demanda |
| B3 | **Minificação + hashing** CSS/JS via build tool | `package.json` (add Vite), `vite.config.js` | Assets `.min.[hash].css/.js`; `Cache-Control: immutable` |
| B4 | **Service Worker** (Workbox) — cache assets + API GET | `sw.js`, `vite.config.js` (PWA plugin) | Offline-first; `stale-while-revalidate` para produtos |
| B5 | **Otimização de imagens** — WebP/AVIF, srcset, placeholder blur | `menu.js:85`, build pipeline (sharp) | LCP < 2.5s; CLS < 0.1 |
| B6 | **Prisma Accelerate / PgBouncer** para connection pooling gerenciado | `prisma.js`, env `DATABASE_URL` com pooling | 0 erros `P1001` sob carga; cold start < 200ms |
| B7 | **Separar rotas admin/painel** em sub-app ou function própria | `adminRoutes`, `painel.js` | Função Vercel menor; cold start admin isolado |
| B8 | **Edge Middleware** para auth/rate-limit (Vercel Edge) | `middleware.ts` | Latência auth ~0ms; reduz carga na function |
| B9 | **Preload crítico** — fonts, CSS, hero image | `index.html:7-15` | `<link rel="preload" as="font" crossorigin>`, `fetchpriority="high"` |
| B10 | **Remover Google Maps iframe** → static image + link "Ver no Maps" | `index.html:70-75` | Elimina 3rd party pesado; link abre nova aba |

---

### Alternativa C — Rearquitetura Serverless (Longo prazo / Escala)
**Esforço:** 2-4 semanas | **Risco:** Alto | **Necessário se:** > 1000 req/min sustentado ou multi-tenant

| Etapa | Ação | Detalhes |
|-------|------|----------|
| C1 | **Split Express → Vercel Functions** por domínio | `/api/public/*` → `api/public/[...slug].ts`, `/api/admin/*` → `api/admin/[...slug].ts`, etc. |
| C2 | **Prisma Data Proxy / Accelerate** obrigatório | Connection pooling gerenciado; edge caching |
| C3 | **API Routes tipadas** (tRPC / OpenAPI + Orval) | Type-safety ponta-a-ponta; gera client frontend |
| C4 | **Edge Config / KV** para flags, settings, rate-limit | Latência zero para configurações |
| C5 | **ISR / SSR parcial** para páginas públicas (Next.js ou Vercel Edge) | `index.html` gerado no edge; TTFB < 100ms |
| C6 | **Observabilidade** — OpenTelemetry + Vercel Logs + Sentry | Traces end-to-end; alertas P99 > 500ms |
| C7 | **Multi-tenancy real** (schema por empresa ou row-level security) | Isolamento dados; escala horizontal |
| C8 | **Testes de carga** (k6 / artillery) no CI | Gate de performance: P95 < 300ms |

---

## 3. Priorização Sugerida (Roadmap)

```
Semana 1-2:  Alternativa A completa (10 tarefas)  →  Deploy produção
Semana 3-4:  Alternativa B1-B6 (pagination, code split, build, SW, images, pool)
Semana 5-6:  Alternativa B7-B10 (separar admin, edge middleware, preload, maps)
Mês 3+:      Alternativa C (apenas se métricas justificarem)
```

**Métricas de sucesso por fase:**

| Fase | Métrica | Target |
|------|---------|--------|
| A | TTFB `/api/public/produtos` | < 150ms (p95) |
| A | LCP `index.html` (mobile 3G) | < 3s |
| B | Bundle `menu.js` inicial | < 15KB gzipped |
| B | Cold start Vercel | < 300ms |
| B | Erros Prisma P1001/P1008 | 0/dia |
| C | P95 latência global | < 200ms |

---

## 4. Como Validar Localmente (Antes de Deploy)

```bash
# 1. Índices
npx prisma migrate dev --name add_perf_indexes
npx prisma db pull  # verifica índices criados

# 2. Queries N+1
DEBUG="prisma:query" npm run dev  # logs SQL no console

# 3. Compression
curl -H "Accept-Encoding: gzip" -I http://localhost:3000/api/public/produtos
# deve retornar: content-encoding: gzip

# 4. Cache-Control
curl -I http://localhost:3000/api/public/categorias
# deve retornar: cache-control: public, max-age=60, stale-while-revalidate=300

# 5. Bundle size (após B2-B3)
npm run build && npx vite-bundle-analyzer dist

# 6. Lighthouse CI
npx lhci autorun  # CI gate: performance > 90
```

---

## 5. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migração de índices trava tabela (PostgreSQL) | Baixa | Alto | `CONCURRENTLY` em migration raw SQL; testar em staging |
| Cache-Control stale serve dados desatualizados | Média | Baixo | `stale-while-revalidate` + invalidação manual em mutations |
| Code splitting quebra navegadores antigos | Baixa | Médio | `nomodule` fallback; target `es2020`+ |
| Prisma Accelerate custo extra | Certa | Baixo | Gratuito até 1M req/mês; avaliar custo/benefício |
| Vercel Functions split aumenta complexidade deploy | Média | Médio | Monorepo + `vercel.json` com `functions` config |

---

## 6. Checklist de Execução (Alternativa A)

- [ ] **A1** Índices: `clienteWhatsapp`, `status`, `createdAt`, `empresaId` (compostos onde filtro + orderBy)
- [ ] **A2** `criarPedido` batch fetch: `prisma.produto.findMany({ where: { id: { in: ids } } })`
- [ ] **A3** `listarCategorias` sem `include: { produtos }`
- [ ] **A4** `listarProdutos` param `includeCategory` (default false)
- [ ] **A5** `npm i compression` + `app.use(compression())`
- [ ] **A6** `Cache-Control` em `/produtos`, `/categorias`, `/loja/status`, `/loja/settings`
- [ ] **A7** `Promise.all([loadCategories(), loadProducts()])` no `menu.js`
- [ ] **A8** `contextMiddleware` apenas rotas `/api/*`
- [ ] **A9** Rate limit: `apiLimiter` 120/min; `authLimiter` mantém
- [ ] **A10** Prisma `connection_limit=10`, `pool_timeout=10` na connection string

---

## 7. Referências Técnicas

- [Prisma Indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)
- [Prisma Connection Pool](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [Vercel Edge Middleware](https://vercel.com/docs/edge-middleware)
- [Web.dev Optimize LCP](https://web.dev/optimize-lcp/)
- [HTTP Caching MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Compression middleware](https://github.com/expressjs/compression)

---

> **Próximo passo:** Aprovação deste plano → criar implementation plan via `writing-plans` skill → executar Alternativa A.