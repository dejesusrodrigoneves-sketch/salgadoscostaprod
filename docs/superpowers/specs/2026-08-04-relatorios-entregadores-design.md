# Relatórios de Entregadores — Design

**Data:** 2026-08-04
**Status:** Aprovado

## Goal

Criar página de relatórios que mostre quanto cada entregador fez (valor total das entregas no período), separando os valores por entregador, com filtro de período e filtro por entregador (ou todos).

## Contexto

Hoje o `relatorios.html` mostra apenas **faturamento de pedidos** (`GET /api/pedidos`). Não há visualização por entregador. O `entregador.html` já consume `GET /api/entregas/resumo` (por dia) e o backend `entregaService.resumoDiario()` já agrega por entregador — mas só por data única e não expõe a lista de pedidos.

Decisões confirmadas com o usuário:
- Cada entregador recebe o **valor total da entrega** (o que já está em `entregas_diarias.valor` = total do pedido). Não alterar o cálculo — apenas exibir.
- Nova página própria (Opção C).
- Filtro por **período** com default hoje, além de seletor de entregador ("Todos" ou um específico) (Opção C da pergunta 3).
- Colunas: Nome, Nº de entregas, Valor total, Lista de pedidos entregues.

## Arquitetura

Três camadas, seguindo os padrões existentes do projeto (controller/service/repository + página HTML standalone).

1. **Backend** — nova função `resumoPorPeriodo(inicio, fim, entregadorId?)` em `entregaService.js`, exposta via nova rota `GET /api/entregas/resumo-periodo`.
2. **Frontend** — nova página incremental `relatorios-entregadores.html` com filtros (período + entregador) e tabela-resumo + lista de pedidos.
3. **Menu** — nova entrada na seção "Entregas" do `dashboard.html` (admin/superadmin).

## Data Flow

```
relatorios-entregadores.html
  → GET /api/entregas/resumo-periodo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&entregador=<id|omiti>
  → entregaController.resumoPeriodo (valida datas)
  → entregaService.resumoPorPeriodo (filtra entregaDiaria no range, agrupa por entregador)
  → JSON { inicio, fim, totalEntregas, totalValor, entregadores: Metrics[] }
  → tabela + total geral renderizados
```

## Componentes

### Backend

**`backend/src/services/entregaService.js`**
- Extrair helper interno `agruparPorEntregador(entregas)` (já existe a lógica inline em `resumoDiario`, linhas 87-100).
- Nova `async function resumoPorPeriodo(inicio, fim, entregadorId, ctx)`:
  - `where = { empresaId: 1, data: { gte: new Date(inicio), lte: new Date(fim + 'T23:59:59.999Z') } }`
  - se `entregadorId` → `+ { entregadorId: Number(entregadorId) }`
  - `include: { entregador: true }`, `orderBy: { createdAt: 'asc' }`
  - chama `agruparPorEntregador` → `Metrics[]`
  - retorna `{ inicio, fim, totalEntregas, totalValor, entregadores }`
- `Metrics`: `{ entregadorId, nome, entregas, valorTotal, pedidos: [{ pedidoId, valor }] }`

**`backend/src/controllers/entregaController.js`**
- Novo `exports.resumoPeriodo`:
  - `const { inicio, fim, entregador } = req.query`
  - se `!inicio || !fim` → `400 { error: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' }`
  - valida formato com regex `^\d{4}-\d{2}-\d{2}$`; inválido → 400
  - `res.json(await entregaService.resumoPorPeriodo(inicio, fim, entregador, getCtx(req)))`

**`backend/src/routes/entregaRoutes.js`**
- `router.get('/resumo-periodo', authenticate, authorize('superadmin', 'admin'), controller.resumoPeriodo);`

### Frontend

**`relatorios-entregadores.html`** (novo, raiz do repo)
- CSS: `css/relatorios-page.css` (reutilizado)
- Guardas topo idênticos a `relatorios.html`:
  ```html
  <script>
  if(!authGuard()) throw new Error('Redirect');
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if(!_au.role || !['admin','superadmin'].includes(_au.role)) { window.location.href = 'dashboard.html'; }
  </script>
  ```
- Header `fa-truck` "Relatório de Entregadores"
- Filtros: `<input type="date" id="dataInicio">`, `<input type="date" id="dataFim">` (default hoje), `<select id="filtroEntregador">` com opção "Todos" + entregadores ativos (fetch `GET /api/entregadores?ativo=true`), botão Filtrar
- Tabela: Nome | Nº Entregas | Valor Total | Pedidos (com código + valor, colapsável ou listado)
- Rodapé: "Total geral: R$ X" + "N entregas"
- Fetch `GET /api/entregas/resumo-periodo?inicio=...&fim=...&entregador=...` (omitir `entregador` se "Todos")
- Toast/mensagens via `js/utils.js` (`toast`)

**`dashboard.html`**
- Seção "Entregas": renomear item atual para `{ icon: 'fa-truck', label: 'Cadastro de Entregadores', page: 'entregador.html' }` e adicionar `{ icon: 'fa-chart-line', label: 'Relatório de Entregadores', page: 'relatorios-entregadores.html' }`

### Testes

**`backend/tests/entregaService.test.js`** (novo, Vitest com mock do `prisma`)
- mock `prisma.entregaDiaria.findMany` retornando 2 entregadores com entregas no range
- valida agrupamento: contagem de entregas, soma de valorTotal por entregador
- valida filtro por entregador (mock retorna só as dele)
- valida total geral (`totalEntregas`, `totalValor`)
- valida pedidos listados (pedidoId + valor) dentro de cada entregador
- `import { vi } from 'vitest'` + `vi.mock('../src/config/prisma')`

## Erros / Edge Cases

- Datas ausentes ou mal formatadas → 400 (controller).
- Sem entregas no período → `entregadores: []`, `totalEntregas: 0`, `totalValor: 0`; frontend mostra "Nenhuma entrega no período".
- Entregador sem `valor` (null) → tratado como 0.
- `entregador` ausente → filtro "Todos" (sem resto de `where`), frontend omite o query param.
- Horário: `fim` usa `T23:59:59.999Z` para incluir o dia inteiro; `inicio` usa `T00:00:00.000Z`.

## Fora de Escopo

- Não alterar cálculo de valor da entrega (`valor = total do pedido` permanece).
- Não alterar `resumoDiario()` existente — continua usado por `entregador.html`.
- Não mexer em `entregador.html`, `caixa.html`, `relatorios.html` existentes.
- Não alterar dist/ (sincronizado via build posterior).

## Regras da Sessão

- Sem commit — usuário valida e commita manualmente.
- Manter padrões existentes (Express/controller/service, HTML standalone com `authGuard`).

---

# Implementation Plan

**Goal:** (igual ao spec) Página de relatórios mostrando valor total das entregas por entregador, em período + filtro por entregador, com lista de pedidos (cliente, itens, valor total, valor da entrega).

**Architecture:** Backendincrementa `entregaService.js` com helper puro `agruparPorEntregador` + `resumoPorPeriodo`; controller `resumoPeriodo` valida e roteia; nova rota `GET /api/entregas/resumo-periodo`. Service busca cada `Pedido` (via `sql.buscarPedido`) para enriquecer listagem com `clienteNome`, `itens`, `valoresItens`, `total`. Frontend standalone `relatorios-entregadores.html` (CSS reutilizado) + submenu em `dashboard.html`. TDD com Vitest mockando `prisma` e `sql.buscarPedido`.

**Tech Stack:** Node 24, Express/Prisma/PostgreSQL, Vitest, vanilla HTML+JS.

## Global Constraints

- Sem commit — usuário valida e commita manualmente.
- Arquivos backend alterados: `backend/src/services/entregaService.js` (refatora `resumoDiario` + add `agruparPorEntregador` + `resumoPorPeriodo`), `backend/src/controllers/entregaController.js` (add `resumoPeriodo`), `backend/src/routes/entregaRoutes.js` (add rota), `backend/src/repositories/sqlRepository.js` (sem mudança — usa `buscarPedido` existente), `backend/tests/entregaService.test.js` (novo).
- Arquivos frontend: `relatorios-entregadores.html` (novo, raiz), `dashboard.html` (submenu Entregas).
- Não mexer em `entregador.html`, `caixa.html`, `relatorios.html`, `dist/`.
- Padrão monetário: `Number(valor).toFixed(2).replace('.', ',')` no frontend; backend retorna números.
- Date format query params: `YYYY-MM-DD`.
- Papéis autorados: `admin` + `superadmin` (mesmo padrão das outras rotas `/api/entregas`).
- Helper `agruparPorEntregador` é **puro** (sem prisma, sem await) → testável isoladamente com dados sintéticos.

---

## Task 1: Helper puro `agruparPorEntregador` (TDD)

**Files:**
- Create: `backend/tests/entregaService.test.js`
- Modify: `backend/src/services/entregaService.js` (extrair helper das linhas 87-100; substituir `resumoDiario` para usar helper)

**Interfaces:**
- Produces: `agruparPorEntregador(entregas)` → `Array<{ id, nome, entregas, valorTotal }>` — entrada é `entregas` (array de EntregaDiaria injetada com `entregador: { nome }`, campos `entregadorId`, `valor`).

- [ ] **Step 1: Criar teste falhando**

```js
// backend/tests/entregaService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma e sql antecipadamente (usado em Tasks posteriores, mas venddo aqui p/ rodsr)
vi.mock('../src/config/prisma', () => ({
  entregaDiaria: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('../src/repositories/sqlRepository', () => ({
  buscarPedido: vi.fn(),
}));

import { agruparPorEntregador } from '../src/services/entregaService.js';

describe('agruparPorEntregador', () => {
  it('agrupa por entregadorId somando entregas e valorTotal', () => {
    const entregas = [
      { entregadorId: 1, valor: '5.00', entregador: { nome: 'João' } },
      { entregadorId: 1, valor: '3.00', entregador: { nome: 'João' } },
      { entregadorId: 2, valor: '10.00', entregador: { nome: 'Maria' } },
    ];
    const result = agruparPorEntregador(entregas);
    expect(result).toHaveLength(2);
    const joao = result.find(r => r.id === 1);
    expect(joao.nome).toBe('João');
    expect(joao.entregas).toBe(2);
    expect(joao.valorTotal).toBe(8);
    const maria = result.find(r => r.id === 2);
    expect(maria.entregas).toBe(1);
    expect(maria.valorTotal).toBe(10);
  });

  it('trata valor null como 0', () => {
    const entregas = [
      { entregadorId: 1, valor: null, entregador: { nome: 'João' } },
    ];
    const result = agruparPorEntregador(entregas);
    expect(result[0].valorTotal).toBe(0);
  });

  it('retorna array vazio para input vazio', () => {
    expect(agruparPorEntregador([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `cd backend && npx vitest run tests/entregaService.test.js`
Expected: FAIL (module não exporta `agruparPorEntregador`).

- [ ] **Step 3: Implementar helper e refatorar `resumoDiario`**

Substituir linhas 87-100 de `entregaService.js` por:

```js
function agruparPorEntregador(entregas) {
  const map = {};
  for (const e of entregas) {
    const id = e.entregadorId;
    if (!map[id]) {
      map[id] = { id, nome: e.entregador.nome, entregas: 0, valorTotal: 0 };
    }
    map[id].entregas += 1;
    map[id].valorTotal += Number(e.valor || 0);
  }
  return Object.values(map);
}

async function resumoDiario(data) {
  const dataInicio = data ? new Date(data + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const dataFim = new Date(dataInicio);
  dataFim.setUTCHours(23, 59, 59, 999);

  const entregas = await prisma.entregaDiaria.findMany({
    where: { empresaId: 1, data: { gte: dataInicio, lte: dataFim } },
    include: { entregador: true },
  });

  const entregadores = agruparPorEntregador(entregas);

  return {
    data: dataInicio.toISOString().slice(0, 10),
    totalEntregas: entregas.length,
    totalValor: entregas.reduce((acc, e) => acc + Number(e.valor || 0), 0),
    entregadores,
  };
}
```

E ajustar exportações no final do arquivo:

```js
module.exports = { listarEntregas, registrarEntrega, removerEntrega, resumoDiario, resumoPorPeriodo, agruparPorEntregador };
```
(`resumoPorPeriodo` vem da Task 2 — placeholder não importa, adicionar na Task 2.)

> Nota: no export final desta Task, omitir `resumoPorPeriodo` (ainda não existe). Adicionar quando Tarefa 2 exportá-la. Ajuste aqui:
> `module.exports = { listarEntregas, registrarEntrega, removerEntrega, resumoDiario, agruparPorEntregador };`

- [ ] **Step 4: Rodar teste e confirmar passagem**

Run: `cd backend && npx vitest run tests/entregaService.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Verificação syntax + regressão resumoDiario**

Run: `cd backend && node --check src/services/entregaService.js`
Expected: sem saída (OK).

Verificação regressão (opcional, se servidor rodando): `curl -s "http://localhost:3000/api/entregas/resumo?data=2026-08-04" -H "Authorization: Bearer <token>"` deve continuar retornando `{ data, totalEntregas, totalValor, entregadores }`.

- [ ] **Step 6: Commit (não executar — usuário commita)**

```bash
git add backend/src/services/entregaService.js backend/tests/entregaService.test.js
git commit -m "refactor: extrai helper agruparPorEntregador do resumoDiario (TDD)"
```
(Sessão: pular commit e avisar.)

---

## Task 2: `resumoPorPeriodo` no service (TDD)

**Files:**
- Modify: `backend/src/services/entregaService.js` (add `resumoPorPeriodo`)
- Modify: `backend/tests/entregaService.test.js` (extender)

**Interfaces:**
- Consumes: `agruparPorEntregador` (Task 1), `sql.buscarPedido(pedidoId)` (retorna `{ clienteNome, itens, valoresItens, total }`).
- Produces: `async resumoPorPeriodo(inicio, fim, entregadorId?, ctx)` → `{ inicio, fim, totalEntregas, totalValor, entregadores: Array<Metrics> }` onde `Metrics = { id, nome, entregas, valorTotal, pedidos: Array<{ pedidoId, valor, cliente, itens, totalPedido }> }`.

- [ ] **Step 1: Extender testes com `resumoPorPeriodo`**

Acrescentar ao `backend/tests/entregaService.test.js`:

```js
import { resumoPorPeriodo } from '../src/services/entregaService.js';
import { prisma } from '../src/config/prisma';
import { buscarPedido } from '../src/repositories/sqlRepository';

describe('resumoPorPeriodo', () => {
  beforeEach(() => {
    prisma.entregaDiaria.findMany.mockReset();
    buscarPedido.mockReset();
  });

  it('filtra por período e agrupa com detalhe dos pedidos', async () => {
    prisma.entregaDiaria.findMany.mockResolvedValue([
      { entregadorId: 1, valor: '12.00', pedidoId: '003', data: new Date('2026-08-04T10:00:00Z'), entregador: { nome: 'João' } },
      { entregadorId: 1, valor: '12.00', pedidoId: '004', data: new Date('2026-08-04T11:00:00Z'), entregador: { nome: 'João' } },
    ]);
    buscarPedido.mockImplementation(async (id) => ({
      id, clienteNome: 'Cliente ' + id, itens: [{ produtoId: 1, quantidade: 2, precoUnitario: '6.00' }], valoresItens: '12.00', total: '12.00',
    }));

    const result = await resumoPorPeriodo('2026-08-04', '2026-08-10');

    expect(prisma.entregaDiaria.findMany).toHaveBeenCalledWith({
      where: { empresaId: 1, entregadorId: undefined, data: { gte: new Date('2026-08-04T00:00:00.000Z'), lte: new Date('2026-08-10T23:59:59.999Z') } },
      include: { entregador: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(result.totalEntregas).toBe(2);
    expect(result.totalValor).toBe(24);
    expect(result.entregadores).toHaveLength(1);
    const joao = result.entregadores[0];
    expect(joao.nome).toBe('João');
    expect(joao.entregas).toBe(2);
    expect(joao.valorTotal).toBe(24);
    expect(joao.pedidos).toHaveLength(2);
    expect(joao.pedidos[0]).toMatchObject({ pedidoId: '003', valor: 12, cliente: 'Cliente 003', totalPedido: 12 });
  });

  it('filtra por entregadorId quando fornecido', async () => {
    prisma.entregaDiaria.findMany.mockResolvedValue([]);
    await resumoPorPeriodo('2026-08-04', '2026-08-10', '7');
    expect(prisma.entregaDiaria.findMany).toHaveBeenCalledWith({
      where: { empresaId: 1, entregadorId: 7, data: { gte: new Date('2026-08-04T00:00:00.000Z'), lte: new Date('2026-08-10T23:59:59.999Z') } },
      include: { entregador: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('retorna vazio quando sem entregas', async () => {
    prisma.entregaDiaria.findMany.mockResolvedValue([]);
    const result = await resumoPorPeriodo('2026-08-04', '2026-08-10');
    expect(result).toMatchObject({ totalEntregas: 0, totalValor: 0, entregadores: [] });
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `cd backend && npx vitest run tests/entregaService.test.js`
Expected: FAIL (`resumoPorPeriodo` não exportado).

- [ ] **Step 3: Implementar `resumoPorPeriodo`**

Acrescentar antes de `module.exports`:

```js
const sql = require('../repositories/sqlRepository');

async function resumoPorPeriodo(inicio, fim, entregadorId, ctx = {}) {
  const where = {
    empresaId: 1,
    entregadorId: entregadorId ? Number(entregadorId) : undefined,
    data: { gte: new Date(inicio + 'T00:00:00.000Z'), lte: new Date(fim + 'T23:59:59.999Z') },
  };
  const entregas = await prisma.entregaDiaria.findMany({
    where,
    include: { entregador: true },
    orderBy: { createdAt: 'asc' },
  });

  const map = {};
  for (const e of entregas) {
    const id = e.entregadorId;
    if (!map[id]) {
      map[id] = { id, nome: e.entregador.nome, entregas: 0, valorTotal: 0, pedidos: [] };
    }
    map[id].entregas += 1;
    map[id].valorTotal += Number(e.valor || 0);

    const pedido = await sql.buscarPedido(e.pedidoId).catch(() => null);
    map[id].pedidos.push({
      pedidoId: e.pedidoId,
      valor: Number(e.valor || 0),
      cliente: pedido ? pedido.clienteNome : '-',
      itens: pedido && Array.isArray(pedido.itens) ? pedido.itens.map(function (i) {
        return { produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.precoUnitario };
      }) : [],
      totalPedido: pedido ? Number(pedido.total || 0) : 0,
    });
  }

  const entregadores = Object.values(map);

  return {
    inicio,
    fim,
    totalEntregas: entregas.length,
    totalValor: entregas.reduce((acc, e) => acc + Number(e.valor || 0), 0),
    entregadores,
  };
}
```

E atualizar `module.exports`:

```js
module.exports = { listarEntregas, registrarEntrega, removerEntrega, resumoDiario, resumoPorPeriodo, agruparPorEntregador };
```

> Requisição `const sql = require('../repositories/sqlRepository');` já pode existir no topo do arquivo (não, só `prisma`/`logger`/`auditService`). Adicionar import no topo, abaixo da linha `const prisma = ...`:

```js
const sql = require('../repositories/sqlRepository');
```

- [ ] **Step 4: Rodar teste e confirmar passagem**

Run: `cd backend && npx vitest run tests/entregaService.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Syntax check**

Run: `cd backend && node --check src/services/entregaService.js`
Expected: sem saída.

- [ ] **Step 6: Commit (pular)**

---

## Task 3: Controller `resumoPeriodo` + rota

**Files:**
- Modify: `backend/src/controllers/entregaController.js` (add `exports.resumoPeriodo`)
- Modify: `backend/src/routes/entregaRoutes.js` (add `GET /resumo-periodo`)

**Interfaces:**
- Consumes: `entregaService.resumoPorPeriodo(inicio, fim, entregador, ctx)`.
- Produces: endpoint `GET /api/entregas/resumo-periodo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&entregador=<id|omitir>`.

- [ ] **Step 1: Adicionar handler ao controller**

Acrescentar ao `backend/src/controllers/entregaController.js` (antes do último }):

```js
exports.resumoPeriodo = asyncHandler(async (req, res) => {
  const { inicio, fim, entregador } = req.query;
  if (!inicio || !fim) {
    return res.status(400).json({ error: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' });
  }
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(inicio) || !re.test(fim)) {
    return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
  }
  const resultado = await entregaService.resumoPorPeriodo(inicio, fim, entregador, getCtx(req));
  res.json(resultado);
});
```

- [ ] **Step 2: Adicionar rota**

Modificar `backend/src/routes/entregaRoutes.js`:

```js
router.get('/resumo-periodo', authenticate, authorize('superadmin', 'admin'), controller.resumoPeriodo);
```
(inserir **antes** da linha `router.get('/resumo', ...)` — ordem não interfere, mas mantém agrupado.)

Arquivo final:

```js
const { Router } = require('express');
const controller = require('../controllers/entregaController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/resumo-periodo', authenticate, authorize('superadmin', 'admin'), controller.resumoPeriodo);
router.get('/resumo', authenticate, authorize('superadmin', 'admin'), controller.resumo);
router.get('/', authenticate, authorize('superadmin', 'admin'), controller.listar);
router.post('/', authenticate, authorize('superadmin', 'admin'), controller.registrar);
router.delete('/:pedidoId', authenticate, authorize('superadmin', 'admin'), controller.remover);

module.exports = router;
```

- [ ] **Step 3: Syntax check + restart**

```bash
cd backend && node --check src/controllers/entregaController.js && node --check src/routes/entregaRoutes.js
```
Expected: sem saída para ambos.

Reiniciar servidor (matar PID em `:3000` antes):
```bash
cd backend && node server.js
```
Expected: `Servidor iniciado na porta 3000`.

- [ ] **Step 4: Teste manual do endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
curl -s -w "\nHTTP %{http_code}\n" "http://localhost:3000/api/entregas/resumo-periodo?inicio=2026-08-04&fim=2026-08-10" -H "Authorization: Bearer $TOKEN"
```
Expected: HTTP 200 `{ inicio, fim, totalEntregas, totalValor, entregadores: [...] }`.

Teste 400:
```bash
curl -s -w "\nHTTP %{http_code}\n" "http://localhost:3000/api/entregas/resumo-periodo?inicio=2026-08-04" -H "Authorization: Bearer $TOKEN"
```
Expected: HTTP 400 `{ error: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' }`.

Teste 401 ausência de token:
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:3000/api/entregas/resumo-periodo?inicio=2026-08-04&fim=2026-08-10"
```
Expected: HTTP 401.

- [ ] **Step 5: Commit (pular)**

---

## Task 4: Página `relatorios-entregadores.html`

**Files:**
- Create: `relatorios-entregadores.html` (raiz do repo)

**Interfaces:**
- Consumes: `GET /api/entregas/resumo-periodo?inicio&fim&entregador`, `GET /api/entregadores?ativo=true`.
- Produces: Página standalone com filtros, tabela por entregador com lista de pedidos expansível, total geral.

- [ ] **Step 1: Criar o arquivo HTML**

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>Relatório de Entregadores - Fabrica de salgados Costa</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-visual">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script>
if(!authGuard()) throw new Error('Redirect');
var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
if(!_au.role || !['admin','superadmin'].includes(_au.role)) { window.location.href = 'dashboard.html'; }
</script>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/relatorios-page.css">
</head>
<body>

<h1><i class="fas fa-truck"></i> Relatório de Entregadores</h1>

<div class="card">
  <h2 style="font-size:16px;margin-bottom:16px;"><i class="fas fa-filter"></i> Filtros</h2>
  <div class="filtro-datas" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
    <label>De <input type="date" id="dataInicio"></label>
    <label>Até <input type="date" id="dataFim"></label>
    <label>Entregador
      <select id="filtroEntregador">
        <option value="">Todos</option>
      </select>
    </label>
    <button onclick="carregarRelatorio()"><i class="fas fa-filter"></i> Filtrar</button>
  </div>
</div>

<div id="relatorioContainer">
  <p style="color:#94a3b8;font-size:13px;">Selecione um período para visualizar.</p>
</div>

<script>
const API = window.location.origin + '/api';
const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
const TOKEN = authUser ? (authUser.token || '') : '';

async function apiRequest(path, options = {}) {
  const url = API + path;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro na requisição' }));
    throw new Error(err.error || 'Erro');
  }
  return res.json();
}

function fmtMoeda(v) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
}

function fmtItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return '<span style="color:#94a3b8;">—</span>';
  return itens.map(function(i) {
    var q = Number(i.quantidade) || 1;
    var p = Number(i.precoUnitario || 0);
    return '<div>' + q + 'x Produto #' + i.produtoId + ' — ' + fmtMoeda(p) + '</div>';
  }).join('');
}

async function carregarEntregadores() {
  try {
    const list = await apiRequest('/entregadores?ativo=true');
    const sel = document.getElementById('filtroEntregador');
    list.forEach(function(d) {
      var opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.nome;
      sel.appendChild(opt);
    });
  } catch(e) {
    toast && toast('Erro ao carregar entregadores: ' + e.message, 'danger');
  }
}

async function carregarRelatorio() {
  const inicio = document.getElementById('dataInicio').value;
  const fim = document.getElementById('dataFim').value;
  const entregador = document.getElementById('filtroEntregador').value;
  const container = document.getElementById('relatorioContainer');

  if (!inicio || !fim) { container.innerHTML = '<p style="color:#94a3b8;">Selecione período válido.</p>'; return; }

  container.innerHTML = '<p style="color:#94a3b8;">Carregando...</p>';

  var query = '?inicio=' + encodeURIComponent(inicio) + '&fim=' + encodeURIComponent(fim);
  if (entregador) query += '&entregador=' + encodeURIComponent(entregador);

  try {
    const data = await apiRequest('/entregas/resumo-periodo' + query);
    renderRelatorio(data);
  } catch(e) {
    container.innerHTML = '<p style="color:#dc2626;">Erro: ' + e.message + '</p>';
  }
}

function renderRelatorio(data) {
  const container = document.getElementById('relatorioContainer');

  if (!data.entregadores || data.entregadores.length === 0) {
    container.innerHTML = '<div class="card"><p style="color:#94a3b8;">Nenhuma entrega no período.</p></div>';
    return;
  }

  let html = '';
  html += '<div class="card">';
  html += '<div style="overflow-x:auto"><table>';
  html += '<thead><tr><th>Entregador</th><th>Nº Entregas</th><th>Valor Total</th><th>Pedidos</th></tr></thead>';
  html += '<tbody>';
  data.entregadores.forEach(function(d) {
    const pedidosHTML = d.pedidos.map(function(p) {
      return '<div class="pedido-card" style="margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:6px;font-size:12px;">'
        + '<strong>#' + p.pedidoId + '</strong> — ' + p.cliente + '<br>'
        + '<strong>Total pedido:</strong> ' + fmtMoeda(p.totalPedido) + '<br>'
        + '<strong>Valor entrega:</strong> ' + fmtMoeda(p.valor) + '<br>'
        + '<strong>Itens:</strong><br>' + fmtItens(p.itens)
        + '</div>';
    }).join('');
    html += '<tr>';
    html += '<td><strong>' + d.nome + '</strong></td>';
    html += '<td>' + d.entregas + '</td>';
    html += '<td>' + fmtMoeda(d.valorTotal) + '</td>';
    html += '<td>' + pedidosHTML + '</td>';
    html += '</tr>';
  });
  html += '</tbody>';
  html += '<tfoot><tr style="background:#f1f5f9;font-weight:700;">';
  html += '<td>TOTAL GERAL</td>';
  html += '<td>' + data.totalEntregas + '</td>';
  html += '<td>' + fmtMoeda(data.totalValor) + '</td>';
  html += '<td>—</td>';
  html += '</tr></tfoot>';
  html += '</table></div></div>';

  container.innerHTML = html;
}

// Defaults: dataInicio e dataFim = hoje
(function init() {
  var hoje = new Date().toISOString().slice(0, 10);
  document.getElementById('dataInicio').value = hoje;
  document.getElementById('dataFim').value = hoje;
  carregarEntregadores();
  carregarRelatorio();
})();
</script>
<script src="js/utils.js"></script>
<script src="js/theme.js" defer></script>
</body>
</html>
```

> Nota: `authGuard()` e `toast()` vêm de `js/utils.js` (incluído no final). O `authGuard` deve ser incluído **antes** da inline script que o usa, OU a inclusão de utils.js deve ser movida para o `<head>` antes do guard. Verificar padrão do relatorios.html — lá utils.js é incluído no `<head>` antes do guard inline. Replicar: mover `<script src="js/utils.js"></script>` para antes do inline guard (no `<head>`).

- [ ] **Step 2: Ajustar ordem do utils.js (correção padrão)**

No arquivo recém-criado, mover a linha `<script src="js/utils.js"></script>` do final do `<body>` para dentro do `<head>`, **antes** do script inline com `authGuard()`. Estrutura final do `<head>`:

```html
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/relatorios-page.css">
<script src="js/utils.js"></script>
<script>
if(!authGuard()) throw new Error('Redirect');
var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
if(!_au.role || !['admin','superadmin'].includes(_au.role)) { window.location.href = 'dashboard.html'; }
</script>
```

- [ ] **Step 3: Teste manual no browser**

Abrir `http://localhost:5173/relatorios-entregadores.html`:
- Página renderiza sem redirect se admin/superadmin
- Filtros aparecem, campos de data preenchidos com hoje
- Select popula entregadores ativos
- Clica Filtrar → busca dados → tabela com entregadores + pedidos
- Se sem entregas, mostra "Nenhuma entrega no período."

- [ ] **Step 4: Commit (pular)**

---

## Task 5: Submenu Entregas no `dashboard.html`

**Files:**
- Modify: `dashboard.html` linhas 95-101 (seção "Entregas")

- [ ] **Step 1: Modificar a seção Entregas**

Localizar:

```js
{
  title: 'Entregas',
  items: [
    { icon: 'fa-truck', label: 'Entregadores', page: 'entregador.html' },
  ]
},
```

Substituir por:

```js
{
  title: 'Entregas',
  items: [
    { icon: 'fa-truck', label: 'Cadastro de Entregadores', page: 'entregador.html' },
    { icon: 'fa-chart-line', label: 'Relatório de Entregadores', page: 'relatorios-entregadores.html' },
  ]
},
```

- [ ] **Step 2: Teste manual**

Recarregar `/dashboard.html`, abrir sidebar → seção "Entregas" deve mostrar 2 itens: "Cadastro de Entregadores" (vai para `entregador.html`) e "Relatório de Entregadores" (vai para `relatorios-entregadores.html`). Nenhum link quebrado.

- [ ] **Step 3: Commit (pular)**

---

## Task 6: E2E manual + build dist

**Files:** Nenhum (verificação).

- [ ] **Step 1: Fluxo E2E**

1. Login admin em `localhost:5173`
2. Sidebar → Entregas → Relatório de Entregadores
3. Filtrar período com entregas existentes
4. Verificar:
   - Tabela tem colunas Nome, Nº Entregas, Valor Total, Pedidos
   - Cada entregador em linha própria
   - Lista de pedidos mostra #ID, cliente, total do pedido, valor da entrega, itens
   - Total geral no rodapé
5. Filtrar por um entregador específico → só aparece ele
6. Período sem entregas → "Nenhuma entrega no período"

- [ ] **Step 2: Verificação final de testes**

```bash
cd backend && npx vitest run tests/
cd "C:\Users\djesus\Downloads\projects-vscode\sic-ia - Copy" && npm test
```
Expected: backend tests PASS (6+), frontend tests PASS (10 existentes).

- [ ] **Step 3: Build dist (opcional, sincronizar)**

```bash
cd "C:\Users\djesus\Downloads\projects-vscode\sic-ia - Copy" && npx vite build
```
Expected: build success, `dist/relatorios-entregadores.html` criado.

Verificar:
```bash
ls dist/relatorios-entregadores.html
```
Expected: arquivo existe.

- [ ] **Step 4: Adicionar ao input do vite.config.js (opcional)**

Atualizar `vite.config.js` input para incluir a nova página (necessário para build):

```js
'entregador-relatorio': resolve(__dirname, 'relatorios-entregadores.html'),
```

(Localizar seção `input: { ... }` no `vite.config.js` e adicionar a linha.)

- [ ] **Step 5: Commit final (pular)**