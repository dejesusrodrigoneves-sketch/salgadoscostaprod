# Multi-Tenant Implementation Plan (CORRIGIDO)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-tenant SIC-IA system into a fully multi-tenant platform with subdomain-based tenant isolation, JWT auth chain, and per-empresa data scoping.

**Architecture:** Subdomain-based multi-tenancy (`{slug}.sua-app.com`). Middleware chain: resolveEmpresa (Host→empresaId) → authenticate (JWT) → context (empresaId in req.ctx) → authorize (role+empresa check) → Prisma (WHERE empresaId). Superadmin gets `empresaId: null` for global access.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, JWT (jsonwebtoken), Vercel hosting

## Global Constraints

- `empresaId` nunca é constante — sempre vem de `req.ctx.empresaId`
- Subdomínio extraído do `Host` header — nunca de query param ou body
- Token JWT superadmin tem `empresaId: null`
- Cada empresa máx 1 instância WhatsApp
- Testes existentes: **55 testes em 9 arquivos** em `backend/tests/`, rodados de `backend/` via `npx vitest run`
- Schema Prisma inalterado (empresaId já existe em todos modelos). **Única exceção** — se mudar `nextPedidoId`, NÃO muda schema
- Vercel deployment preservado (`.vercel/`, `vercel.json`, `backend/api.js`)
- User instruction: NÃO commitar nada

**ARQUIVOS DE TESTE:** todos os novos testes vão em `backend/tests/`, rodam com `npx vitest run` **a partir de `backend/`**.

---

## Arquivos

### Novos
- `backend/src/config/empresaCache.js` — cache de empresas por slug (Map, TTL 5min)
- `backend/src/middleware/resolveEmpresa.js` — extrai subdomínio do Host, resolve empresa
- `backend/src/middleware/requireEmpresa.js` — bloqueia rotas de tenant sem ctx.empresaId
- `backend/src/utils/scopedWhere.js` — helper de escopo por empresa

### Modificados
- `backend/src/middleware/auth.js` — valida empresaId do token vs Host, superadmin bypass
- `backend/src/middleware/context.js` — inclui empresaId em req.ctx
- `backend/src/middleware/ownership.js` — superadmin bypass
- `backend/src/repositories/sqlRepository.js` — remove EMPRESA_ID=1, métodos recebem empresaId, pedido id prefixado
- `backend/src/services/authService.js` — login lê empresaId, superadmin empresaId null
- `backend/src/services/orderService.js` — empresaId param
- `backend/src/services/entregaService.js` — empresaId param
- `backend/src/services/userService.js` — empresaId param
- `backend/src/services/lojaService.js` — empresaId param
- `backend/src/services/paymentService.js` — empresaId do pedido (corrige `pedido` undefined)
- `backend/src/services/productService.js` — empresaId param
- `backend/src/services/whatsappInstanceService.js` — empresaId do ctx, limite 1, valida empresa
- `backend/src/services/whatsappService.js` — empresaId param
- `backend/src/services/categoriaService.js` — empresaId param
- `backend/src/controllers/authController.js` — criarConta/criarUsuario empresaId do ctx
- `backend/src/controllers/productController.js` — empresaId do ctx
- `backend/src/controllers/orderController.js` — empresaId do ctx
- `backend/src/controllers/publicController.js` — empresaId do resolveEmpresa + IDOR fix
- `backend/src/controllers/lojaController.js` — empresaId do ctx
- `backend/src/controllers/cashierController.js` — empresaId do ctx
- `backend/src/controllers/driverController.js` — empresaId do ctx
- `backend/src/controllers/categoriaController.js` — empresaId do ctx
- `backend/src/controllers/entregaController.js` — empresaId do ctx
- `backend/src/controllers/whatsappController.js` — empresaId do ctx
- `backend/src/controllers/clientAdminController.js` — empresaId do ctx
- `backend/src/routes/scheduleRoutes.js` — empresaId do ctx
- `backend/src/routes/paymentRoutes.js` — empresaId do ctx
- `backend/src/routes/orderRoutes.js` — legacy routes empresaId
- `backend/src/jobs/pixExpirationJob.js` — nova signature listarPedidosFiltrados
- `backend/src/app.js` — registra resolveEmpresa
- `js/apiHelper.js` — token por slug
- `superadmin.html` — detecção de subdomínio
- `admin.html` — detecção de subdomínio
- `backend/tests/sqlRepository.test.js` — signature update

---

## Task 1: empresaCache

**Files:**
- Create: `backend/src/config/empresaCache.js`
- Test: `backend/tests/empresaCache.test.js`

**Interfaces:**
- Produces: `getEmpresaFromCache(slug) → Promise<Empresa|null>`, `invalidateEmpresaCache(slug)`

- [ ] **Step 1: Criar teste**

```javascript
// backend/tests/empresaCache.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// prisma.js exporta CLIENT DIRETO (module.exports = prisma), NÃO {default}
vi.mock('../src/config/prisma', () => ({
  empresa: { findUnique: vi.fn() },
}));

describe('empresaCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna empresa do cache no segundo acesso', async () => {
    const prisma = require('../src/config/prisma');
    prisma.empresa.findUnique.mockResolvedValue({ id: 1, slug: 'test', nome: 'Test' });

    const { getEmpresaFromCache } = require('../src/config/empresaCache');
    const e1 = await getEmpresaFromCache('test');
    const e2 = await getEmpresaFromCache('test');

    expect(e1.id).toBe(1);
    expect(e2.id).toBe(1);
    expect(prisma.empresa.findUnique).toHaveBeenCalledTimes(1);
  });

  it('retorna null para slug inexistente', async () => {
    const prisma = require('../src/config/prisma');
    prisma.empresa.findUnique.mockResolvedValue(null);

    const { getEmpresaFromCache } = require('../src/config/empresaCache');
    const result = await getEmpresaFromCache('naoexiste');

    expect(result).toBeNull();
  });

  it('invalida cache corretamente', async () => {
    const prisma = require('../src/config/prisma');
    prisma.empresa.findUnique.mockResolvedValue({ id: 1, slug: 'test', nome: 'Test' });

    const { getEmpresaFromCache, invalidateEmpresaCache } = require('../src/config/empresaCache');
    await getEmpresaFromCache('test');
    invalidateEmpresaCache('test');
    await getEmpresaFromCache('test');

    expect(prisma.empresa.findUnique).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar teste (deve falhar)**

Run: `cd backend && npx vitest run tests/empresaCache.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implementar empresaCache**

```javascript
// backend/src/config/empresaCache.js
const prisma = require('./prisma');

const cache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getEmpresaFromCache(slug) {
  const entry = cache.get(slug);
  if (entry && Date.now() < entry.expirouEm) {
    return entry.empresa;
  }

  const empresa = await prisma.empresa.findUnique({ where: { slug } });
  if (empresa) {
    cache.set(slug, { empresa, expirouEm: Date.now() + TTL_MS });
  } else {
    cache.set(slug, { empresa: null, expirouEm: Date.now() + 60000 });
  }
  return empresa;
}

function invalidateEmpresaCache(slug) {
  cache.delete(slug);
}

module.exports = { getEmpresaFromCache, invalidateEmpresaCache };
```

- [ ] **Step 4: Rodar teste (deve passar)**

Run: `cd backend && npx vitest run tests/empresaCache.test.js`
Expected: PASS

---

## Task 2: resolveEmpresa middleware (corrigido para localhost)

**Files:**
- Create: `backend/src/middleware/resolveEmpresa.js`
- Test: `backend/tests/resolveEmpresa.test.js`

**Interfaces:**
- Consumes: `getEmpresaFromCache(slug)` from Task 1
- Produces: `resolveEmpresa(req, res, next)` — popula `req.ctx.empresaId` e `req.ctx.empresa`

- [ ] **Step 1: Criar teste**

```javascript
// backend/tests/resolveEmpresa.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/empresaCache', () => ({
  getEmpresaFromCache: vi.fn(),
}));

describe('resolveEmpresa middleware', () => {
  let resolveEmpresa;
  let getEmpresaFromCache;

  beforeEach(() => {
    vi.clearAllMocks();
    resolveEmpresa = require('../src/middleware/resolveEmpresa');
    getEmpresaFromCache = require('../src/config/empresaCache').getEmpresaFromCache;
  });

  function mockReq(host) {
    return { headers: { host }, ctx: {} };
  }

  function mockRes() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }

  it('resolve empresa válida', async () => {
    getEmpresaFromCache.mockResolvedValue({ id: 1, slug: 'test', nome: 'Test' });
    const req = mockReq('test.sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBe(1);
    expect(req.ctx.empresa.slug).toBe('test');
    expect(next).toHaveBeenCalled();
  });

  it('retorna 404 para slug inexistente', async () => {
    getEmpresaFromCache.mockResolvedValue(null);
    const req = mockReq('naoexiste.sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignora subdomínio www', async () => {
    const req = mockReq('www.sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('ignora localhost (dev)', async () => {
    const req = mockReq('localhost');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('ignora IP / sem ponto (dev)', async () => {
    const req = mockReq('127.0.0.1');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('ignora domínio raiz sem subdomínio', async () => {
    const req = mockReq('sua-app.com');
    const res = mockRes();
    const next = vi.fn();

    await resolveEmpresa(req, res, next);

    expect(req.ctx.empresaId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar teste (deve falhar)**

Run: `cd backend && npx vitest run tests/resolveEmpresa.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implementar resolveEmpresa**

```javascript
// backend/src/middleware/resolveEmpresa.js
const { getEmpresaFromCache } = require('../config/empresaCache');

const IGNORED = ['www', 'api', 'admin', 'mail', 'ftp'];

async function resolveEmpresa(req, res, next) {
  const host = req.headers.host || '';
  // Dev: localhost, 127.0.0.1, ou sem ponto = sem subdomínio
  if (!host.includes('.')) {
    return next();
  }
  const subdomain = host.split('.')[0];

  if (!subdomain || IGNORED.includes(subdomain)) {
    return next();
  }

  const empresa = await getEmpresaFromCache(subdomain);
  if (!empresa) {
    return res.status(404).json({ error: 'Loja não encontrada' });
  }

  req.ctx = req.ctx || {};
  req.ctx.empresaId = empresa.id;
  req.ctx.empresa = empresa;
  next();
}

module.exports = resolveEmpresa;
```

- [ ] **Step 4: Rodar teste (deve passar)**

Run: `cd backend && npx vitest run tests/resolveEmpresa.test.js`
Expected: PASS

---

## Task 3: requireEmpresa middleware

**Files:**
- Create: `backend/src/middleware/requireEmpresa.js`
- Test: `backend/tests/requireEmpresa.test.js`

**Interfaces:**
- Consumes: `req.ctx.empresaId`, `req.user.role`
- Produces: `requireEmpresa(req, res, next)` — bloqueia se ctx.empresaId ausente e role != superadmin

- [ ] **Step 1: Criar teste**

```javascript
// backend/tests/requireEmpresa.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('requireEmpresa middleware', () => {
  let requireEmpresa;

  beforeEach(() => {
    requireEmpresa = require('../src/middleware/requireEmpresa');
  });

  function mockRes() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }

  it('next() quando ctx.empresaId presente', () => {
    const req = { ctx: { empresaId: 1 }, user: { role: 'admin' } };
    const res = mockRes();
    const next = vi.fn();
    requireEmpresa(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('bloqueia quando ctx.empresaId ausente (user)', () => {
    const req = { ctx: {}, user: { role: 'user' } };
    const res = mockRes();
    const next = vi.fn();
    requireEmpresa(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('next() para superadmin sem ctx.empresaId', () => {
    const req = { ctx: {}, user: { role: 'superadmin' } };
    const res = mockRes();
    const next = vi.fn();
    requireEmpresa(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar teste (deve falhar)**

Run: `cd backend && npx vitest run tests/requireEmpresa.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implementar requireEmpresa**

```javascript
// backend/src/middleware/requireEmpresa.js
function requireEmpresa(req, res, next) {
  if (req.user && req.user.role === 'superadmin') {
    return next(); // superadmin acessa global sem empresaId
  }
  if (!req.ctx || !req.ctx.empresaId) {
    return res.status(403).json({ error: 'Escopo de empresa obrigatório' });
  }
  next();
}

module.exports = requireEmpresa;
```

- [ ] **Step 4: Rodar teste (deve passar)**

Run: `cd backend && npx vitest run tests/requireEmpresa.test.js`
Expected: PASS

---

## Task 4: scopedWhere helper

**Files:**
- Create: `backend/src/utils/scopedWhere.js`
- Test: `backend/tests/scopedWhere.test.js`

**Interfaces:**
- Produces: `scopedWhere(ctx, extra) → { empresaId?, ...extra }`

- [ ] **Step 1: Criar teste**

```javascript
// backend/tests/scopedWhere.test.js
import { describe, it, expect } from 'vitest';

describe('scopedWhere', () => {
  it('adiciona empresaId do ctx', () => {
    const scopedWhere = require('../src/utils/scopedWhere');
    const where = scopedWhere({ empresaId: 1 }, { deletedAt: null });
    expect(where).toEqual({ empresaId: 1, deletedAt: null });
  });

  it('superadmin global não filtra por empresa', () => {
    const scopedWhere = require('../src/utils/scopedWhere');
    const where = scopedWhere({ role: 'superadmin', empresaId: null }, { deletedAt: null });
    expect(where).toEqual({ deletedAt: null });
  });

  it('inclui extra sem empresa quando superadmin em empresa específica', () => {
    const scopedWhere = require('../src/utils/scopedWhere');
    const where = scopedWhere({ role: 'superadmin', empresaId: 2 }, { status: 'pendente' });
    expect(where).toEqual({ empresaId: 2, status: 'pendente' });
  });
});
```

- [ ] **Step 2: Rodar teste (deve falhar)**

Run: `cd backend && npx vitest run tests/scopedWhere.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implementar scopedWhere**

```javascript
// backend/src/utils/scopedWhere.js
function scopedWhere(ctx, extra = {}) {
  // Superadmin em admin.sua-app.com (empresaId null) => sem filtro de empresa
  if (ctx && ctx.role === 'superadmin' && !ctx.empresaId) {
    return extra;
  }
  return { empresaId: ctx?.empresaId, ...extra };
}

module.exports = scopedWhere;
```

- [ ] **Step 4: Rodar teste (deve passar)**

Run: `cd backend && npx vitest run tests/scopedWhere.test.js`
Expected: PASS

---

## Task 5: sqlRepository — remover EMPRESA_ID=1, pedido id prefixado

**Files:**
- Modify: `backend/src/repositories/sqlRepository.js` (arquivo inteiro)
- Test: `backend/tests/sqlRepository.test.js` (update signature)

**Interfaces:**
- Consumes: `empresaId` como parâmetro em cada método
- Produz: `nextPedidoId(empresaId)` → `${empresaId}-${padStart(3,'0')}` (previne colisão PK global)

- [ ] **Step 1: Atualizar teste sqlRepository (7 cases)**

Cada chamada `listarPedidosFiltrados({...})` → `listarPedidosFiltrados(1, {...})`. O `1` é empresa válida.

```javascript
// backend/tests/sqlRepository.test.js — substituir todo o conteúdo dos it()
import { describe, it, expect } from 'vitest';
import * as sqlRepository from '../src/repositories/sqlRepository.js';

describe('listarPedidosFiltrados - input sanitization (integration)', () => {
  it('handles empty status string', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(1, { status: '' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles invalid date strings', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(1, {
      createdAtFrom: 'invalid-date',
      createdAtTo: 'also-invalid'
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles undefined filtros', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(1, undefined);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles null filtros', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(1, null);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles valid status filter', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(1, { status: 'pendente' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles multiple status filter', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(1, { status: 'pendente,producao' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles valid date filter', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(1, {
      createdAtFrom: '2024-01-01',
      createdAtTo: '2024-12-31'
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Substituir sqlRepository inteiro**

```javascript
// backend/src/repositories/sqlRepository.js
const prisma = require('../config/prisma');

const sql = {
  // ---- Produtos ----
  async listarProdutos(empresaId) {
    return prisma.produto.findMany({ where: { empresaId }, include: { category: true } });
  },
  async buscarProduto(id, empresaId) {
    return prisma.produto.findFirst({ where: { id: Number(id), empresaId } });
  },
  async buscarProdutosPorIds(ids) {
    return prisma.produto.findMany({ where: { id: { in: ids.map(Number) } } });
  },
  async criarProduto(data) {
    const { id, empresaId, ...rest } = data;
    if (rest.categoryId) {
      rest.category = { connect: { id: rest.categoryId } };
      delete rest.categoryId;
    }
    return prisma.produto.create({
      data: { ...rest, empresa: { connect: { id: empresaId } } }
    });
  },
  async atualizarProduto(id, data) {
    const { id: _, empresaId, ...rest } = data;
    if (rest.categoryId) {
      rest.category = { connect: { id: rest.categoryId } };
      delete rest.categoryId;
    }
    return prisma.produto.update({ where: { id: Number(id) }, data: rest });
  },
  async deletarProduto(id) {
    return prisma.produto.delete({ where: { id: Number(id) } });
  },

  // ---- Pedidos ----
  async listarPedidos(empresaId, filtros = {}) {
    const where = { empresaId, deletedAt: null, ...filtros };
    return prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: true } });
  },
  async listarPedidosFiltrados(empresaId, filtros = {}) {
    const where = { empresaId, deletedAt: null };

    if (filtros?.status?.trim()) {
      const statusList = filtros.status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length === 1) where.status = statusList[0];
      else if (statusList.length > 1) where.status = { in: statusList };
    }

    if (filtros?.paymentStatus?.trim()) {
      const psList = filtros.paymentStatus.split(',').map(s => s.trim()).filter(Boolean);
      if (psList.length === 1) where.paymentStatus = psList[0];
      else if (psList.length > 1) where.paymentStatus = { in: psList };
    }

    const hasValidFrom = filtros?.createdAtFrom && !isNaN(Date.parse(filtros.createdAtFrom));
    const hasValidTo = filtros?.createdAtTo && !isNaN(Date.parse(filtros.createdAtTo));

    if (hasValidFrom || hasValidTo) {
      where.createdAt = {};
      if (hasValidFrom) where.createdAt.gte = new Date(filtros.createdAtFrom);
      if (hasValidTo) where.createdAt.lte = new Date(filtros.createdAtTo);
    }

    const order = (filtros?.order === 'asc') ? 'asc' : 'desc';
    return prisma.pedido.findMany({ where, orderBy: { createdAt: order }, include: { itens: true } });
  },
  async buscarPedido(id, empresaId) {
    const where = { id, deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    return prisma.pedido.findUnique({ where, include: { itens: true } });
  },
  async buscarPedidoComItens(id, empresaId) {
    const where = { id, deletedAt: null };
    if (empresaId) where.empresaId = empresaId;
    return prisma.pedido.findUnique({
      where,
      include: { itens: { include: { produto: { select: { name: true } } } } }
    });
  },
  async listarPedidosPorIds(ids) {
    return prisma.pedido.findMany({
      where: { id: { in: ids.map(Number) }, deletedAt: null },
      include: { itens: { include: { produto: { select: { name: true } } } } },
    });
  },
  async criarPedido(data) {
    const payload = { ...data };
    if (Array.isArray(data.itens)) {
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
      if (data.valoresItens === undefined || data.valoresItens === null) {
        payload.valoresItens = valoresItens;
      }
    }
    return prisma.pedido.create({ data: payload, include: { itens: true } });
  },
  async atualizarPedido(id, data) {
    return prisma.pedido.update({ where: { id }, data });
  },

  // ---- Webhooks / Pagamentos ----
  async buscarEventoWebhook(eventId) {
    return prisma.processedWebhook.findUnique({ where: { eventId } });
  },
  async criarEventoWebhook(eventId) {
    return prisma.processedWebhook.create({ data: { eventId } });
  },
  async listarPagamentosRejeitados(empresaId) {
    return prisma.pagamento.findMany({
      where: { empresaId, status: 'rejeitado', refundId: null },
      include: { pedido: true },
      orderBy: { rejeitadoEm: 'desc' },
    });
  },

  // ---- Entregadores ----
  async listarEntregadores(empresaId) {
    return prisma.entregador.findMany({ where: { empresaId } });
  },
  async buscarEntregador(id) {
    return prisma.entregador.findUnique({ where: { id: Number(id) } });
  },
  async criarEntregador(data) {
    return prisma.entregador.create({ data });
  },
  async toggleEntregador(id, ativo) {
    return prisma.entregador.update({ where: { id: Number(id) }, data: { ativo } });
  },
  async atualizarEntregador(id, data) {
    return prisma.entregador.update({ where: { id: Number(id) }, data });
  },
  async deletarEntregador(id) {
    return prisma.entregador.delete({ where: { id: Number(id) } });
  },

  // ---- Usuários ----
  async buscarUsuario(username, empresaId) {
    return prisma.usuario.findUnique({ where: { empresaId_username: { empresaId, username } } });
  },
  async buscarUsuarioSuperadmin(username) {
    return prisma.usuario.findFirst({ where: { username, role: 'superadmin' } });
  },
  async listarUsuarios(empresaId) {
    return prisma.usuario.findMany({ where: { empresaId } });
  },
  async criarUsuario(data) {
    return prisma.usuario.create({ data });
  },
  async deletarUsuario(id) {
    return prisma.usuario.delete({ where: { id: Number(id) } });
  },
  async buscarUsuarioPorId(id) {
    return prisma.usuario.findUnique({ where: { id: Number(id) } });
  },
  async atualizarUsuario(id, data) {
    return prisma.usuario.update({ where: { id: Number(id) }, data });
  },

  // ---- Caixa ----
  async buscarCaixaHoje(empresaId, data) {
    return prisma.caixaDiario.findFirst({ where: { empresaId, data: new Date(data) } });
  },
  async criarCaixa(data) {
    return prisma.caixaDiario.create({ data });
  },
  async atualizarCaixa(id, data) {
    return prisma.caixaDiario.update({ where: { id: Number(id) }, data });
  },
  async relatoriosCaixa(empresaId, inicio, fim) {
    const where = { empresaId };
    if (inicio && fim) {
      where.data = { gte: new Date(inicio), lte: new Date(fim) };
    }
    return prisma.caixaDiario.findMany({ where, orderBy: { data: 'desc' } });
  },

  // ---- Horários ----
  async buscarHorarios(empresaId) {
    return prisma.horario.findFirst({ where: { empresaId } });
  },
  async upsertHorarios(empresaId, data) {
    return prisma.horario.upsert({ where: { empresaId }, update: data, create: { empresaId, ...data } });
  },

  // ---- Counters (prefixo por empresa p/ PK global) ----
  async nextPedidoId(empresaId) {
    const counter = await prisma.counter.upsert({
      where: { nome_empresaId: { nome: 'pedidoId', empresaId } },
      update: { lastValue: { increment: 1 } },
      create: { nome: 'pedidoId', empresaId, lastValue: 1 },
    });
    return `${empresaId}-${String(counter.lastValue).padStart(3, '0')}`;
  },

  // ---- Categorias ----
  async listarCategorias(empresaId) {
    return prisma.categoria.findMany({ where: { empresaId }, orderBy: { nome: 'asc' }, include: { produtos: true } });
  },
  async buscarCategoria(id, empresaId) {
    return prisma.categoria.findFirst({ where: { id: Number(id), empresaId } });
  },
  async criarCategoria(data) {
    return prisma.categoria.create({ data });
  },
  async atualizarCategoria(id, data) {
    return prisma.categoria.update({ where: { id: Number(id) }, data });
  },
  async deletarCategoria(id) {
    return prisma.categoria.delete({ where: { id: Number(id) } });
  },

  // ---- WhatsApp Instances ----
  async listarWhatsAppInstances(empresaId) {
    if (!empresaId) {
      return prisma.whatsAppInstance.findMany(); // superadmin: todas
    }
    return prisma.whatsAppInstance.findMany({ where: { empresaId } });
  },
  async buscarInstanciaAtiva(empresaId) {
    return prisma.whatsAppInstance.findFirst({ where: { empresaId, isActive: true } });
  },
  async buscarWhatsAppInstance(id, empresaId) {
    const where = { id: Number(id) };
    if (empresaId) where.empresaId = empresaId; // valida empresa
    return prisma.whatsAppInstance.findFirst({ where });
  },
  async criarWhatsAppInstance(data) {
    return prisma.whatsAppInstance.create({ data });
  },
  async atualizarWhatsAppInstance(id, data) {
    return prisma.whatsAppInstance.update({ where: { id: Number(id) }, data });
  },
  async deletarWhatsAppInstance(id, empresaId) {
    const where = { id: Number(id) };
    if (empresaId) where.empresaId = empresaId; // valida empresa
    return prisma.whatsAppInstance.delete({ where });
  },

  // ---- Clientes ----
  async listarClientes(empresaId) {
    return prisma.cliente.findMany({ where: { empresaId }, orderBy: { createdAt: 'desc' } });
  },
  async buscarCliente(telefone, empresaId) {
    if (empresaId) {
      return prisma.cliente.findUnique({ where: { empresaId_telefone: { empresaId, telefone } } });
    }
    return prisma.cliente.findFirst({ where: { telefone } });
  },
  async buscarClientePorId(id) {
    return prisma.cliente.findUnique({ where: { id: Number(id) } });
  },
  async criarCliente(data) {
    return prisma.cliente.create({ data });
  },
  async atualizarCliente(id, data) {
    return prisma.cliente.update({ where: { id: Number(id) }, data });
  },
  async deletarCliente(id) {
    return prisma.cliente.delete({ where: { id: Number(id) } });
  },

  // ---- Cupons ----
  async buscarCupom(codigo, empresaId) {
    return prisma.cupom.findFirst({ where: { empresaId, codigo } });
  },
  async listarCupons(empresaId) {
    return prisma.cupom.findMany({ where: { empresaId } });
  },
  async criarCupom(data) {
    return prisma.cupom.create({ data });
  },
  async atualizarCupom(codigo, data) {
    return prisma.cupom.update({ where: { codigo }, data });
  },

  // ---- Empresas ----
  async listarEmpresas() {
    return prisma.empresa.findMany({ include: { _count: { select: { usuarios: true, produtos: true, pedidos: true } } } });
  },
  async buscarEmpresa(id) {
    return prisma.empresa.findUnique({ where: { id } });
  },
  async buscarEmpresaPorSlug(slug) {
    return prisma.empresa.findUnique({ where: { slug } });
  },
  async atualizarEmpresa(id, data) {
    return prisma.empresa.update({ where: { id }, data });
  },
  async criarEmpresa(data) {
    return prisma.empresa.create({ data });
  },

  // ---- Pedidos (soft-delete helpers) ----
  async listarNaoConcluidos(empresaId, filtros = {}) {
    const where = { empresaId, paymentStatus: { in: ['expirado', 'rejeitado'] }, deletedAt: null, ...filtros };
    return prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: true, pagamentos: true } });
  },
  async hardDeletePedidos(ids) {
    return prisma.$transaction(ids.map(id => prisma.pedido.delete({ where: { id } })));
  },
  async listarParaLimpeza(dias = 30) {
    const cutoff = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    return prisma.pedido.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true, paymentStatus: true, deletedAt: true, total: true, clienteNome: true },
      orderBy: { deletedAt: 'asc' }
    });
  },
};

module.exports = sql;
```

- [ ] **Step 3: Rodar teste sqlRepository**

Run: `cd backend && npx vitest run tests/sqlRepository.test.js`
Expected: PASS (7 tests, signature atualizada)

- [ ] **Step 4: Rodar testes existentes (orderService/clientService vão passar; entregaService pode falhar até Task 7)**

Run: `cd backend && npx vitest run`
Expected: maioria passa; `entregaService.test.js` pode falhar até Tasks 6-7

---

## Task 6: context.js + auth.js + ownership.js

**Files:**
- Modify: `backend/src/middleware/context.js:46-58`
- Modify: `backend/src/middleware/auth.js:4-26`
- Modify: `backend/src/middleware/ownership.js:10-26`

**Interfaces:**
- Produces: `req.ctx.empresaId`/`req.ctx.role` via getCtx; auth blocking; superadmin bypass

- [ ] **Step 1: context.js — getCtx inclui empresaId + role**

```javascript
// backend/src/middleware/context.js — substituir getCtx (linhas 46-58)
function getCtx(req) {
  const actor = getActor(req);
  return {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorUsername: actor.actorUsername,
    actorRole: actor.actorRole,
    empresaId: req.ctx?.empresaId || req.user?.empresaId || null,
    role: req.user?.role || null,
  };
}
```

- [ ] **Step 2: auth.js — superadmin bypass + validação empresaId vs Host**

```javascript
// backend/src/middleware/auth.js — substituir authenticate (linhas 4-26)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = tokenService.verificarToken(token);
    if (!decoded.role || !['superadmin', 'admin', 'user'].includes(decoded.role)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (!decoded.id) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Superadmin com empresaId null: acesso global
    if (decoded.role === 'superadmin' && decoded.empresaId === null) {
      req.user = decoded;
      return next();
    }

    // Admin/user: empresaId deve existir
    if (!decoded.empresaId || decoded.empresaId < 1) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Se resolveEmpresa resolveu empresa, valida match (previne cross-tenant token)
    if (req.ctx?.empresaId && decoded.empresaId !== req.ctx.empresaId) {
      return res.status(403).json({ error: 'Acesso negado: empresa não corresponde' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
```

- [ ] **Step 3: ownership.js — superadmin bypass**

```javascript
// backend/src/middleware/ownership.js — substituir requireOwnership (linhas 10-26)
function requireOwnership(resourceType, idParam = 'id') {
  return async (req, res, next) => {
    // Superadmin acessa qualquer empresa
    if (req.user && req.user.role === 'superadmin') {
      return next();
    }
    const fetcher = fetchers[resourceType];
    if (!fetcher) return res.status(500).json({ error: 'Tipo de recurso inválido' });

    const id = req.params[idParam];
    const resource = await fetcher(id);
    if (!resource) return res.status(404).json({ error: 'Recurso não encontrado' });

    if (Number(resource.empresaId) !== Number(req.user.empresaId)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    req.resource = resource;
    next();
  };
}
```

- [ ] **Step 4: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: ainda pode haver falhas em entregaService (Task 7)

---

## Task 7: authService — login multi-tenant (superadmin empresaId null)

**Files:**
- Modify: `backend/src/services/authService.js`

**Interfaces:**
- Consumes: `sql.buscarUsuario(username, empresaId)`, `sql.buscarUsuarioSuperadmin(username)`
- Produces: JWT com `empresaId: user.role==='superadmin' ? null : user.empresaId`

- [ ] **Step 1: Atualizar authService**

```javascript
// backend/src/services/authService.js
const bcrypt = require('bcryptjs');
const sql = require('../repositories/sqlRepository');
const tokenService = require('./tokenService');
const auditService = require('./auditService');
const prisma = require('../config/prisma');

const SALT_ROUNDS = 10;

async function login(username, password, empresaId, ip, userAgent, ctx = {}) {
  const base = {
    requestId: ctx.requestId || null,
    ip: ip || ctx.ip || null,
    userAgent: userAgent || ctx.userAgent || null,
    metadata: { url: ctx.path || null },
  };

  let user;
  if (empresaId) {
    // Admin/user em {slug}.sua-app.com
    user = await sql.buscarUsuario(username, empresaId);
    // Fallback: superadmin pode acessar qualquer empresa
    if (!user || user.role !== 'superadmin') {
      const sup = await sql.buscarUsuarioSuperadmin(username);
      if (sup) user = sup;
    }
  } else {
    // Superadmin em admin.sua-app.com
    user = await sql.buscarUsuarioSuperadmin(username);
  }

  if (!user) {
    auditService.audit({ ...base, action: 'auth.login_failed', module: 'auth', actorType: 'anon', actorUsername: username, severity: 'warning', reason: 'usuario_nao_encontrado' });
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    auditService.audit({ ...base, action: 'auth.login_failed', module: 'auth', actorType: 'admin', actorId: user.id, actorUsername: user.username, actorRole: user.role, severity: 'warning', reason: 'senha_incorreta' });
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });
  }

  // Superadmin sempre empresaId null (acesso global)
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    empresaId: user.role === 'superadmin' ? null : user.empresaId,
    lojaNome: user.lojaNome || null,
  };
  const token = tokenService.gerarToken(payload);

  auditService.audit({ ...base, action: 'auth.login', module: 'auth', actorType: 'admin', actorId: user.id, actorUsername: user.username, actorRole: user.role });

  return { token, user: { id: user.id, username: user.username, role: user.role, lojaNome: user.lojaNome } };
}

async function criarUsuario(data, ctx = {}) {
  const existing = await sql.buscarUsuario(data.username, data.empresaId);
  if (existing) {
    auditService.audit({ requestId: ctx.requestId || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null, action: 'user.create_failed', module: 'usuarios', ...(ctx.actor || {}), targetType: 'usuario', targetId: existing.id, severity: 'warning', reason: 'usuario_existe', metadata: { url: ctx.path || null } });
    throw Object.assign(new Error('Usuário já existe'), { status: 409 });
  }
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await sql.criarUsuario({ ...data, passwordHash: hash });
  auditService.audit({ requestId: ctx.requestId || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null, action: 'user.create', module: 'usuarios', ...(ctx.actor || {}), targetType: 'usuario', targetId: user.id, after: { username: user.username, role: user.role }, changedFields: ['username', 'role', 'passwordHash'], metadata: { url: ctx.path || null } });
  return user;
}

async function alterarSenha(userId, senhaAtual, novaSenha, ctx = {}) {
  const user = await sql.buscarUsuarioPorId(userId);
  const base = { requestId: ctx.requestId || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null, actorType: 'admin', actorId: user.id, actorUsername: user.username, actorRole: user.role, targetType: 'usuario', targetId: user.id, metadata: { url: ctx.path || null } };
  const match = await bcrypt.compare(senhaAtual, user.passwordHash);
  if (!match) {
    auditService.audit({ ...base, action: 'auth.change_password_failed', module: 'auth', severity: 'warning', reason: 'senha_atual_incorreta' });
    throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });
  }
  const hash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
  await sql.atualizarUsuario(userId, { passwordHash: hash });
  auditService.audit({ ...base, action: 'auth.change_password', module: 'auth', changedFields: ['passwordHash'] });
}

async function criarConta({ username, password, lojaNome, empresaId }, ctx = {}) {
  if (!empresaId) {
    throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });
  }
  const existing = await sql.buscarUsuario(username, empresaId);
  if (existing) {
    auditService.audit({ requestId: ctx.requestId || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null, action: 'auth.register_failed', module: 'auth', actorType: 'anon', actorUsername: username, targetType: 'usuario', targetId: existing.id, severity: 'warning', reason: 'usuario_existe', metadata: { url: ctx.path || null } });
    throw Object.assign(new Error('Usuário já existe'), { status: 409 });
  }
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await sql.criarUsuario({ empresaId, username, passwordHash: hash, lojaNome: lojaNome || username, role: 'admin' });
  auditService.audit({ requestId: ctx.requestId || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null, action: 'auth.register', module: 'auth', actorType: 'admin', actorId: user.id, actorUsername: user.username, actorRole: user.role, targetType: 'usuario', targetId: user.id, changedFields: ['username', 'role', 'passwordHash'], metadata: { url: ctx.path || null } });
  const payload = { id: user.id, username: user.username, role: user.role, empresaId: user.empresaId, lojaNome: user.lojaNome };
  const token = tokenService.gerarToken(payload);
  return { token, user: { id: user.id, username: user.username, role: user.role, lojaNome: user.lojaNome } };
}

module.exports = { login, criarUsuario, alterarSenha, criarConta };
```

- [ ] **Step 2: authController — criarConta/criarUsuario empresaId do ctx**

```javascript
// backend/src/controllers/authController.js — parte que muda
exports.criarConta = asyncHandler(async (req, res) => {
  const { username, password, lojaNome } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
  const result = await authService.criarConta({
    username, password, lojaNome: lojaNome || username,
    empresaId: req.ctx?.empresaId,
  }, {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
  });
  res.status(201).json(result);
});
```

- [ ] **Step 3: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: ainda pode haver falhas em entregaService (Task 8)

---

## Task 8: Services — empresaId param (order, entrega, user, loja, product, categoria)

**Files:**
- Modify: `backend/src/services/orderService.js`
- Modify: `backend/src/services/entregaService.js`
- Modify: `backend/src/services/userService.js`
- Modify: `backend/src/services/lojaService.js`
- Modify: `backend/src/services/productService.js`
- Modify: `backend/src/services/categoriaService.js`

**Interfaces:**
- Consumes: `req.ctx.empresaId`
- Produces: mesmas funções, agora com empresaId param (ou do pedido)

- [ ] **Step 1: orderService**

```javascript
// backend/src/services/orderService.js — funções que mudam
async function listar(filtros, empresaId) {
  return sql.listarPedidos(empresaId, filtros);
}

async function listarFiltrado(filtros, empresaId) {
  return sql.listarPedidosFiltrados(empresaId, filtros);
}

async function listarNaoConcluidos(filtros, empresaId) {
  return sql.listarNaoConcluidos(empresaId, filtros);
}

async function criar(data, empresaId, ctx = {}) {
  const pedidoId = await sql.nextPedidoId(empresaId);
  const pedido = { ...data, id: pedidoId, empresaId };
  await sql.criarPedido(pedido);
  auditService.audit({ ...ctx, action: 'pedido.create', module: 'pedidos', targetType: 'pedido', targetId: pedidoId, after: { clienteNome: data.clienteNome, total: Number(data.total), status: 'pendente' }, changedFields: ['clienteNome', 'total', 'status'] });
  return pedido;
}

// buscar(id) leva empresaId
async function buscar(id, empresaId) {
  const pedido = await sql.buscarPedido(id, empresaId);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  return pedido;
}
```

Nota: `processarEdicaoPedido`/`agruparItens` (puros) **não mudam**. `editarPedido`, `finalizarPedido`, `atualizarStatus`, `deletarPedido` passam empresaId para `sql.buscarPedido(id, empresaId)`.

- [ ] **Step 2: entregaService (inclui removerEntrega com empresaId)**

```javascript
// backend/src/services/entregaService.js
async function listarEntregas(data, empresaId) {
  const where = { empresaId };
  if (data) {
    const start = new Date(data + 'T00:00:00.000Z');
    const end = new Date(data + 'T23:59:59.999Z');
    where.data = { gte: start, lte: end };
  }
  return prisma.entregaDiaria.findMany({ where, include: { entregador: true }, orderBy: { createdAt: 'desc' } });
}

async function registrarEntrega(entregadorId, pedidoId, valor, empresaId, ctx = {}) {
  const existente = await prisma.entregaDiaria.findFirst({ where: { empresaId, pedidoId } });
  if (existente) throw Object.assign(new Error('Entrega já registrada para este pedido'), { status: 409 });
  const entrega = await prisma.entregaDiaria.create({ data: { empresaId, entregadorId: Number(entregadorId), pedidoId, valor: valor || 0, data: new Date() } });
  logger.info(`Entrega registrada: pedido ${pedidoId}, entregador ${entregadorId}, valor ${valor}`);
  auditService.audit({ ...ctx, action: 'entrega.registrar', module: 'entregas', targetType: 'entrega', targetId: entrega.id, after: { pedidoId, entregadorId: Number(entregadorId), valor: Number(valor || 0) }, changedFields: ['pedidoId', 'entregadorId', 'valor'] });
  return entrega;
}

async function removerEntrega(pedidoId, empresaId, ctx = {}) {
  const entrega = await prisma.entregaDiaria.findFirst({ where: { empresaId, pedidoId } });
  if (!entrega) throw Object.assign(new Error('Entrega não encontrada'), { status: 404 });
  await prisma.entregaDiaria.delete({ where: { id: entrega.id } });
  logger.info(`Entrega removida: pedido ${pedidoId}`);
  auditService.audit({ ...ctx, action: 'entrega.remover', module: 'entregas', targetType: 'entrega', targetId: entrega.id, after: { pedidoId, entregadorId: entrega.entregadorId, valor: Number(entrega.valor || 0) }, changedFields: ['pedidoId', 'entregadorId', 'valor'], severity: 'warning' });
  return { success: true };
}

async function resumoDiario(data, empresaId) {
  const dataInicio = data ? new Date(data + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const dataFim = new Date(dataInicio);
  dataFim.setUTCHours(23, 59, 59, 999);
  const entregas = await prisma.entregaDiaria.findMany({ where: { empresaId, data: { gte: dataInicio, lte: dataFim } }, include: { entregador: true } });
  const entregadores = agruparPorEntregador(entregas);
  return { data: dataInicio.toISOString().slice(0, 10), totalEntregas: entregas.length, totalValor: entregas.reduce((acc, e) => acc + Number(e.valor || 0), 0), totalPedidos: entregadores.reduce((a, d) => a + d.totalPedidos, 0), entregadores };
}

async function resumoPorPeriodo(inicio, fim, entregadorId, empresaId, ctx = {}) {
  const where = { empresaId, entregadorId: entregadorId ? Number(entregadorId) : undefined, data: { gte: new Date(inicio + 'T00:00:00.000Z'), lte: new Date(fim + 'T23:59:59.999Z') } };
  const entregas = await prisma.entregaDiaria.findMany({ where, include: { entregador: true }, orderBy: { createdAt: 'asc' } });
  const resultado = await montarResumoPeriodo(entregas, sql.listarPedidosPorIds);
  return { inicio, fim, ...resultado };
}
```

- [ ] **Step 3: userService (deletar/resetarSenha escopados)**

```javascript
// backend/src/services/userService.js
async function listar(empresaId) {
  return prisma.usuario.findMany({ where: { empresaId }, orderBy: { createdAt: 'desc' }, select: { id: true, username: true, role: true, lojaNome: true, createdAt: true } });
}

async function criar({ username, password, lojaNome, role, empresaId }, ctx = {}) {
  if (!empresaId) throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });
  const existing = await prisma.usuario.findUnique({ where: { empresaId_username: { empresaId, username } } });
  if (existing) throw Object.assign(new Error('Usuário já existe'), { status: 409 });
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.usuario.create({ data: { empresaId, username, passwordHash: hash, lojaNome: lojaNome || username, role: role || 'user' }, select: { id: true, username: true, role: true, lojaNome: true } });
  return user;
}

// deletar/resetarSenha: buscar por id + empresaId para escopar
async function deletar(id, empresaId, ctx = {}) {
  const user = await prisma.usuario.findFirst({ where: { id: Number(id), empresaId }, select: { id: true, username: true, role: true } });
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  await prisma.usuario.delete({ where: { id: user.id } });
  return { success: true };
}
```

- [ ] **Step 4: lojaService (getSettings/updateSettings empresaId)**

```javascript
// backend/src/services/lojaService.js
async function getSettings(empresaId) {
  const empresa = await sql.buscarEmpresa(empresaId);
  if (!empresa) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
  return formatEmpresa(empresa);
}

async function updateSettings(empresaId, data, ctx = {}) {
  const empresa = await sql.buscarEmpresa(empresaId);
  // ... validações e merge iguais
  const result = await sql.atualizarEmpresa(empresaId, payload);
  auditService.audit({ ...ctx, action: 'loja.settings_update', module: 'loja', targetType: 'empresa', targetId: empresaId, before, after, changedFields });
  return result;
}
```

- [ ] **Step 5: productService (listar/buscar/atualizar/deletar escopados)**

```javascript
// backend/src/services/productService.js
async function listar(empresaId) {
  const produtos = await sql.listarProdutos(empresaId);
  return produtos.map(formatProduto);
}

async function buscar(id, empresaId) {
  const produto = await sql.buscarProduto(id, empresaId);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  return formatProduto(produto);
}

async function atualizar(id, data, empresaId, ctx = {}) {
  const produto = await sql.buscarProduto(id, empresaId); // escopado
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  // ... sanitização e update
}

async function deletar(id, empresaId, ctx = {}) {
  const produto = await sql.buscarProduto(id, empresaId);
  if (!produto) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  await sql.deletarProduto(id);
}
```

- [ ] **Step 6: categoriaService (listar/buscar/atualizar/deletar escopados)**

```javascript
// backend/src/services/categoriaService.js
async function listar(empresaId) {
  return sql.listarCategorias(empresaId);
}
async function buscar(id, empresaId) {
  const categoria = await sql.buscarCategoria(id, empresaId);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return categoria;
}
async function atualizar(id, data, empresaId, ctx = {}) {
  const categoria = await sql.buscarCategoria(id, empresaId);
  if (!categoria) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  return sql.atualizarCategoria(id, data);
}
```

- [ ] **Step 7: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: entregaService.test.js passa agora; todo o conjunto deve passar

---

## Task 9: paymentService — empresaId do pedido (corrigir `pedido` undefined)

**Files:**
- Modify: `backend/src/services/paymentService.js`

**Interfaces:**
- Consumes: `sql.buscarPedido(pedidoId)` para obter empresaId
- Produces: pagamento com `empresaId` correto

- [ ] **Step 1: Atualizar criarPixPedido**

```javascript
// backend/src/services/paymentService.js — função criarPixPedido
async function criarPixPedido(pedidoId, { cliente, valor }) {
  const v = Number(valor);
  const pedido = await sql.buscarPedido(pedidoId); // obter empresaId
  const empresaId = pedido ? pedido.empresaId : 1;
  let asaasCustomerId = cliente.asaasCustomerId;
  if (!asaasCustomerId) {
    asaasCustomerId = await asaasClient.criarCustomer({ nome: cliente.nome, cpf: cliente.cpf, telefone: cliente.telefone });
    if (cliente.id) {
      await sql.atualizarCliente(cliente.id, { asaasCustomerId });
    }
  }

  const expiryMin = env.asaasPixExpiryMin;
  const taxaServico = Math.round(v * env.asaasPixFeePercent / 100 * 100) / 100;
  const dueDate = new Date(Date.now() + expiryMin * 60 * 1000);
  const pix = await asaasClient.criarPix({
    customerId: asaasCustomerId, valor: v, descricao: `Pedido ${pedidoId}`, dueDate: dueDate.toISOString().slice(0, 10),
  });

  const pagamento = await prisma.pagamento.create({
    data: {
      pedidoId, empresaId,
      asaasPaymentId: pix.paymentId, asaasCustomerId,
      valor: v, pixCode: pix.pixCode, pixQrCode: pix.pixQrCode,
      status: 'aguardando_pagamento',
      expiresAt: new Date(Date.now() + expiryMin * 60 * 1000),
    },
  });
  await prisma.pedido.update({ where: { id: pedidoId }, data: { paymentId: pagamento.id } });
  registrarLog('PIX_CREATED', { pedidoId, pagamento: pagamento.id });
  return { ...pagamento, taxaServico };
}
```

- [ ] **Step 2: Rodar testes paymentService**

Run: `cd backend && npx vitest run tests/paymentService.test.js`
Expected: PASS. Se mock não tem `sql.buscarPedido`, ajustar o mock para retornar `{ id: pedidoId, empresaId: 1 }`.

---

## Task 10: whatsappInstanceService + whatsappService

**Files:**
- Modify: `backend/src/services/whatsappInstanceService.js`
- Modify: `backend/src/services/whatsappService.js`

**Interfaces:**
- Consumes: `req.ctx.empresaId`
- Produces: limite 1 por empresa + validação empresaId em buscar/deletar

- [ ] **Step 1: whatsappInstanceService — listar/criar empresaId + limite 1 + validação**

```javascript
// backend/src/services/whatsappInstanceService.js — partes que mudam
async function listar(empresaId) {
  const instancias = await sql.listarWhatsAppInstances(empresaId);
  for (const inst of instancias) {
    // ... status check igual (não muda)
  }
  return sql.listarWhatsAppInstances(empresaId);
}

async function criar(role, instanceName, phoneNumber, empresaId, ctx = {}) {
  if (!instanceName || !phoneNumber) throw Object.assign(new Error('Nome da instância e número de telefone são obrigatórios.'), { status: 400 });

  // Limite 1 por empresa (superadmin pode ter várias)
  if (role !== 'superadmin') {
    const existentes = await sql.listarWhatsAppInstances(empresaId);
    if (existentes.length >= 1) {
      auditService.audit({ ...ctx, action: 'whatsapp.instance_create_failed', module: 'whatsapp', targetType: 'whatsapp_instance', targetId: instanceName, severity: 'warning', reason: 'limite_uma_instancia' });
      throw Object.assign(new Error('Já existe uma instância. Delete a existente para criar uma nova.'), { status: 409 });
    }
  }

  const jaExisteMesmoNome = await sql.buscarWhatsAppInstance(0, empresaId); // checagem de duplicado ajustada
  // ... Resto igual, com empresaId no create:
  const instancia = await sql.criarWhatsAppInstance({ empresaId, instanceId: instanceName, phoneNumber, connectionStatus: evolutionData ? 'qrcode' : 'disconnected', qrCode: evolutionData?.qrcode?.code || null, isActive: true });
  return { instancia, evolutionData };
}

async function deletar(id, empresaId, ctx = {}) {
  const instancia = await sql.buscarWhatsAppInstance(id, empresaId); // valida empresa
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });
  // ... delete igual
  await sql.deletarWhatsAppInstance(id, empresaId);
}
```

Nota: para duplicado por nome, usar `sql.listarWhatsAppInstances(empresaId)` e procurar no array.

```javascript
async function criar(role, instanceName, phoneNumber, empresaId, ctx = {}) {
  if (!instanceName || !phoneNumber) throw Object.assign(new Error('Nome da instância e número de telefone são obrigatórios.'), { status: 400 });

  const existentes = await sql.listarWhatsAppInstances(empresaId);

  if (role !== 'superadmin' && existentes.length >= 1) {
    auditService.audit({ ...ctx, action: 'whatsapp.instance_create_failed', module: 'whatsapp', targetType: 'whatsapp_instance', targetId: instanceName, severity: 'warning', reason: 'limite_uma_instancia' });
    throw Object.assign(new Error('Já existe uma instância. Delete a existente para criar uma nova.'), { status: 409 });
  }

  const jaExisteMesmoNome = existentes.find(i => i.instanceId === instanceName);
  if (jaExisteMesmoNome) {
    auditService.audit({ ...ctx, action: 'whatsapp.instance_create_failed', module: 'whatsapp', targetType: 'whatsapp_instance', targetId: instanceName, severity: 'warning', reason: 'nome_duplicado' });
    throw Object.assign(new Error('Já existe uma instância com este nome.'), { status: 409 });
  }
  // ... resto igual
}
```

- [ ] **Step 2: whatsappService — empresaId param**

```javascript
// backend/src/services/whatsappService.js
async function enviarMensagem(numero, mensagem, empresaId) {
  if (!config.evolutionUrl || !config.evolutionApiKey) return null;
  const instancia = await sql.buscarInstanciaAtiva(empresaId);
  if (!instancia) { console.warn('WhatsApp: Nenhuma instância ativa'); return null; }
  // ... resto igual
}
```

- [ ] **Step 3: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: 55/55 PASS (se tests de ausência de empresaId nos mocks precisarem ajuste, atualizar mock)

---

## Task 11: Controllers — empresaId do ctx (parte 1)

**Files:**
- Modify: `backend/src/controllers/productController.js`
- Modify: `backend/src/controllers/orderController.js`
- Modify: `backend/src/controllers/cashierController.js`
- Modify: `backend/src/controllers/driverController.js`
- Modify: `backend/src/controllers/categoriaController.js`
- Modify: `backend/src/controllers/entregaController.js`

**Interfaces:**
- Consumes: `req.ctx.empresaId`
- Produces: controllers passam empresaId para services/sql

- [ ] **Step 1: productController**

```javascript
// backend/src/controllers/productController.js
exports.listar = asyncHandler(async (req, res) => {
  const produtos = await productService.listar(req.ctx.empresaId);
  res.json(produtos);
});
exports.buscar = asyncHandler(async (req, res) => {
  const produto = await productService.buscar(req.params.id, req.ctx.empresaId);
  res.json(produto);
});
exports.criar = asyncHandler(async (req, res) => {
  const produto = await productService.criar({ ...req.body, empresaId: req.ctx.empresaId }, getCtx(req));
  res.status(201).json(produto);
});
exports.atualizar = asyncHandler(async (req, res) => {
  const produto = await productService.atualizar(req.params.id, req.body, req.ctx.empresaId, getCtx(req));
  res.json(produto);
});
exports.deletar = asyncHandler(async (req, res) => {
  await productService.deletar(req.params.id, req.ctx.empresaId, getCtx(req));
  res.json({ success: true });
});
```

- [ ] **Step 2: orderController (listar usa listarFiltrado, não listar)**

```javascript
// backend/src/controllers/orderController.js — partes que mudam
exports.listar = asyncHandler(async (req, res) => {
  const pedidos = await orderService.listarFiltrado(req.query, req.ctx.empresaId);
  // ... formatação igual
});

exports.buscar = asyncHandler(async (req, res) => {
  const pedido = await orderService.buscar(req.params.id, req.ctx.empresaId);
  res.json(pedido);
});

exports.criar = asyncHandler(async (req, res) => {
  const pedido = await orderService.criar({ ...req.body, empresaId: req.ctx.empresaId }, req.ctx.empresaId, getCtx(req));
  res.status(201).json(pedido);
});

exports.listarNaoConcluidos = asyncHandler(async (req, res) => {
  const pedidos = await orderService.listarNaoConcluidos(req.query, req.ctx.empresaId);
  // ... formatação igual
});
```

- [ ] **Step 3: cashierController (empresaId do ctx)**

```javascript
// backend/src/controllers/cashierController.js
exports.hoje = asyncHandler(async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0];
  const caixa = await sql.buscarCaixaHoje(req.ctx.empresaId, data);
  res.json(caixa || { status: 'fechado', data });
});
exports.abrir = asyncHandler(async (req, res) => {
  const data = new Date().toISOString().split('T')[0];
  const caixa = await sql.criarCaixa({ empresaId: req.ctx.empresaId, data: new Date(data), valorInicial: req.body.valorInicial || 0, status: 'aberto', abertoEm: new Date() });
  // ... audit
});
exports.relatorios = asyncHandler(async (req, res) => {
  const { inicio, fim } = req.query;
  const relatorios = await sql.relatoriosCaixa(req.ctx.empresaId, inicio, fim);
  res.json(relatorios);
});
// fechar: buscarCaixaHoje(req.ctx.empresaId, data)
```

- [ ] **Step 4: driverController (empresaId do ctx)**

```javascript
// backend/src/controllers/driverController.js
exports.listar = asyncHandler(async (req, res) => {
  const where = { empresaId: req.ctx.empresaId };
  if (req.query.ativo === 'true') where.ativo = true;
  const prisma = require('../config/prisma');
  const entregadores = await prisma.entregador.findMany({ where, orderBy: req.query.sort === 'criadoEm' ? { createdAt: 'desc' } : { nome: 'asc' } });
  res.json(entregadores);
});
exports.criar = asyncHandler(async (req, res) => {
  const entregador = await sql.criarEntregador({ ...req.body, empresaId: req.ctx.empresaId });
  // ... audit
});
// atualizar/toggle/deletar: where id + empresaId: req.ctx.empresaId
```

- [ ] **Step 5: categoriaController**

```javascript
// backend/src/controllers/categoriaController.js
exports.listar = asyncHandler(async (req, res) => {
  const categorias = await service.listar(req.ctx.empresaId);
  res.json(categorias);
});
exports.buscar = asyncHandler(async (req, res) => {
  const categoria = await service.buscar(req.params.id, req.ctx.empresaId);
  res.json(categoria);
});
exports.criar = asyncHandler(async (req, res) => {
  const categoria = await service.criar({ ...req.body, empresaId: req.ctx.empresaId }, getCtx(req));
  res.status(201).json(categoria);
});
exports.atualizar = asyncHandler(async (req, res) => {
  const categoria = await service.atualizar(req.params.id, req.body, req.ctx.empresaId, getCtx(req));
  res.json(categoria);
});
```

- [ ] **Step 6: entregaController**

```javascript
// backend/src/controllers/entregaController.js
exports.listar = asyncHandler(async (req, res) => {
  const { data } = req.query;
  const entregas = await entregaService.listarEntregas(data, req.ctx.empresaId);
  res.json(entregas);
});
exports.registrar = asyncHandler(async (req, res) => {
  const { entregadorId, pedidoId, valor } = req.body;
  if (!entregadorId || !pedidoId) return res.status(400).json({ error: 'entregadorId e pedidoId são obrigatórios' });
  const entrega = await entregaService.registrarEntrega(entregadorId, pedidoId, valor, req.ctx.empresaId, getCtx(req));
  res.status(201).json(entrega);
});
exports.remover = asyncHandler(async (req, res) => {
  const result = await entregaService.removerEntrega(req.params.pedidoId, req.ctx.empresaId, getCtx(req));
  res.json(result);
});
exports.resumo = asyncHandler(async (req, res) => {
  const { data } = req.query;
  if (!data) return res.status(400).json({ error: 'Parâmetro data é obrigatório (YYYY-MM-DD)' });
  const resumo = await entregaService.resumoDiario(data, req.ctx.empresaId);
  res.json(resumo);
});
exports.resumoPeriodo = asyncHandler(async (req, res) => {
  const { inicio, fim, entregador } = req.query;
  // ... validações
  const resultado = await entregaService.resumoPorPeriodo(inicio, fim, entregador, req.ctx.empresaId, getCtx(req));
  res.json(resultado);
});
```

- [ ] **Step 7: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: 55/55 PASS

---

## Task 12: Controllers — empresaId do ctx (parte 2: public, loja, whatsapp, clientAdmin)

**Files:**
- Modify: `backend/src/controllers/publicController.js`
- Modify: `backend/src/controllers/lojaController.js`
- Modify: `backend/src/controllers/whatsappController.js`
- Modify: `backend/src/controllers/clientAdminController.js`
- Modify: `backend/src/services/clientService.js`

**Interfaces:**
- Consumes: `req.ctx.empresaId`
- Produces: escopo por empresa + correção IDOR `/api/public/pedidos/:id`

- [ ] **Step 1: publicController (empresaId do resolveEmpresa + IDOR fix)**

```javascript
// backend/src/controllers/publicController.js — partes que mudam
exports.listarProdutos = asyncHandler(async (req, res) => {
  const produtos = await productService.listar(req.ctx.empresaId);
  setCache(res, 60);
  res.json(produtos);
});

exports.listarCategorias = asyncHandler(async (req, res) => {
  const categorias = await sql.listarCategorias(req.ctx.empresaId);
  setCache(res, 60);
  res.json(categorias);
});

exports.statusLoja = asyncHandler(async (req, res) => {
  const service = require('../services/lojaService');
  const status = await service.getStatus(req.ctx.empresa?.slug || 'salgadoscosta');
  setCache(res, 30);
  res.json(status);
});

exports.settingsLoja = asyncHandler(async (req, res) => {
  const service = require('../services/lojaService');
  const settings = await service.getSettings(req.ctx.empresaId);
  setCache(res, 300);
  res.json(settings);
});

exports.registrarCliente = asyncHandler(async (req, res) => {
  const existing = await sql.buscarCliente(telefone, req.ctx.empresaId); // escopado
  // ...
  const cliente = await sql.criarCliente({ empresaId: req.ctx.empresaId, ... });
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: req.ctx.empresaId, telefone: cliente.telefone, nome: cliente.nome });
  // ...
});

exports.loginCliente = asyncHandler(async (req, res) => {
  const cliente = await sql.buscarCliente(telefone, req.ctx.empresaId); // escopado
  // ...
  const token = tokenService.gerarToken({ id: cliente.id, empresaId: req.ctx.empresaId, telefone: cliente.telefone, nome: cliente.nome });
});

exports.listarPedidosCliente = [authenticatePublic, asyncHandler(async (req, res) => {
  const pedidos = await prisma.pedido.findMany({ where: { empresaId: req.ctx.empresaId, clienteWhatsapp: req.cliente.telefone }, orderBy: { createdAt: 'desc' }, include: { itens: { include: { produto: true } } } });
  res.json(pedidos);
})];

exports.criarPedido = asyncHandler(async (req, res) => {
  // ...
  const pedidoId = await sql.nextPedidoId(req.ctx.empresaId); // prefixo por empresa
  const pedido = await prisma.pedido.create({ data: { id: pedidoId, empresaId: req.ctx.empresaId, ... }, include: { itens: true } });
  // ...
});

// IDOR FIX: escopar por empresa
exports.buscarPedido = asyncHandler(async (req, res) => {
  const pedido = await sql.buscarPedido(req.params.id, req.ctx.empresaId);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(pedido);
});

exports.validarCupom = asyncHandler(async (req, res) => {
  const cupom = await sql.buscarCupom(req.params.codigo, req.ctx.empresaId);
  // ...
});
```

- [ ] **Step 2: lojaController**

```javascript
// backend/src/controllers/lojaController.js
exports.statusPublic = asyncHandler(async (req, res) => {
  const status = await service.getStatus(req.ctx.empresa?.slug || 'salgadoscosta');
  res.json(status);
});
exports.settingsPublic = asyncHandler(async (req, res) => {
  const settings = await service.getSettings(req.ctx.empresaId);
  res.json(settings);
});
exports.settings = asyncHandler(async (req, res) => {
  const settings = await service.getSettings(req.ctx.empresaId);
  res.json(settings);
});
exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await service.updateSettings(req.ctx.empresaId, req.body, getCtx(req));
  res.json(settings);
});
```

- [ ] **Step 3: whatsappController (empresaId do ctx)**

```javascript
// backend/src/controllers/whatsappController.js — partes que mudam
exports.listar = asyncHandler(async (req, res) => {
  const instancias = await service.listar(req.ctx.empresaId);
  res.json(instancias);
});
exports.criar = asyncHandler(async (req, res) => {
  const { instanceName, phoneNumber } = req.body;
  const resultado = await service.criar(req.user.role, instanceName, phoneNumber, req.ctx.empresaId, getCtx(req));
  res.status(201).json(resultado);
});
exports.deletar = asyncHandler(async (req, res) => {
  await service.deletar(req.params.id, req.ctx.empresaId, getCtx(req));
  res.json({ success: true });
});
// statusAtivo: passar empresaId
```

- [ ] **Step 4: clientService (listarClientes/atualizar/deletar escopados)**

```javascript
// backend/src/services/clientService.js
async function listarClientes(empresaId, d = deps()) {
  const clientes = await d.sql.listarClientes(empresaId);
  return clientes.map(/* ... igual */);
}
```

- [ ] **Step 5: clientAdminController**

```javascript
// backend/src/controllers/clientAdminController.js — passar req.ctx.empresaId para clientService
const clientes = await clientService.listarClientes(req.ctx.empresaId);
```

- [ ] **Step 6: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: 55/55 PASS

---

## Task 13: Rotas — schedule, payment, order legacy, jobs, app.js

**Files:**
- Modify: `backend/src/routes/scheduleRoutes.js`
- Modify: `backend/src/routes/paymentRoutes.js`
- Modify: `backend/src/routes/orderRoutes.js`
- Modify: `backend/src/jobs/pixExpirationJob.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `req.ctx.empresaId`
- Produces: rotas/jobs usam empresaId

- [ ] **Step 1: scheduleRoutes**

```javascript
// backend/src/routes/scheduleRoutes.js
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const horarios = await sql.buscarHorarios(req.ctx.empresaId);
  res.json(horarios);
}));
router.put('/', authenticate, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
  const horarios = await sql.upsertHorarios(req.ctx.empresaId, req.body);
  res.json(horarios);
}));
```

- [ ] **Step 2: paymentRoutes (listarPagamentosRejeitados empresaId)**

```javascript
// backend/src/routes/paymentRoutes.js — linha 33
const rows = await sql.listarPagamentosRejeitados(req.ctx.empresaId);
```

- [ ] **Step 3: orderRoutes (legacy /producao etc. — empresaId do ctx)**

```javascript
// backend/src/routes/orderRoutes.js — legacyCtx inclui empresaId
function legacyCtx(req, rota) {
  const ctx = getCtx(req);
  return {
    ...ctx,
    action: `whatsapp.legacy_${rota}`,
    module: 'whatsapp',
    targetType: 'pedido',
    targetId: req.body.pedidoId,
    empresaId: req.ctx?.empresaId,
    // ...
  };
}
```

- [ ] **Step 4: pixExpirationJob (nova signature)

```javascript
// backend/src/jobs/pixExpirationJob.js — sincronizarPendentes itera empresas
const sql = require('../repositories/sqlRepository');
const prisma = require('../config/prisma');

async function sincronizarPendentes() {
  if (isRunning) return;
  isRunning = true;
  try {
    // Busca todas empresas ativas
    const empresas = await prisma.empresa.findMany({ select: { id: true } });
    for (const emp of empresas) {
      const pendentes = await sql.listarPedidosFiltrados(emp.id, { paymentStatus: 'aguardando_pagamento' });
      for (const pedido of pendentes) {
        try {
          await paymentService.consultarESincronizar(pedido.id);
        } catch (e) {
          logger.error(`Sync PIX falhou pedido ${pedido.id}: ${e.message}`);
        }
      }
    }
  } finally {
    isRunning = false;
  }
}
```

- [ ] **Step 5: app.js — registrar resolveEmpresa e requireEmpresa**

```javascript
// backend/src/app.js
const resolveEmpresa = require('./middleware/resolveEmpresa');
// const requireEmpresa = require('./middleware/requireEmpresa'); // onde necessário

// Linha 32: registrar resolveEmpresa ANTES de contextMiddleware
app.use(resolveEmpresa);
app.use(contextMiddleware);
```

Nota: `requireEmpresa` é aplicado por rota específica (não global, pois admin.sua-app.com/superadmin precisa bypass).

- [ ] **Step 6: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: 55/55 PASS

---

## Task 14: Frontend — apiHelper, superadmin.html, admin.html

**Files:**
- Modify: `js/apiHelper.js`
- Modify: `superadmin.html`
- Modify: `admin.html`

**Interfaces:**
- Consumes: `window.location.hostname` (subdomínio)
- Produces: token escopado por slug; admin detecta subdomínio

- [ ] **Step 1: apiHelper.js — token por slug (empresaId resolvido server-side)**

```javascript
// js/apiHelper.js
var PUBLIC_API = (function () {
  var base = '/api/public';

  function getSlug() {
    var host = window.location.hostname;
    return host.split('.')[0] || '';
  }

  function getToken() {
    var slug = getSlug();
    return localStorage.getItem('clientToken_' + slug);
  }

  function setToken(token) {
    var slug = getSlug();
    localStorage.setItem('clientToken_' + slug, token);
  }

  function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(base + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (err) { throw new Error(err.error || 'Erro na requisição'); });
      return res.json();
    });
  }

  return {
    listarProdutos: function () { return request('GET', '/produtos'); },
    listarCategorias: function () { return request('GET', '/categorias'); },
    lojaStatus: function () { return request('GET', '/loja/status'); },
    lojaSettings: function () { return request('GET', '/loja/settings'); },
    register: function (data) { return request('POST', '/clientes/register', data).then(function (r) { if (r.token) setToken(r.token); return r; }); },
    login: function (data) { return request('POST', '/clientes/login', data).then(function (r) { if (r.token) setToken(r.token); return r; }); },
    me: function () { return request('GET', '/clientes/me'); },
    updateMe: function (data) { return request('PUT', '/clientes/me', data); },
    deleteMe: function () { return request('DELETE', '/clientes/me'); },
    revogarConsentimento: function () { return request('POST', '/clientes/consent/revogar', {}); },
    meusPedidos: function () { return request('GET', '/pedidos'); },
    criarPedido: function (data) { return request('POST', '/pedidos', data); },
    criarPedidoAutenticado: function (data) { return request('POST', '/pedidos', data); },
    buscarPedido: function (id) { return request('GET', '/pedidos/' + encodeURIComponent(id)); },
    validarCupom: function (codigo) { return request('GET', '/cupons/' + encodeURIComponent(codigo)); },
  };
})();
```

- [ ] **Step 2: superadmin.html — detectar subdomínio**

```javascript
// superadmin.html — adicionar no início do script
var host = window.location.hostname;
var isSuperadminDomain = host.split('.')[0] === 'admin';
if (!isSuperadminDomain) {
  // Superadmin só opera em admin.sua-app.com
  window.location.href = 'https://admin.' + host.replace(/^[^.]+\./, '');
}
```

- [ ] **Step 3: admin.html — detectar subdomínio (empresa admin)**

```javascript
// admin.html — adicionar no início do script
var host = window.location.hostname;
var sub = host.split('.')[0];
if (sub === 'admin' || sub === 'www') {
  // Em admin.sua-app.com: superadmin gerencia empresas, não uma empresa específica
  // Redirecionar para painel de empresas ou bloquear se não superadmin
}
```

- [ ] **Step 4: Rodar testes**

Run: `cd backend && npx vitest run`
Expected: 55/55 PASS (frontend não tem testes unitários)

---

## Task 15: Testes finais + validação

**Files:**
- Todos os arquivos modificados

**Interfaces:**
- Validação completa do sistema multi-tenant

- [ ] **Step 1: Rodar todos os testes**

Run: `cd backend && npx vitest run`
Expected: **55/55 PASS**

- [ ] **Step 2: Verificar que EMPRESA_ID não existe mais**

Run: `grep -r "EMPRESA_ID" backend/src/`
Expected: Nenhum resultado

- [ ] **Step 3: Verificar que `empresaId: 1` hardcoded não existe em produção**

Run: `grep -rn "empresaId: 1" backend/src/`
Expected: Apenas em comentários/fixtures (não em código de produção). Se aparecer em `entregaService`, `paymentService`, `driverController`, `categoriaController`, `cashierController`, `publicController` — corrigir.

- [ ] **Step 4: Checklist final**

- [ ] `resolveEmpresa` criado + testado (inclui localhost)
- [ ] `requireEmpresa` criado + testado
- [ ] `scopedWhere` criado + testado
- [ ] `empresaCache` criado + testado
- [ ] `auth.js` valida empresaId vs Host
- [ ] `context.js` inclui empresaId em req.ctx
- [ ] `ownership.js` superadmin bypass
- [ ] `sqlRepository.js` sem EMPRESA_ID, métodos com empresaId, pedido id prefixado
- [ ] `authService.login` superadmin empresaId null
- [ ] Todos services recebem empresaId param
- [ ] Todos controllers passam empresaId do ctx
- [ ] `publicController` IDOR `/pedidos/:id` corrigido
- [ ] `paymentService.criarPixPedido` empresaId do pedido
- [ ] WhatsApp: máx 1 por empresa + isolamento + validação empresaId
- [ ] `pixExpirationJob` itera empresas
- [ ] `apiHelper` token por slug
- [ ] `superadmin.html` / `admin.html` detectam subdomínio
- [ ] `app.js` registra resolveEmpresa

---

## Self-Review

**1. Cobertura da spec:**
- ✅ Seção 1 (Auth chain): Tasks 3, 6, 7
- ✅ Seção 2 (Subdomain routing): Tasks 1, 2, 13
- ✅ Seção 3 (Admin panel): Tasks 11, 12, 14
- ✅ Seção 4 (Loja pública): Task 12 (publicController)
- ✅ Mitigação IDOR: Tasks 2, 4, 6, 12
- ✅ Seção 5 (Prisma queries): Tasks 5, 8, 12
- ✅ Seção 6 (JWT): Task 7
- ✅ Seção 7 (Migração): Tasks 1-15
- ✅ Seção 8 (Testes): Task 15
- ✅ WhatsApp regras: Task 10

**2. Correções de bugs bloqueantes:**
- ❌→✅ Prisma mock: Task 1 usa `require('../src/config/prisma')` e lê `prisma.empresa` (não `{default}`)
- ❌→✅ Superadmin empresaId null: Task 7 `empresaId: user.role==='superadmin' ? null : user.empresaId`
- ❌→✅ Pedido id colisão: Task 5 `nextPedidoId` retorna `${empresaId}-${padStart(3,'0')}`
- ❌→✅ paymentService `pedido` undefined: Task 9 busca `sql.buscarPedido(pedidoId)`
- ❌→✅ localhost dev: Task 2 `if (!host.includes('.')) return next()`
- ❌→✅ `requireEmpresa`/`scopedWhere` ausentes: Tasks 3, 4
- ❌→✅ ownership superadmin bypass: Task 6 Step 3
- ❌→✅ Test count/layout: Global Constraints + Tasks colocam testes em `backend/tests/`, 55 casos
- ❌→✅ `listarPedidosFiltrados` signature: Task 5 Step 1 atualiza 7 testes

**3. Consistência de tipos:**
- `getEmpresaFromCache(slug)` → Tasks 1, 2 ✅
- `resolveEmpresa(req,res,next)` → Tasks 2, 13 ✅
- `requireEmpresa(req,res,next)` → Tasks 3, 13 ✅
- `scopedWhere(ctx, extra)` → Task 4 ✅
- `sql.listarPedidosFiltrados(empresaId, filtros)` → Tasks 5, 8, 13 ✅
- `authService.login(username, password, empresaId, ip, userAgent, ctx)` → Tasks 7, authController ✅
- `orderService.criar(data, empresaId, ctx)` → Tasks 8, 11 ✅
- `productService.atualizar(id, data, empresaId, ctx)` → Tasks 8, 11 ✅
- `whatsappInstanceService.criar(role, name, phone, empresaId, ctx)` → Tasks 10, 12 ✅
