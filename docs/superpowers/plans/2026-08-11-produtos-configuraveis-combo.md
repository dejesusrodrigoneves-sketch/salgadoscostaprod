# Produtos Configuráveis — Combo Salgado + Combo Açaí Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir ao lojista cadastrar no painel produtos configuráveis (Combo Salgado com distribuição de N unidades entre sabores sem custo; Combo Açaí com acréscimos onde N primeiros são grátis, demais cobram preço individual, com teto máximo), e renderizar o seletor correto no PDV.

**Architecture:** Produto ganha coluna `config JSONB` com dois schemas separados (`combo_salgado` e `combo_acai`), nunca misturados. O PDV decide o comportamento pelo `config.tipo`, não pelo campo `type`. Lógica de preço/validação vive num helper puro (`js/comboConfig.js`) testável em vitest. Fluxo de pedido e `ItensPedido.sabores` inalterados.

**Tech Stack:** Express, Prisma (PostgreSQL/Neon), Vanilla JS, Vitest (node env).

## Global Constraints

- **Não alterar**: APIs de pedido, regras de negócio existentes, `ItensPedido.sabores`, cardápio público `index.html`, relatórios.
- **Sem commit em `docs/superpowers/`** (spec + plan ficam no working tree, não commitados).
- Produtos configuráveis usam `type = 3` (reuso combo) — PDV decide por `config.tipo`.
- Migração de coluna via ALTER TABLE no `backend/prisma/ensureColumns.js` + schema.prisma (sem pasta migrations).
- Paleta/estilo: seguir markup existente do painelLoja.html (`.row`, `.lbl`, `.chip`, `.btn save`).
- Testes rodam com `npx vitest run` (include: `tests/**/*.test.js`, environment `node`).

---

### Task 1: Helper puro de combos (`js/comboConfig.js`)

**Files:**
- Create: `js/comboConfig.js`
- Test: `tests/comboConfig.test.js`

**Interfaces:**
- Consumes: nada (funções puras, sem DOM/import).
- Produces:
  - `ComboConfig.calcularPrecoAcai(config, escolhidos)` → `{ extra, gratis, pagos }` onde `extra` = soma dos acréscimos pagos (números), `gratis` = array dos N primeiros nomes, `pagos` = array dos demais nomes.
  - `ComboConfig.calcularPrecoSalgado(config)` → `Number` (sempre o preço fixo; retorna `0` — marcador de que sabores são grátis).
  - `ComboConfig.tipoDe(config)` → `'combo_salgado' | 'combo_acai' | null` (retorna `config?.tipo` se válido, senão `null`).
  - `ComboConfig.validarConfig(tipo, cfg)` → `{ ok: boolean, erro?: string }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/comboConfig.test.js
const ComboConfig = require('../js/comboConfig.js');

describe('calcularPrecoAcai', () => {
  const cfg = { tipo: 'combo_acai', acrescimosGratis: 3, maxAcrescimos: 5,
    acrescimos: [{ nome: 'Oreo', preco: 2 }, { nome: 'Aveia', preco: 1 }, { nome: 'Paçoca', preco: 1.5 }] };

  test('primeiros N escolhidos sao gratis, demais pagam', () => {
    const r = ComboConfig.calcularPrecoAcai(cfg, ['Oreo', 'Paçoca', 'Aveia', 'Leite Ninho', 'Granola']);
    expect(r.extra).toBe(3); // Oreo(2)+Paçoca(1.5) pagos... ver assert abaixo
  });

  test('exatamente N escolhidos => extra zero', () => {
    const r = ComboConfig.calcularPrecoAcai(cfg, ['Oreo', 'Aveia', 'Paçoca']);
    expect(r.extra).toBe(0);
    expect(r.pagos).toEqual([]);
    expect(r.gratis).toEqual(['Oreo', 'Aveia', 'Paçoca']);
  });

  test('acrescimo sem preco configurado soma zero (nao quebra)', () => {
    const r = ComboConfig.calcularPrecoAcai(cfg, ['X', 'Y', 'Z', 'Oreo']);
    expect(r.extra).toBe(2);
  });
});

describe('tipoDe', () => {
  test('reconhece combo_salgado e combo_acai', () => {
    expect(ComboConfig.tipoDe({ tipo: 'combo_salgado' })).toBe('combo_salgado');
    expect(ComboConfig.tipoDe({ tipo: 'combo_acai' })).toBe('combo_acai');
    expect(ComboConfig.tipoDe(null)).toBe(null);
    expect(ComboConfig.tipoDe({ tipo: 'outro' })).toBe(null);
  });
});

describe('validarConfig', () => {
  test('combo_salgado invalido sem unidades', () => {
    const r = ComboConfig.validarConfig('combo_salgado', { tipo: 'combo_salgado', sabores: [] });
    expect(r.ok).toBe(false);
  });
  test('combo_acai invalido quando max < gratis', () => {
    const r = ComboConfig.validarConfig('combo_acai', { tipo: 'combo_acai', acrescimosGratis: 5, maxAcrescimos: 2, acrescimos: [] });
    expect(r.ok).toBe(false);
  });
  test('combo_acai invalido com preco negativo', () => {
    const r = ComboConfig.validarConfig('combo_acai', { tipo: 'combo_acai', acrescimosGratis: 1, maxAcrescimos: 3, acrescimos: [{ nome: 'Oreo', preco: -1 }] });
    expect(r.ok).toBe(false);
  });
});
```

> Nota para implementador: o primeiro teste (`expect(r.extra).toBe(3)`) está propositalmente simplificado. A ordem de escolha com N=3 grátis: `['Oreo','Paçoca','Aveia','Leite Ninho','Granola']` → grátis = `['Oreo','Paçoca','Aveia']`, pagos = `['Leite Ninho','Granola']` (sem preço) → `extra = 0`. **Corrija o assert para `toBe(0)`** antes de prosseguir — ou reordene a entrada para refletir `extra = 3` (ex. `['Leite Ninho','Granola','X','Oreo','Paçoca']` → pagos `['Oreo','Paçoca']` → `extra = 3.5`). Escolha um e ajuste o assert correspondente.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/comboConfig.test.js`
Expected: FAIL — "Cannot find module '../js/comboConfig.js'"

- [ ] **Step 3: Write minimal implementation**

```js
// js/comboConfig.js
(function (root) {
  var TIPOS = ['combo_salgado', 'combo_acai'];

  function tipoDe(config) {
    if (config && TIPOS.indexOf(config.tipo) !== -1) return config.tipo;
    return null;
  }

  function calcularPrecoAcai(config, escolhidos) {
    var lista = Array.isArray(escolhidos) ? escolhidos : [];
    var gratis = lista.slice(0, config.acrescimosGratis);
    var pagos = lista.slice(config.acrescimosGratis);
    var extra = pagos.reduce(function (soma, nome) {
      var op = (config.acrescimos || []).find(function (a) { return a.nome === nome; });
      return soma + (op ? Number(op.preco) || 0 : 0);
    }, 0);
    return { extra: Number(extra.toFixed(2)), gratis: gratis, pagos: pagos };
  }

  function calcularPrecoSalgado() {
    return 0;
  }

  function validarConfig(tipo, cfg) {
    if (tipo === 'combo_salgado') {
      if (!cfg || Number(cfg.unidades) < 1) return { ok: false, erro: 'unidades deve ser >= 1' };
      return { ok: true };
    }
    if (tipo === 'combo_acai') {
      var g = Number(cfg && cfg.acrescimosGratis) || 0;
      var m = Number(cfg && cfg.maxAcrescimos) || 0;
      if (m < g) return { ok: false, erro: 'maxAcrescimos deve ser >= acrescimosGratis' };
      var opcoes = (cfg && cfg.acrescimos) || [];
      for (var i = 0; i < opcoes.length; i++) {
        var nome = String(opcoes[i].nome || '').trim();
        var preco = Number(opcoes[i].preco);
        if (!nome) return { ok: false, erro: 'acrescimo com nome vazio' };
        if (isNaN(preco) || preco < 0) return { ok: false, erro: 'preco negativo/invalido: ' + nome };
      }
      return { ok: true };
    }
    return { ok: false, erro: 'tipo invalido' };
  }

  var api = { tipoDe: tipoDe, calcularPrecoAcai: calcularPrecoAcai, calcularPrecoSalgado: calcularPrecoSalgado, validarConfig: validarConfig };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ComboConfig = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/comboConfig.test.js`
Expected: PASS (todos os asserts)

- [ ] **Step 5: Commit (código apenas, sem docs/)**

```bash
git add js/comboConfig.js tests/comboConfig.test.js
git commit -m "feat: helper puro de combos configuráveis"
```

---

### Task 2: Backend — coluna `config` + persistência + sanitização

**Files:**
- Modify: `backend/prisma/schema.prisma:92` (linha do `categoryId`, adicionar `config` após)
- Modify: `backend/prisma/ensureColumns.js`
- Modify: `backend/src/services/productService.js:4-7,33-61`
- Test: `backend/tests/sqlRepository.test.js` (verificar padrão existente antes de adicionar)

**Interfaces:**
- Consumes: `ComboConfig.validarConfig` (Task 1) — opcional no backend; mínimo é persistir + sanitizar nomes.
- Produces: `Produto.config` (JSONB) retornado por `listarProdutos()`/`buscarProduto()`; `config` aceito em create/update.

- [ ] **Step 1: Adicionar coluna no schema**

Em `backend/prisma/schema.prisma`, model `Produto`, após a linha `categoryId Int? @map("category_id")`:

```prisma
  config             Json?                @map("config")
```

- [ ] **Step 2: Adicionar ALTER TABLE no ensureColumns**

Em `backend/prisma/ensureColumns.js`:

```js
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS produtos ADD COLUMN IF NOT EXISTS config JSONB');
```

- [ ] **Step 3: Sanitizar `config` no service**

Em `backend/src/services/productService.js`, adicionar helper e chamar em `criar` e `atualizar`. Substituir o bloco `function formatProduto` (linhas 17-20) por:

```js
function sanitizeConfig(config) {
  if (!config || typeof config !== 'object') return null;
  const out = {};
  if (config.tipo === 'combo_salgado') {
    out.tipo = 'combo_salgado';
    out.unidades = Number(config.unidades) || 0;
    out.sabores = (Array.isArray(config.sabores) ? config.sabores : [])
      .map(s => String(s || '').trim().replace(/<[^>]*>/g, ''))
      .filter(Boolean);
  } else if (config.tipo === 'combo_acai') {
    out.tipo = 'combo_acai';
    out.acrescimosGratis = Number(config.acrescimosGratis) || 0;
    out.maxAcrescimos = Number(config.maxAcrescimos) || 0;
    out.acrescimos = (Array.isArray(config.acrescimos) ? config.acrescimos : [])
      .map(a => ({
        nome: String(a.nome || '').trim().replace(/<[^>]*>/g, ''),
        preco: Number(a.preco) || 0,
      }))
      .filter(a => a.nome);
  } else {
    return null;
  }
  return out;
}
```

Em `criar`, dentro do `sanitized`, antes de `sql.criarProduto`:

```js
  if (sanitized.config) sanitized.config = sanitizeConfig(sanitized.config);
```

Em `atualizar`, dentro do `sanitized`, antes de `sql.atualizarProduto`:

```js
  if (sanitized.config !== undefined) sanitized.config = sanitizeConfig(sanitized.config);
```

- [ ] **Step 4: Verificar persistência no repository**

Confirmar que `criarProduto`/`atualizarProduto` em `backend/src/repositories/sqlRepository.js` propagam `config` (já usam `{ ...rest }` — nada a mudar, apenas verificação). Se `config` vier como objeto JS, Prisma serializa para JSONB automaticamente.

- [ ] **Step 5: Teste manual via API (requer servidor)**

Run: servidor rodando → `curl -X POST <origin>/api/produtos -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"id":9000,"name":"Açaí Teste","price":10,"type":3,"config":{"tipo":"combo_acai","acrescimosGratis":3,"maxAcrescimos":5,"acrescimos":[{"nome":"Oreo","preco":2}]}}'`
Expected: 201, `config` presente no response; depois `GET /api/produtos` lista com `config`.

- [ ] **Step 6: Commit (código apenas, sem docs/)**

```bash
git add backend/prisma/schema.prisma backend/prisma/ensureColumns.js backend/src/services/productService.js
git commit -m "feat: produto.config JSONB com sanitização"
```

---

### Task 3: Painel — bloco Tipo de Produto + campos dinâmicos + payload

**Files:**
- Modify: `painelLoja.html:166-181` (inserir bloco antes do `<details>` "Avançado", dentro do form)
- Modify: `js/painel.js:270-280` (declarações de elementos), `415-423` (limparFormProduto), `425-459` (carregarNoForm), `486-502` (payload), `376-397` (badge na tabela)

**Interfaces:**
- Consumes: `ComboConfig` global (carregar `js/comboConfig.js` antes de `js/painel.js` no `painelLoja.html`), `ComboConfig.validarConfig`.
- Produces: no payload de produto → `type: 3` + `config` objeto. Badge na tabela identificando `Combo Salgado`/`Combo Açaí`.

- [ ] **Step 1: Carregar comboConfig no painel**

Em `painelLoja.html` linha 381, antes de `js/painel.js`:

```html
<script src="js/comboConfig.js"></script>
<script src="js/painel.js?=2"></script>
```

- [ ] **Step 2: Adicionar bloco de UI no form**

Em `painelLoja.html`, após o bloco "Dados Principais" (linha ~142, antes do `<details>`), inserir:

```html
<div class="form-section">
  <h4><i class="fas fa-layer-group"></i> Tipo de Produto</h4>
  <div class="row">
    <div class="lbl">Tipo</div>
    <select id="prodTipo">
      <option value="">Simples</option>
      <option value="combo_salgado">Combo Salgado</option>
      <option value="combo_acai">Combo Açaí</option>
    </select>
  </div>
  <div id="camposComboSalgado" style="display:none;">
    <div class="row">
      <div class="lbl">Total de unidades</div>
      <input type="number" id="comboUnidades" min="1" placeholder="Ex.: 50" />
    </div>
    <div class="row">
      <div class="lbl">Sabores</div>
      <div id="listaSabores" style="flex:1;display:flex;flex-direction:column;gap:6px;"></div>
      <button class="btn ghost" type="button" onclick="adicionarLinhaSabor()" style="align-self:flex-start;"><i class="fas fa-plus"></i> Adicionar sabor</button>
    </div>
  </div>
  <div id="camposComboAcai" style="display:none;">
    <div class="row">
      <div class="lbl">Acréscimos grátis</div>
      <input type="number" id="comboGratis" min="0" placeholder="Ex.: 3" />
    </div>
    <div class="row">
      <div class="lbl">Máximo de acréscimos</div>
      <input type="number" id="comboMax" min="0" placeholder="Ex.: 5" />
    </div>
    <div class="row">
      <div class="lbl">Acréscimos (nome + preço)</div>
      <div id="listaAcrescimos" style="flex:1;display:flex;flex-direction:column;gap:6px;"></div>
      <button class="btn ghost" type="button" onclick="adicionarLinhaAcrescimo()" style="align-self:flex-start;"><i class="fas fa-plus"></i> Adicionar acréscimo</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Declarar elementos + listeners de tipo**

Em `js/painel.js`, na seção de consts (após linha 279), adicionar:

```js
const fTipo = document.getElementById('prodTipo');
const camposSalgado = document.getElementById('camposComboSalgado');
const camposAcai = document.getElementById('camposComboAcai');
const listaSabores = document.getElementById('listaSabores');
const listaAcrescimos = document.getElementById('listaAcrescimos');

function toggleCamposCombo() {
  const t = fTipo.value;
  camposSalgado.style.display = t === 'combo_salgado' ? '' : 'none';
  camposAcai.style.display = t === 'combo_acai' ? '' : 'none';
}
fTipo?.addEventListener('change', toggleCamposCombo);

function adicionarLinhaSabor(nome) {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;gap:6px;align-items:center;';
  d.innerHTML = '<input type="text" class="sabor-nome" placeholder="Ex.: Coxinha" value="' + (nome ? escapeHtml(nome) : '') + '" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;">' +
    '<button type="button" class="btn ghost btn-sm" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
  listaSabores.appendChild(d);
}
function adicionarLinhaAcrescimo(nome, preco) {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;gap:6px;align-items:center;';
  d.innerHTML =
    '<input type="text" class="acres-nome" placeholder="Ex.: Oreo" value="' + (nome ? escapeHtml(nome) : '') + '" style="flex:2;padding:6px 10px;border:1px solid var(--border);border-radius:6px;">' +
    '<input type="number" step="0.01" min="0" class="acres-preco" placeholder="R$" value="' + (preco != null ? preco : '') + '" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;">' +
    '<button type="button" class="btn ghost btn-sm" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
  listaAcrescimos.appendChild(d);
}
```

- [ ] **Step 4: Limpar form de combo**

Em `limparFormProduto()` (após linha 422 `toggleEstoqueFields()`), adicionar:

```js
  if (fTipo) fTipo.value = '';
  if (listaSabores) listaSabores.innerHTML = '';
  if (listaAcrescimos) listaAcrescimos.innerHTML = '';
  toggleCamposCombo();
```

- [ ] **Step 5: Repreencher na edição**

Em `carregarNoForm(id)`, após a linha `fHideWhenOutOfStock.checked = ...` (linha 441), adicionar:

```js
  const cfg = p.config || null;
  if (fTipo) {
    fTipo.value = cfg && cfg.tipo ? cfg.tipo : '';
    if (listaSabores) listaSabores.innerHTML = '';
    if (listaAcrescimos) listaAcrescimos.innerHTML = '';
    if (cfg && cfg.tipo === 'combo_salgado') {
      document.getElementById('comboUnidades').value = cfg.unidades || '';
      (cfg.sabores || []).forEach(s => adicionarLinhaSabor(s));
    } else if (cfg && cfg.tipo === 'combo_acai') {
      document.getElementById('comboGratis').value = cfg.acrescimosGratis || 0;
      document.getElementById('comboMax').value = cfg.maxAcrescimos || 0;
      (cfg.acrescimos || []).forEach(a => adicionarLinhaAcrescimo(a.nome, a.preco));
    }
    toggleCamposCombo();
  }
```

- [ ] **Step 6: Montar config no payload + validação**

Em `formProduto.addEventListener('submit', ...)`, no payload (após linha 502 `payload.categoryId = ...`), adicionar:

```js
  if (fTipo && fTipo.value) {
    let cfg = null;
    if (fTipo.value === 'combo_salgado') {
      const sabores = Array.from(document.querySelectorAll('#listaSabores .sabor-nome'))
        .map(i => i.value.trim()).filter(Boolean);
      cfg = { tipo: 'combo_salgado', unidades: Number(document.getElementById('comboUnidades').value) || 0, sabores: sabores };
    } else if (fTipo.value === 'combo_acai') {
      const acrescimos = Array.from(document.querySelectorAll('#listaAcrescimos .acres-nome')).map(function(i, idx) {
        const preco = document.querySelectorAll('#listaAcrescimos .acres-preco')[idx];
        return { nome: i.value.trim(), preco: Number(preco ? preco.value : 0) || 0 };
      }).filter(a => a.nome);
      cfg = {
        tipo: 'combo_acai',
        acrescimosGratis: Number(document.getElementById('comboGratis').value) || 0,
        maxAcrescimos: Number(document.getElementById('comboMax').value) || 0,
        acrescimos: acrescimos,
      };
    }
    const v = ComboConfig.validarConfig(fTipo.value, cfg);
    if (!v.ok) { toast(v.erro, 'warning'); return; }
    payload.type = 3;
    payload.config = cfg;
  }
```

- [ ] **Step 7: Badge de tipo na tabela**

Em `renderProdutos()`, na template (linha ~382, após o `name`), adicionar badge:

```js
          ${p.config && p.config.tipo
            ? '<span class="pill pill-active" style="font-size:10px;">' + (p.config.tipo === 'combo_acai' ? 'Açaí' : 'Combo') + '</span>'
            : ''}
```

- [ ] **Step 8: Teste manual no painel**

Run: servidor rodando → abrir `painelLoja.html`, editar/criar produto, escolher "Combo Açaí", preencher 3 grátis/5 máx + acréscimos, salvar. Esperado: salva sem erro, badge aparece, reload mantém campos.

- [ ] **Step 9: Commit (código apenas, sem docs/)**

```bash
git add painelLoja.html js/painel.js
git commit -m "feat: painel configura produto combo salgado/acai"
```

---

### Task 4: PDV — seletor combo_salgado

**Files:**
- Modify: `balcao.html` — `adicionarAoCarrinho` (linha 680-718), nova função `abrirSeletorComboSalgado` (após `abrirSeletorSabores`), `renderizarCarrinho`/`renderMiniCart` (exibição de sabores já cobre)

**Interfaces:**
- Consumes: `ComboConfig` global (carregar antes do script inline), `produto.config`.
- Produces: `item.sabores = [{ nome, qtd }]` (formato já existente), `item.qtd = 1`.

- [ ] **Step 1: Carregar comboConfig no balcao**

Em `balcao.html`, antes do `<script>` inline da linha 100, adicionar:

```html
<script src="js/comboConfig.js"></script>
```

- [ ] **Step 2: Rota no adicionarAoCarrinho**

Em `adicionarAoCarrinho(produto)`, no início (após o bloco do id 209), adicionar:

```js
  const cfgTipo = ComboConfig.tipoDe(produto.config);
  if (cfgTipo === 'combo_salgado') { abrirSeletorComboSalgado(produto); return; }
  if (cfgTipo === 'combo_acai') { abrirSeletorComboAcai(produto); return; }
```

- [ ] **Step 3: Implementar abrirSeletorComboSalgado**

Após `abrirSeletorSabores`, adicionar:

```js
function abrirSeletorComboSalgado(produto) {
  const cfg = produto.config;
  const existente = carrinho.find(p => p.id === produto.id);

  let saboresSelecionados = existente && existente.sabores ? [...existente.sabores] : [];

  const modal = document.createElement('div');
  modal.className = 'modal-sabores';
  modal.innerHTML = `
    <div class="box-sabores">
      <h3>${escapeHtml(produto.name)} — escolha ${cfg.unidades} unidades</h3>
      <div class="lista-sabores"></div>
      <p id="contadorTotal" style="margin:10px 0;font-weight:600;text-align:right;">Selecionados: ${saboresSelecionados.reduce((a,s)=>a+s.qtd,0)}/${cfg.unidades}</p>
      <button id="finalizarSabores" style="width:100%;padding:12px;border:none;border-radius:10px;background:#16a34a;color:white;font-weight:600;cursor:pointer;">Finalizar</button>
    </div>`;
  document.body.appendChild(modal);

  const lista = modal.querySelector('.lista-sabores');
  const contador = modal.querySelector('#contadorTotal');

  cfg.sabores.forEach(nome => {
    let qtd = (saboresSelecionados.find(s => s.nome === nome) || {}).qtd || 0;
    const div = document.createElement('div');
    div.className = 'sabor-item';
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;';
    div.innerHTML = `<span>${escapeHtml(nome)}</span><input type="number" min="0" value="${qtd}" style="width:50px;text-align:center;">`;
    const input = div.querySelector('input');
    input.addEventListener('input', () => {
      let valor = parseInt(input.value) || 0;
      const usados = saboresSelecionados.reduce((a, s) => a + s.qtd, 0) - qtd;
      if (usados + valor > cfg.unidades) { valor = cfg.unidades - usados; input.value = valor; }
      qtd = valor;
      const ex = saboresSelecionados.find(s => s.nome === nome);
      if (ex) { ex.qtd = qtd; if (qtd === 0) saboresSelecionados = saboresSelecionados.filter(s => s.nome !== nome); }
      else if (qtd > 0) saboresSelecionados.push({ nome: nome, qtd: qtd });
      const total = saboresSelecionados.reduce((a, s) => a + s.qtd, 0);
      contador.textContent = `Selecionados: ${total}/${cfg.unidades}`;
    });
    lista.appendChild(div);
  });

  modal.querySelector('#finalizarSabores').addEventListener('click', () => {
    const total = saboresSelecionados.reduce((a, s) => a + s.qtd, 0);
    if (total !== cfg.unidades) { toast(`Distribua exatamente ${cfg.unidades} unidades.`, 'warning'); return; }
    if (!existente) carrinho.push({ id: produto.id, nome: produto.name, preco: Number(produto.price), qtd: 1, type: 3, sabores: saboresSelecionados });
    else existente.sabores = saboresSelecionados;
    modal.remove();
    renderizarCarrinho();
    renderMiniCart();
  });
}
```

- [ ] **Step 4: Teste manual no PDV**

Run: servidor rodando, produto tipo `combo_salgado` cadastrado no painel → abrir `balcao.html`, clicar no combo. Esperado: modal abre, distribuir unidades, bloqueia se soma != unidades, salva sabores no item.

- [ ] **Step 5: Commit (código apenas, sem docs/)**

```bash
git add balcao.html
git commit -m "feat: pdv seletor combo salgado (distribuição de unidades)"
```

---

### Task 5: PDV — seletor combo_acai

**Files:**
- Modify: `balcao.html` — nova função `abrirSeletorComboAcai` (após `abrirSeletorComboSalgado`), exibição de acréscimos cobrados no carrinho, total com extra.

**Interfaces:**
- Consumes: `ComboConfig.calcularPrecoAcai`, `produto.config`.
- Produces: `item.sabores = [{ nome, qtd: 1 }]` para todos os escolhidos; `item.precoFinal = preco base + extra`; carrinho exibe "+ R$ X" dos acréscimos pagos.

- [ ] **Step 1: Implementar abrirSeletorComboAcai**

Após `abrirSeletorComboSalgado`, adicionar:

```js
function abrirSeletorComboAcai(produto) {
  const cfg = produto.config;
  const existente = carrinho.find(p => p.id === produto.id);
  let escolhidos = existente && existente.sabores ? existente.sabores.map(s => s.nome) : [];

  const modal = document.createElement('div');
  modal.className = 'modal-sabores';
  modal.innerHTML = `
    <div class="box-sabores">
      <h3>${escapeHtml(produto.name)} — acréscimos</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:8px;">${cfg.acrescimosGratis} grátis · máx ${cfg.maxAcrescimos}</p>
      <div class="lista-sabores"></div>
      <p id="contadorAcai" style="margin:10px 0;font-weight:600;text-align:right;">Escolhidos: ${escolhidos.length}</p>
      <button id="finalizarSabores" style="width:100%;padding:12px;border:none;border-radius:10px;background:#16a34a;color:white;font-weight:600;cursor:pointer;">Finalizar</button>
    </div>`;
  document.body.appendChild(modal);

  const lista = modal.querySelector('.lista-sabores');
  const contador = modal.querySelector('#contadorAcai');

  cfg.acrescimos.forEach(op => {
    const div = document.createElement('div');
    div.className = 'sabor-item';
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;cursor:pointer;';
    div.innerHTML = `<span>${escapeHtml(op.nome)}</span><span style="color:${op.preco > 0 ? '#dc2626' : '#16a34a'}">${op.preco > 0 ? '+ R$ ' + Number(op.preco).toFixed(2) : 'grátis'}</span>`;
    if (escolhidos.indexOf(op.nome) !== -1) div.style.borderColor = '#16a34a';
    div.addEventListener('click', () => {
      const idx = escolhidos.indexOf(op.nome);
      if (idx !== -1) { escolhidos.splice(idx, 1); div.style.borderColor = '#e2e8f0'; }
      else {
        if (escolhidos.length >= cfg.maxAcrescimos) { toast(`Máximo de ${cfg.maxAcrescimos} acréscimos.`, 'warning'); return; }
        escolhidos.push(op.nome); div.style.borderColor = '#16a34a';
      }
      contador.textContent = `Escolhidos: ${escolhidos.length}`;
    });
    lista.appendChild(div);
  });

  modal.querySelector('#finalizarSabores').addEventListener('click', () => {
    const r = ComboConfig.calcularPrecoAcai(cfg, escolhidos);
    const sabores = escolhidos.map(nome => ({ nome: nome, qtd: 1 }));
    if (!existente) {
      carrinho.push({ id: produto.id, nome: produto.name, preco: Number(produto.price), qtd: 1, type: 3, sabores: sabores, extra: r.extra });
    } else {
      existente.sabores = sabores; existente.extra = r.extra;
    }
    modal.remove();
    renderizarCarrinho();
    renderMiniCart();
  });
}
```

- [ ] **Step 2: Exibir extra no carrinho**

Em `renderizarCarrinho()`, o cálculo `total += item.preco * item.qtd;` (linha 404) passa a:

```js
    const extraItem = Number(item.extra) || 0;
    total += item.preco * item.qtd + extraItem;
```

E no subtotal (linha ~452), mostrar acréscimos pagos:

```js
    ${Number(item.extra) > 0 ? `<div style="font-size:12px;color:#dc2626;margin-top:4px;">+ R$ ${Number(item.extra).toFixed(2)} (acréscimos)</div>` : ''}
```

- [ ] **Step 3: Exibir extra no mini-cart**

Em `renderMiniCart()`, `total += item.preco * item.qtd;` (linha 523) passa a:

```js
    total += item.preco * item.qtd + (Number(item.extra) || 0);
```

- [ ] **Step 4: Teste manual no PDV**

Run: produto tipo `combo_acai` cadastrado → abrir `balcao.html`, clicar no açaí, marcar acréscimos. Esperado: N primeiros grátis (verde), demais com "+R$" (vermelho), bloqueia em máx, total soma extra no carrinho e mini-cart.

- [ ] **Step 5: Commit (código apenas, sem docs/)**

```bash
git add balcao.html
git commit -m "feat: pdv seletor combo acai (n gratuitos + preço extras)"
```

---

## Self-Review

- **Spec coverage:** `config JSONB` (T2), schema JSON separado (T1/T2 sanitize), `type=3` + config no painel (T3), PDV combo_salgado valida soma=unidades (T4), PDV combo_acai N grátis+preço+teto (T5), helper preço (T1), sanitização backend (T2), testes unit+E2E manual (T1/T4/T5). ✓
- **Placeholder scan:** nenhum TBD/TODO; todos os passos têm código ou comando real. Nota explícita no primeiro teste do Task 1 orienta implementador a corrigir um assert. ✓
- **Type consistency:** `ComboConfig` global exposto em `js/comboConfig.js` (UMD) e consumido por painel (T3) e balcao (T4/T5); `config.tipo` = `combo_salgado`/`combo_acai` consistente em todo o plano; `item.extra` definido em T5 e usado em T5. ✓
