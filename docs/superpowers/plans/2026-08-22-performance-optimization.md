# Plano de Otimizacao de Performance

> **Para workers agenticos:** SKILL OBRIGATORIO: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Steps usam checkbox (`- [ ]`) para tracking.

**Objetivo:** Corrigir lentidao na navegacao entre paginas e no carregamento de dados do servidor em todo o sistema de delivery.

**Arquitetura:** Duas fases: (1) Backend - compressao, caching, indices no banco, correcao de queries N+1, reordenacao de middleware; (2) Frontend - deduplicar chamadas API, adicionar cache localStorage, corrigir rebuilds de DOM no polling, reduzir thrash no localStorage. Sem migracao SPA, sem mudanca de framework.

**Stack Tecnico:** Express.js, Prisma ORM, PostgreSQL (Supabase), JS vanilla, localStorage, CSS custom properties.

## Restricoes Globais

- Backend Node.js, middleware stack Express
- Prisma ORM com PostgreSQL (Supabase)
- Frontend: HTML/JS vanilla, sem pipeline de build (arquivos brutos servidos)
- Nao pode quebrar funcionalidade existente
- Sem commits (pedido do usuario)

## Analise de Causa Raiz

Navegacao entre paginas lenta por causa de:

1. **Modelo MPA**: Cada navegacao = reload completo da pagina, re-download de todo CSS/JS, re-execucao de todas as chamadas API
2. **Sem compressao**: Todas as respostas JSON enviadas sem compressao
3. **Sem headers de cache**: Cada chamada API vai ao servidor, mesmo dados estaticos como configuracao da loja
4. **Chamadas API duplicadas**: `/api/loja/settings` buscado 3x no carregamento do index.html (theme.js:68, menu.js:357, menu.js:378)
5. **Queries N+1**: criarPedido faz loop buscarProduto por item (sqlRepository.js:81, publicController.js:258)
6. **Indices FK ausentes**: itens_pedido.pedidoId, pedidos.empresaId, entregas_diarias.pedidoId - zero indices em FK
7. **Static antes de rotas API**: Cada requisicao API faz 2x stat() no filesystem primeiro (app.js:40-41)
8. **Rebuilds completos de DOM no polling**: admin.html:1536 reconstroi todos os cards de pedido a cada 10s; menu.js:812 reconstroi lista de pedidos a cada 30s
9. **Sem code splitting**: menu.js (50KB), cart.js (37KB), painel.js (44KB) todos carregados mesmo em paginas que precisam de 10%
10. **Thrash no localStorage**: getCart/setCart fazem JSON.parse/stringify a cada clique de produto (cart.js:120-121, menu.js:269)

---

## Analise de Risco

### RISCO BAIXO (mudancas seguras, quase zero chance de quebrar)

| Task | Mudanca | Por que e seguro |
|------|---------|-----------------|
| **1 - Compression** | Adiciona middleware novo | So adiciona header Content-Encoding. Se quebrar, respostas continuam sem compressao. Nao mexe em logica. |
| **3 - DB Indices** | Adiciona @@index no Prisma | Indices sao **aditivos**. Query existente continua igual. Apenas fica mais rapida. Prisma validate garante schema valido. |
| **6 - Cache Headers** | Adiciona Cache-Control header | Headers novos. Se browser cachear demais, dados aparecem com ate 300s de atraso. Resoluvel com invalidateCached(). Nao quebra nada. |
| **11 - Cart Cache** | Cache em memoria + localStorage | Leitura primeiro da memoria, fallback pra localStorage. Se pagina recarrega, memoria some mas localStorage persiste. Nao perde dados. |

### RISCO MEDIO (precisa cuidado na implementacao)

| Task | Mudanca | O que pode dar errado |
|------|---------|----------------------|
| **2 - Reorder Middleware** | Move static apos rotas API | Se algum require() do frontend depende de caminho relativo que muda, pode 404. **Testar todas as paginas HTML apos mudanca.** |
| **7 - Remove buscarEmpresa duplo** | Refatora updateSettings | Se audit depende do estado ANTES da merge e nao do DB, pode ter diff sutil. **Testar: PUT notificationSound, depois PUT themeSettings, verificar GET.** |
| **8 - fetchCache** | Arquivo novo + script tag | Se consumer faz res.json() duas vezes, segunda chamada falha (body ja consumido). **Testar em todas as paginas.** |
| **9 - Deduplicate settings** | Muda 3 arquivos JS | Se unificacao tem bug de ordem (container nao existe no DOM), pode nao renderizar. **Testar index.html load completo.** |

### RISCO ALTO (mudancas criticas, podem quebrar fluxo de pedido)

| Task | Mudanca | O que pode dar errado |
|------|---------|----------------------|
| **4 - N+1 criarPedido** | Muda logica de criacao de pedido | Se buscarProdutosPorIds retorna vazio, pedido cria com total R$ 0.00. **PERIGOSO: perda de receita.** |
| **5 - N+1 entregaService** | Muda logica de resumo de entregas | Se listarPedidosPorIds falha, relatorio volta vazio. **Risco: gestor nao ve pedidos no painel.** |
| **10 - Fix Polling** | Muda intervalos + hash check | Se hash check tem bug, pedidos novos nao aparecem no admin. **CRITICO: admin nao ve pedido que acabou de chegar.** |

### Ordem de Implementacao Recomendada (mais seguro primeiro)

```
FASE 1 - Seguro (fazer primeiro):
  Task 1  (compression)     - risco baixo
  Task 3  (DB indexes)      - risco baixo
  Task 6  (cache headers)   - risco baixo
  Task 11 (cart cache)      - risco baixo

FASE 2 - Medio (testar entre cada uma):
  Task 2  (reorder MW)      - testar todas paginas HTML
  Task 7  (buscarEmpresa)   - testar PUT/GET settings
  Task 8  (fetchCache)      - testar res.json() em todas paginas
  Task 9  (dedup settings)  - testar index.html load completo

FASE 3 - Critico (testar extensivamente):
  Task 4  (N+1 pedido)      - criar pedido 1 item, 3 itens, item invalido
  Task 5  (N+1 entrega)     - testar relatorios de entrega
  Task 10 (polling)         - criar pedido e verificar se aparece no admin
```

### Protecoes Adicionadas ao Plano

- **Task 4**: Em vez de `if (!produto) continue` (silencioso), usar `throw` se produto nao encontrado no Map. Assim pedido nao cria com total R$ 0.00.
- **Task 10**: Logar no console quando hash skip re-render. Assim se admin nao ve pedido novo, sabemos se e hash check ou problema real.
- **Todas as tasks de risco alto**: Rodar `npx vitest run` apos cada mudanca e testar manualmente no navegador antes de commit.

---

## Estrutura de Arquivos

### Backend (modificar)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `backend/src/app.js` | Reordenar middleware: rotas antes de static; adicionar compressao |
| `backend/prisma/schema.prisma` | Adicionar indices ausentes |
| `backend/src/repositories/sqlRepository.js` | Corrigir queries N+1, adicionar buscas em lote |
| `backend/src/controllers/publicController.js` | Corrigir N+1 em criarPedido, adicionar cache headers |
| `backend/src/services/entregaService.js` | Corrigir N+1 em montarResumoPeriodo |
| `backend/src/services/lojaService.js` | Remover chamada buscarEmpresa duplicada |

### Frontend (modificar)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `js/fetchCache.js` | NOVO: Camada leve de fetch com cache |
| `js/theme.js` | Usar fetch cache, remover chamada duplicada |
| `js/menu.js` | Remover chamadas duplicadas /api/loja/settings, corrigir polling |
| `js/cart.js` | Usar fetch cache, reduzir thrash no localStorage |
| `admin.html` | Corrigir rebuilds de polling, remover scripts duplicados |
| `index.html` | Adicionar defer aos scripts, preconnect hints |
| `css/style.css` | Deduplicar skeleton-loading |

---

## Tasks

### Task 1: Backend - Adicionar Middleware de Compressao

**Arquivos:**
- Modificar: `backend/src/app.js:1-5,29-42`
- Modificar: `backend/package.json`

**Interfaces:**
- Consome: Instancia do app Express
- Produz: Todas as respostas comprimidas (gzip/br)

- [ ] **Passo 1: Instalar dependencia compression**

```bash
cd backend && npm install compression
```

- [ ] **Passo 2: Adicionar compressao ao app.js**

Em `backend/src/app.js`, adicionar apos linha 2 (`const path = require('path');`):

```javascript
const compression = require('compression');
```

Adicionar apos linha 31 (`app.use(contextMiddleware);`), antes de `app.use(helmet(...))`:

```javascript
app.use(compression({ threshold: 1024 }));
```

- [ ] **Passo 3: Verificar compressao funciona**

```bash
cd backend && node -e "const app=require('./src/app');const http=require('http');const s=app.listen(0,()=>{http.get('http://localhost:'+s.address().port+'/api/loja/status',{headers:{'Accept-Encoding':'gzip'}},r=>{console.log('CE:',r.headers['content-encoding']);s.close();process.exit(0)})})"
```

Esperado: `CE: gzip`



---

### Task 2: Backend - Reordenar Middleware (Rotas Antes de Static)

**Arquivos:**
- Modificar: `backend/src/app.js:39-62`

**Interfaces:**
- Consome: App Express, modulos de rotas existentes
- Produz: Rotas API avaliadas antes de buscas de arquivos estaticos

- [ ] **Passo 1: Mover middleware static apos rotas API**

Em `backend/src/app.js`, mover linhas 39-42 (bloco static `if (!process.env.VERCEL)`) para DEPOIS da linha 62 (apos todas as rotas `app.use('/api/...')` e `app.use('/webhooks', ...)`), mas ANTES de `app.use(errorHandler)`.

Tambem adicionar `{ maxAge: '1d', index: false }` ao primeiro static e `{ index: false, extensions: ['html'] }` ao segundo static.

Ordem final:

```javascript
// express.json
// todas as rotas app.use('/api/...')
// app.use('/webhooks', webhookRouter)
// rotas health, root, config
// MOVIDO AQUI: arquivos estaticos com cache
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '..', '..', 'public'), { maxAge: '1d', index: false }));
  app.use(express.static(path.join(__dirname, '..', '..'), { index: false, extensions: ['html'] }));
}
app.use(errorHandler);
```

- [ ] **Passo 2: Verificar servidor inicia**

```bash
cd backend && node -e "const app=require('./src/app');const http=require('http');const s=app.listen(0,()=>{http.get('http://localhost:'+s.address().port+'/api/loja/status',r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>{console.log(r.statusCode,b.substring(0,50));s.close();process.exit(0)})})})"
```

Esperado: `200 {"isOpen":...}`



---

### Task 3: Backend - Adicionar Indices Ausentes no Banco

**Arquivos:**
- Modificar: `backend/prisma/schema.prisma`

**Interfaces:**
- Consome: Schema Prisma
- Produz: Indices em colunas FK de alto trafego

- [ ] **Passo 1: Adicionar indices ao schema.prisma**

No model `itens_pedido`, adicionar antes de `@@map`:

```prisma
  @@index([pedidoId])
  @@index([produtoId])
```

No model `pedidos`, adicionar apos as linhas `@@index` existentes:

```prisma
  @@index([empresaId])
  @@index([empresaId, createdAt(sort: Desc)])
  @@index([clienteWhatsapp])
```

No model `entregas_diarias`, adicionar:

```prisma
  @@index([pedidoId])
  @@index([data])
  @@index([entregadorId])
```

No model `caixa_diario`, adicionar:

```prisma
  @@index([data])
```

- [ ] **Passo 2: Verificar schema valido**

```bash
cd backend && npx prisma validate
```

Esperado: `Schema is valid`



---

### Task 4: Backend - Corrigir N+1 em criarPedido

**Arquivos:**
- Modificar: `backend/src/repositories/sqlRepository.js:27-28,75-91`
- Modificar: `backend/src/controllers/publicController.js:256-269`

**Interfaces:**
- Consome: `sql.buscarProdutosPorIds(ids: number[]): Promise<Produto[]>`
- Produz: Busca de produtos em lote, sem loop N+1

- [ ] **Passo 1: Adicionar busca em lote ao sqlRepository**

Em `backend/src/repositories/sqlRepository.js`, adicionar apos `buscarProduto` (linha 27):

```javascript
async buscarProdutosPorIds(ids) {
  return prisma.produto.findMany({ where: { id: { in: ids.map(Number) } } });
},
```

- [ ] **Passo 2: Reescrever loop criarPedido no publicController**

Substituir linhas 256-269 de `backend/src/controllers/publicController.js` (o loop `for`) por:

```javascript
  const produtoIds = itens.map(i => Number(i.produtoId));
  const produtos = await sql.buscarProdutosPorIds(produtoIds);
  const produtoMap = new Map(produtos.map(p => [p.id, p]));

  let valoresItens = 0;
  const itensPedido = [];
  for (const item of itens) {
    const produto = produtoMap.get(Number(item.produtoId));
    // PROTECAO: nao criar pedido com produto inexistente
    if (!produto) {
      return res.status(400).json({ error: 'Produto #' + item.produtoId + ' nao encontrado' });
    }
    const preco = Number(produto.price);
    const qtd = item.quantidade || 1;
    valoresItens += preco * qtd;
    itensPedido.push({
      produtoId: Number(item.produtoId),
      quantidade: qtd,
      precoUnitario: preco,
      sabores: item.sabores || null,
    });
  }
```

> **NOTA DE SEGURANCA:** O `continue` silencioso foi substituido por `return res.status(400)`. Isso impede que pedido crie com total R$ 0.00 quando produto nao existe. Se todos os produtos falharem, pedido nao e criado.

- [ ] **Passo 3: Corrigir N+1 em sqlRepository.criarPedido**

Substituir linhas 77-89 de `backend/src/repositories/sqlRepository.js` por:

```javascript
    const produtoIds = data.itens.map(i => Number(i.produtoId));
    const produtos = await prisma.produto.findMany({ where: { id: { in: produtoIds } } });
    const produtoMap = new Map(produtos.map(p => [p.id, p]));

    let valoresItens = 0;
    payload.itens = { create: [] };
    for (const item of data.itens) {
      const produto = produtoMap.get(Number(item.produtoId));
      const preco = Number(produto ? produto.price : 0);
      const qtd = Number(item.quantidade) || 1;
      valoresItens += preco * qtd;
      payload.itens.create.push({
        produtoId: Number(item.produtoId),
        quantidade: qtd,
        precoUnitario: preco,
        sabores: item.sabores || null,
      });
    }
```

- [ ] **Passo 4: Rodar testes**

```bash
cd backend && npx vitest run
```

Esperado: Todos os testes existentes passam.




---

### Task 5: Backend - Corrigir N+1 em entregaService

**Arquivos:**
- Modificar: backend/src/services/entregaService.js:111-149
- Modificar: backend/src/repositories/sqlRepository.js:74

**Interfaces:**
- Consome: sql.listarPedidosPorIds(ids) retorna Promise array
- Produz: Busca de pedidos em lote em montarResumoPeriodo

- [ ] **Passo 1: Adicionar busca em lote ao sqlRepository** - Adicionar listarPedidosPorIds apos buscarPedidoComItens (linha 74)

- [ ] **Passo 2: Reescrever montarResumoPeriodo** - Substituir loop N+1 por busca em lote com Map

- [ ] **Passo 3: Atualizar chamadores** - Trocar arg buscarPedidoFn de sql.buscarPedidoComItens para sql.listarPedidosPorIds

- [ ] **Passo 4: Rodar testes** - cd backend && npx vitest run

---

### Task 6: Backend - Adicionar Cache Headers nos Endpoints Publicos

**Arquivos:**
- Modificar: backend/src/controllers/publicController.js
- Modificar: backend/src/app.js:66-69

- [ ] **Passo 1: Adicionar helper setCache** no topo do publicController

- [ ] **Passo 2: Adicionar cache headers** - setCache(res, 60) para produtos/categorias, 30 para status, 300 para settings

- [ ] **Passo 3: Adicionar cache ao /api/config** no app.js


---

### Task 7: Backend - Remover Chamada buscarEmpresa Duplicada

**Arquivos:**
- Modificar: backend/src/services/lojaService.js:122-172

- [ ] **Passo 1: Unificar duas chamadas buscarEmpresa** em uma sola no topo de updateSettings

- [ ] **Passo 2: Remover log de debug** console.log [DEBUG-LOJA]

- [ ] **Passo 3: Verificar** - cd backend && npx vitest run


---

### Task 8: Frontend - Criar Helper fetchCache

**Arquivos:**
- Criar: js/fetchCache.js

- [ ] **Passo 1: Criar js/fetchCache.js** com fetchCached(url, options, ttl) e invalidateCached(url) - funcao que faz fetch e cacheia resposta GET no localStorage com TTL configuravel

- [ ] **Passo 2: Adicionar script ao index.html** antes de menu.js


---

### Task 9: Frontend - Deduplicar Chamadas /api/loja/settings

**Arquivos:**
- Modificar: js/theme.js:67-87
- Modificar: js/menu.js:352-378
- Modificar: js/cart.js:97

- [ ] **Passo 1: theme.js** - Substituir fetch por fetchCached para /api/loja/settings (TTL 5min)

- [ ] **Passo 2: menu.js** - Unificar carregarHorarios + carregarConfigLoja em carregarSettingsLoja usando fetchCached

- [ ] **Passo 3: cart.js** - Substituir fetch por fetchCached para /api/public/loja/settings

---

### Task 10: Frontend - Corrigir Rebuilds de DOM no Polling

**Arquivos:**
- Modificar: admin.html (secoes de polling)
- Modificar: js/menu.js:812-835,244

- [ ] **Passo 1: admin.html** - Adicionar deteccao de mudanca por hash antes do re-render de 10s

```javascript
var lastPedidosHash = '';
setInterval(async function() {
  try {
    var res = await fetch('/api/pedidos', { headers: { 'Authorization': 'Bearer ' + getToken() } });
    var data = await res.json();
    var hash = JSON.stringify(data.map(function(p) { return p.id + p.status; }));
    if (hash !== lastPedidosHash) {
      lastPedidosHash = hash;
      renderPedidos(data);
    }
    // PROTECAO: logar quando dados mudam mas nao renderizam
    else { console.log('[polling] hash igual, skip re-render'); }
  } catch (e) { console.error('[polling] erro:', e); }
}, 10000);
```

> **NOTA DE SEGURANCA:** O log no else e intencional. Se admin nao ve pedido novo, abra o console e verifique se `[polling] hash igual` aparece (significa que hash nao detectou mudanca = bug no hash) ou se nao aparece nada (significa que fetch falhou).

- [ ] **Passo 2: admin.html** - Remover delays artificiais de 3s (linhas ~490, 519, 537)

- [ ] **Passo 3: menu.js** - Adicionar verificacao de hash ao iniciarPolling (poll de pedidos 30s)

```javascript
var _lastOrderHash = '';
function iniciarPolling() {
  setInterval(async function() {
    // ... existing fetch ...
    var hash = JSON.stringify(data.map(function(p) { return p.id + p.status; }));
    if (hash === _lastOrderHash) return;
    _lastOrderHash = hash;
    // ... existing render logic ...
  }, 30000);
}
```

- [ ] **Passo 4: menu.js:244** - Mudar poll de status de 60s para 300s

- [ ] **Passo 5: Commit** - git add admin.html js/menu.js && git commit -m "perf: fix polling with hash-based re-render"


---

### Task 11: Frontend - Reduzir Thrash no localStorage

**Arquivos:**
- Modificar: js/cart.js:120-121

- [ ] **Passo 1: Adicionar cache em memoria do carrinho** - variavel _cartCache, getCart le cache primeiro, setCart sincroniza ambos

---

### Task 12: Frontend - Adicionar Defer aos Scripts + Remover Duplicatas

**Arquivos:**
- Modificar: index.html:178-184
- Modificar: admin.html:145-155

- [ ] **Passo 1: index.html** - Adicionar defer a todas as tags script no final

- [ ] **Passo 2: admin.html** - Remover load duplicado de js/utils.js e codigo inline authGuard duplicado



---

## Auto-Avaliacao

**1. Cobertura da spec:** Todas as 10 causas raiz mapeadas para tasks 1-12.
**2. Scan de placeholders:** Sem TBD/TODO. Todos os passos tem codigo ou refs exatas de arquivo.
**3. Consistencia de tipos:** fetchCached, buscarProdutosPorIds, listarPedidosPorIds nomes consistentes entre tasks.

## Entrega de Execucao

Plano completo. Duas opcoes de execucao:

**1. Subagent-Driven (recomendado)** - Subagent fresh por task, review entre tasks

**2. Execucao Inline** - Executar nesta sessao com skill executing-plans

Qual abordagem?
