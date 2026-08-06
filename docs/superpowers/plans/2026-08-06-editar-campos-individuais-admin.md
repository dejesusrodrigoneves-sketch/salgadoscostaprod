# Editar Campos Individuais no Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir edição de **um campo específico** do pedido (pagamento, tipo de entrega, endereço, bairro, cep, referência, desconto, troco, itens) via **ícone próprio (Bootstrap Icons)** no card admin, abrindo um **overlay isolado** para aquele campo — em vez do fluxo atual que força ModalA → ModalB.

**Architecture:** Front `admin.html` (JS vanilla). Cada linha editável do `order-info-grid` ganha um botão-ícone Bootstrap (`bi-*`). Ao clicar, abre `modalCampo(p, nomeCampo)` — orquestrador que delega para um modal por tipo de campo. Todos os modais usam um `estado` (`est`) compartilhado e o helper `montarPayload(est)` para montar o mesmo shape do PATCH atual. O tipo de entrega é caso especial: ao escolher `delivery`, revela bloco de endereço (rua, número, bairro, cep, referência) e calcula taxa via `recalcularTotais`. Persistência reusa `PATCH /api/pedidos/:id/editar`; backend `processarEdicaoPedido` passa a gravar os 4 campos de endereço, com preservação (não sobrescreve endereço se campo ausente).

**Tech Stack:** HTML + JS vanilla (admin.html), Bootstrap Icons (CDN), Express + Prisma (backend), Vitest (testes).

## Global Constraints

- Ícones via Bootstrap Icons CDN: `https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css`.
- Regra de edição: **somente** status `producao` (mesma regra do botão atual `admin.html:291`).
- `tipoEntrega` valores: `delivery` (entrega, taxa) e qualquer outro (`retirada`, `balcao`) = retirada/balcão.
- Retirada/balcão: **sem** endereço (bloco oculto). Ao trocar p/ `delivery`: mostrar rua, número, bairro (obrigatório p/ taxa), cep, referência.
- Taxa entrega delivery via `bairrosAtendidos[].taxa` (`calcularTaxaEntrega`, admin.html:448). Taxa cartão: crédito +6%, débito +3% sobre subtotal (admin.html:442-446).
- `PATCH /api/pedidos/:id/editar` exige `total` e `itens` no body (orderController.js:65) — mantido; front sempre envia lista completa de itens + total recalculado via `montarPayload`.
- Backend `processarEdicaoPedido`: campos de endereço gravados **somente** quando string não-vazia passada; `undefined`/`''` → preserva valor existente.
- Código e commits em português conforme repositório.

---

### Task 1: Backend — persistir endereço (rua, número, cep, referência) ao editar pedido

**Files:**
- Modify: `backend/src/services/orderService.js:175-184`
- Test: `backend/tests/orderService.test.js`

**Interfaces:**
- Consumes: `processarEdicaoPedido(pedido, data, buscarProdutoFn)` — `data.itens` lista completa, `data.total` string.
- Produces: `updates` com campos adicionais `clienteEndereco`, `clienteNumero`, `clienteCep`, `clienteReferencia` (apenas quando string não-vazia).
- Rota/controller: inalterados (controller repassa `req.body` inteiro via `editarPedido(req.params.id, req.body)` — orderController.js:66; rota `PATCH /:id/editar` já aceita qualquer body).

---

- [ ] **Step 1: Write the failing test — endereço gravado no updates**

Adicione ao final de `backend/tests/orderService.test.js` (dentro do `describe` já existente):

```js
it('grava endereco/numero/cep/referencia quando fornecidos', async () => {
  const data = {
    formaPagamento: 'credito',
    tipoEntrega: 'delivery',
    bairro: 'Centro',
    endereco: 'Rua A',
    numero: '123',
    cep: '12345678',
    referencia: 'Perto da praça',
    taxasEntrega: 7,
    taxasCartao: 2.22,
    desconto: 0,
    total: '39.22',
    troco: 0,
    itens: pedido.itens,
    itensRemovidos: [],
  };
  const result = await processarEdicaoPedido(pedido, data);
  expect(result.updates).toMatchObject({
    clienteBairro: 'Centro',
    clienteEndereco: 'Rua A',
    clienteNumero: '123',
    clienteCep: '12345678',
    clienteReferencia: 'Perto da praça',
    tipoEntrega: 'delivery',
  });
});

it('preserva endereco existente quando campo ausente no data', async () => {
  const pedidoBairro = { ...pedido, clienteBairro: 'Centro', clienteEndereco: 'Rua Velha' };
  const data = {
    formaPagamento: 'pix',
    tipoEntrega: 'retirada',
    taxasEntrega: 0,
    taxasCartao: 0,
    desconto: 0,
    total: '30.00',
    troco: null,
    itens: pedido.itens,
    itensRemovidos: [],
  };
  const result = await processarEdicaoPedido(pedidoBairro, data);
  // sem bairro/endereco no data -> NAO aparece no updates (preserva banco)
  expect('clienteBairro' in result.updates).toBe(false);
  expect('clienteEndereco' in result.updates).toBe(false);
});
```

- [ ] **Step 2: Rodar teste — verificar falha**

Run: `cd backend && npx vitest run tests/orderService.test.js`
Expected: FAIL — `clienteEndereco`/`clienteBairro` ausentes em `updates`.

- [ ] **Step 3: Implementar — estender `updates`**

No `processarEdicaoPedido`, substitua o bloco `const updates = { ... };` (linhas 175-184) por:

```js
  const updates = {
    formaPagamento: data.formaPagamento,
    tipoEntrega: data.tipoEntrega,
    taxasEntrega: Number(data.taxasEntrega ?? 0),
    taxasCartao: Number(data.taxasCartao ?? 0),
    desconto: Number(data.desconto ?? 0),
    total: String(data.total ?? '0'),
    troco: Number(data.troco ?? 0),
  };

  // Endereço de entrega: grava apenas quando string não-vazia fornecida;
  // undefined/null/'' => preserva o valor existente no pedido.
  const camposEndereco = [
    ['bairro', 'clienteBairro'],
    ['endereco', 'clienteEndereco'],
    ['numero', 'clienteNumero'],
    ['cep', 'clienteCep'],
    ['referencia', 'clienteReferencia'],
  ];
  for (const [srcKey, destKey] of camposEndereco) {
    const val = data[srcKey];
    if (val !== undefined && val !== null && String(val) !== '') {
      updates[destKey] = String(val);
    }
  }
```

- [ ] **Step 4: Rodar todos testes do service**

Run: `cd backend && npx vitest run tests/orderService.test.js`
Expected: PASS — 9/9 (7 originais + 2 novos). Testes antigos seguem passando: o 1º (admin.html legacy) usa `bairro: ''` → string vazia excluída, sem `clienteBairro` no updates — nenhum teste antigo asserta `clienteBairro`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/orderService.js backend/tests/orderService.test.js
git commit -m "feat: persistir endereco de entrega ao editar pedido"
```

---

### Task 2: Front — ícones Bootstrap 5 por campo + overlay isolado

**Files:**
- Modify: `admin.html` (head link, helpers `optsBairros`, `renderCard` info-grid + handler, novos modais `modalCampo`, `modalCampoSimples`, `modalCampoTexto`, `modalEntrega`, `montarPayload`)

**Interfaces:**
- Consumes: `renderCard(p, docId)` (admin.html:240), shape do pedido formatado pelo controller (`cliente.endereco/numero/bairro/pontoReferencia`, `cep`, `formaPagamento`, `troco`, `valores`, `itens`).
- Produces: `modalCampo(p, nomeCampo)` → Promise(payload | null). `montarPayload(est)` → objeto compatível com `PATCH /api/pedidos/:id/editar`.
- `optsBairros(est)` — extraída do fechamento de `modalEditarValores` (admin.html:648) para função standalone reutilizável.

---

- [ ] **Step 1: Adicionar Bootstrap Icons ao head** (`admin.html`)

Após a linha 7 (CDN font-awesome), adicione:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
```

- [ ] **Step 2: Extrair `optsBairros` p/ função standalone**

Substitua a função aninhada `optsBairros()` dentro de `modalEditarValores` (admin.html:648-657) por uma função de escopo global (defina antes de `modalEditarValores`, após `recalcularTotais`):

```js
function optsBairros(est) {
  var bairrosAtendidos = est.bairrosAtendidos || [];
  var sel = est.bairro || '';
  var matchFound = bairrosAtendidos.some(function(b) { return b.nome.toLowerCase() === String(sel).toLowerCase(); });
  var html = bairrosAtendidos.map(function(b) {
    var selected = (b.nome.toLowerCase() === String(sel).toLowerCase()) ? ' selected' : '';
    return '<option value="' + b.nome + '"' + selected + '>' + b.nome + ' (R$ ' + Number(b.taxa).toFixed(2) + ')</option>';
  }).join('');
  if (!matchFound && sel) html = '<option value="' + sel + '" selected>' + sel + ' (sem taxa)</option>' + html;
  return html;
}
```

Em `modalEditarValores`, troque a chamada interna `optsBairros()` (linha 655, dentro do template string do `#valBairro`) por `optsBairros(estado)` e **delete** a função aninhada (linhas 648-657). O comportamento é idêntico (`estado` já tem `bairrosAtendidos` setado na linha 618).

- [ ] **Step 3: Renderizar ícones editáveis no info-grid** do `renderCard`

Em `renderCard`, antes de `card.innerHTML` (linha 254), defina:

```js
  const editavel = p.status === 'producao';
  const iconeCampo = (icone, titulo, campo) => editavel
    ? ' <button type="button" class="field-edit" data-campo="' + campo + '" title="' + titulo + '" style="border:none;background:none;color:var(--primary);cursor:pointer;padding:0;font-size:14px;"><i class="bi ' + icone + '"></i></button>'
    : '';
```

Troque o bloco do `.order-info-grid` (linhas 268-280) por:

```js
        <div class="info-item"><strong>Endereço</strong>${p.cliente?.endereco || '-'}, ${p.cliente?.numero || '-'}${iconeCampo('bi-geo-alt', 'Editar endereço', 'endereco')}</div>
        <div class="info-item"><strong>Bairro</strong>${p.cliente?.bairro || '-'}${iconeCampo('bi-signpost', 'Editar bairro', 'bairro')}</div>
        <div class="info-item"><strong>CEP</strong>${p.cep || '-'}${iconeCampo('bi-mailbox', 'Editar CEP', 'cep')}</div>
        <div class="info-item"><strong>Ref</strong>${p.cliente?.pontoReferencia || '-'}${iconeCampo('bi-pin-map', 'Editar referência', 'referencia')}</div>
        <div class="info-item"><strong>Pagamento</strong>${p.formaPagamento || '-'}${iconeCampo('bi-credit-card', 'Editar pagamento', 'pagamento')}</div>
        <div class="info-item"><strong>Troco</strong>${p.troco ? fmtMoeda(p.troco) : '-'}${iconeCampo('bi-cash-coin', 'Editar troco', 'troco')}</div>
        <div class="info-item"><strong>Desconto</strong>${fmtMoeda(p.valores?.desconto)}${iconeCampo('bi-percent', 'Editar desconto', 'desconto')}</div>
        <div class="info-item"><strong>Entrega</strong>${p.tipoEntrega || '-'}${iconeCampo('bi-truck', 'Editar tipo de entrega', 'entrega')}</div>
```

> Nota: botões `.field-edit` são `display:inline` — ficam ao lado do texto. Não alteram layout dos `.info-item`.

- [ ] **Step 4: Handler de clique nos ícones** — junto ao botão editar (linha 373-375)

Substitua:

```js
  if (p.status === 'producao') {
    card.querySelector('[data-action="editar"]').onclick = () => abrirFluxoEdicao(p);
  }
```

por:

```js
  if (p.status === 'producao') {
    card.querySelector('[data-action="editar"]').onclick = () => abrirFluxoEdicao(p);
    card.querySelectorAll('[data-campo]').forEach(function(btn) {
      btn.onclick = function() {
        modalCampo(p, btn.dataset.campo).then(function(payload) {
          if (!payload) return;
          api('/pedidos/' + p.id + '/editar', { method: 'PATCH', body: JSON.stringify(payload) })
            .then(function() { toast('✅ Campo atualizado!', 'success'); carregarPedidos(); })
            .catch(function(e) { toast('Erro ao salvar: ' + e.message, 'danger'); });
        });
      };
    });
  }
```

- [ ] **Step 5: Implementar `montarPayload(est)` + `modalCampo(p, nomeCampo)`**

Adicione após `abrirFluxoEdicao` (admin.html:749):

```js
function montarPayload(est) {
  formularioControles(est); // garante totais atualizados
  return {
    formaPagamento: est.formaPagamento,
    tipoEntrega: est.tipoEntrega,
    bairro: est.bairro,
    endereco: est.endereco,
    numero: est.numero,
    cep: est.cep,
    referencia: est.referencia,
    taxasEntrega: est.taxaEntrega,
    taxasCartao: est.taxaCartao,
    desconto: Number(est.desconto || 0),
    total: String(est.total),
    troco: Number(est.troco || 0),
    itens: est.itens.map(function(i) {
      return { produtoId: Number(i.produtoId), quantidade: Number(i.quantidade), precoUnitario: String(i.precoUnitario), sabores: i.sabores || null };
    }),
  };
}

function formularioControles(est) {
  var totais = recalcularTotais(est);
  est.taxaEntrega = totais.taxaEntrega;
  est.taxaCartao = totais.taxaCartao;
  est.total = totais.total;
  return totais;
}

async function modalCampo(p, nomeCampo) {
  var bairrosAtendidos = [];
  try {
    var cfg = await api('/loja/settings-admin');
    if (cfg && Array.isArray(cfg.bairrosAtendidos)) bairrosAtendidos = cfg.bairrosAtendidos;
  } catch(e) { console.warn('settings-admin falhou', e); }

  var est = {
    itens: (p.itens || []).map(function(i) {
      return { produtoId: Number(i.produtoId), quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario), sabores: i.sabores || null };
    }),
    formaPagamento: p.formaPagamento || 'dinheiro',
    tipoEntrega: p.tipoEntrega || 'retirada',
    bairro: p.cliente?.bairro || '',
    endereco: p.cliente?.endereco || '',
    numero: p.cliente?.numero || '',
    cep: p.cep || '',
    referencia: p.cliente?.pontoReferencia || '',
    desconto: Number(p.valores?.desconto || 0),
    troco: Number(p.troco || 0),
    bairrosAtendidos: bairrosAtendidos,
  };

  switch (nomeCampo) {
    case 'entrega':    return modalEntrega(p, est);
    case 'pagamento':  return modalCampoSimples(p, est, 'pagamento');
    case 'troco':      return modalCampoSimples(p, est, 'troco');
    case 'desconto':   return modalCampoSimples(p, est, 'desconto');
    case 'bairro':     return modalCampoSimples(p, est, 'bairro');
    case 'cep':        return modalCampoTexto(p, est, 'cep', 'CEP');
    case 'referencia': return modalCampoTexto(p, est, 'referencia', 'Ponto de referência');
    case 'endereco':   return modalEndereco(p, est);
    default: return Promise.resolve(null);
  }
}
```

- [ ] **Step 6: Implementar `modalCampoSimples` — select/input de campo único**

```js
function modalCampoSimples(p, est, campo) {
  return new Promise(function(resolve) {
    var titulos = { pagamento: 'Forma de Pagamento', troco: 'Troco para (R$)', desconto: 'Desconto (R$)', bairro: 'Bairro' };
    var corpo = '';
    if (campo === 'pagamento') {
      corpo =
        '<select id="fcVal" style="width:100%;padding:6px;">' +
          '<option value="dinheiro">Dinheiro</option>' +
          '<option value="pix">PIX</option>' +
          '<option value="debito">Débito</option>' +
          '<option value="credito">Crédito</option>' +
        '</select>';
    } else if (campo === 'bairro') {
      corpo = '<select id="fcVal" style="width:100%;padding:6px;">' + optsBairros(est) + '</select>';
    } else {
      corpo = '<input type="number" id="fcVal" min="0" step="0.01" value="' +
        (campo === 'troco' ? Number(est.troco || 0).toFixed(2) : Number(est.desconto || 0).toFixed(2)) +
        '" style="width:100%;padding:6px;">';
    }

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:400px;">' +
        '<h3>Editar ' + titulos[campo] + ' — #' + p.id + '</h3>' +
        '<div style="margin-top:12px;">' + corpo + '</div>' +
        '<div style="margin-top:8px;font-size:13px;">Total atualizado: <strong>R$ <span id="fcTotal"></span></strong></div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="fcCancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="fcSave">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var elVal = overlay.querySelector('#fcVal');
    if (campo === 'pagamento') elVal.value = est.formaPagamento;

    function refresh() {
      formularioControles(est);
      overlay.querySelector('#fcTotal').textContent = 'R$ ' + est.total.toFixed(2);
    }
    elVal.onchange = function() {
      if (campo === 'pagamento') est.formaPagamento = this.value;
      else if (campo === 'bairro') est.bairro = this.value;
      else if (campo === 'troco') est.troco = Number(this.value) || 0;
      else if (campo === 'desconto') est.desconto = Number(this.value) || 0;
      refresh();
    };
    refresh();

    overlay.querySelector('#fcSave').onclick = function() {
      if (campo === 'pagamento') est.formaPagamento = elVal.value;
      else if (campo === 'bairro') est.bairro = elVal.value;
      else if (campo === 'troco') est.troco = Number(elVal.value) || 0;
      else if (campo === 'desconto') est.desconto = Number(elVal.value) || 0;
      overlay.remove();
      resolve(montarPayload(est));
    };
    overlay.querySelector('#fcCancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}
```

- [ ] **Step 7: Implementar `modalCampoTexto` — um input de texto (CEP, referência)**

```js
function modalCampoTexto(p, est, campo, rotulo) {
  return new Promise(function(resolve) {
    var valAtual = campo === 'cep' ? (est.cep || '') : (est.referencia || '');
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:400px;">' +
        '<h3>Editar ' + rotulo + ' — #' + p.id + '</h3>' +
        '<div style="margin-top:12px;"><input type="text" id="fcVal" value="' + escapeHtml(valAtual) + '" style="width:100%;padding:6px;"></div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="fcCancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="fcSave">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#fcSave').onclick = function() {
      var v = overlay.querySelector('#fcVal').value.trim();
      if (campo === 'cep') est.cep = v;
      else est.referencia = v;
      overlay.remove();
      resolve(montarPayload(est));
    };
    overlay.querySelector('#fcCancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}
```

- [ ] **Step 8: Implementar `modalEndereco` — rua + número**

```js
function modalEndereco(p, est) {
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="max-width:400px;">' +
        '<h3>Editar Endereço — #' + p.id + '</h3>' +
        '<div style="margin-top:12px;">' +
          '<div><label style="font-size:12px;display:block;margin-bottom:4px;">Endereço (rua)</label>' +
          '<input type="text" id="enRua" value="' + escapeHtml(est.endereco || '') + '" style="width:100%;padding:6px;"></div>' +
          '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Número</label>' +
          '<input type="text" id="enNum" value="' + escapeHtml(est.numero || '') + '" style="width:100%;padding:6px;"></div>' +
        '</div>' +
        '<div class="modal-actions" style="margin-top:16px;">' +
          '<button class="btn btn-modal-cancel" id="enCancel">Cancelar</button>' +
          '<button class="btn btn-pronto" id="enSave">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#enSave').onclick = function() {
      est.endereco = overlay.querySelector('#enRua').value.trim();
      est.numero = overlay.querySelector('#enNum').value.trim();
      overlay.remove();
      resolve(montarPayload(est));
    };
    overlay.querySelector('#enCancel').onclick = function() { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}
```

- [ ] **Step 9: Implementar `modalEntrega` — tipo de entrega + endereço (requisito #4)**

Caso especial: trocar p/ `delivery` revela rua, número, bairro (obrigatório p/ taxa), cep, referência.

```js
function modalEntrega(p, est) {
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    function build() {
      var isDel = est.tipoEntrega === 'delivery';
      overlay.innerHTML =
        '<div class="modal-box" style="max-width:520px;">' +
          '<h3>Editar Entrega — #' + p.id + '</h3>' +
          '<div style="margin-top:12px;">' +
            '<label style="font-size:12px;display:block;margin-bottom:4px;">Tipo de Entrega</label>' +
            '<div style="display:flex;gap:8px;">' +
              '<label style="flex:1;"><input type="radio" name="enTipo" value="retirada"' + (isDel ? '' : ' checked') + '> Retirada</label>' +
              '<label style="flex:1;"><input type="radio" name="enTipo" value="delivery"' + (isDel ? ' checked' : '') + '> Delivery</label>' +
            '</div>' +
            '<div id="blocoEntrega" style="margin-top:12px;' + (isDel ? '' : 'display:none;') + '">' +
              '<div style="display:flex;gap:8px;">' +
                '<div style="flex:3;"><label style="font-size:12px;display:block;margin-bottom:4px;">Endereço (rua)</label>' +
                '<input type="text" id="enRua" value="' + escapeHtml(est.endereco || '') + '" style="width:100%;padding:6px;"></div>' +
                '<div style="flex:1;"><label style="font-size:12px;display:block;margin-bottom:4px;">Número</label>' +
                '<input type="text" id="enNum" value="' + escapeHtml(est.numero || '') + '" style="width:100%;padding:6px;"></div>' +
              '</div>' +
              '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Bairro (taxa de entrega)</label>' +
              '<select id="enBairro" style="width:100%;padding:6px;">' + optsBairros(est) + '</select></div>' +
              '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">CEP</label>' +
              '<input type="text" id="enCep" value="' + escapeHtml(est.cep || '') + '" style="width:100%;padding:6px;"></div>' +
              '<div style="margin-top:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Referência</label>' +
              '<input type="text" id="enRef" value="' + escapeHtml(est.referencia || '') + '" style="width:100%;padding:6px;"></div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:12px;padding:10px;background:var(--secondary);border-radius:8px;">' +
            '<div style="display:flex;justify-content:space-between;"><span>Taxa entrega:</span><span>R$ <span id="enTaxa"></span></span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span>Taxa cartão:</span><span>R$ <span id="enCartao"></span></span></div>' +
            '<div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:4px;border-top:1px solid var(--border);padding-top:4px;"><span>Total:</span><span>R$ <span id="enTotal"></span></span></div>' +
          '</div>' +
          '<div class="modal-actions" style="margin-top:16px;">' +
            '<button class="btn btn-modal-cancel" id="enCancel">Cancelar</button>' +
            '<button class="btn btn-pronto" id="enSave">Salvar</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      function atualizaRecap() {
        est.endereco = overlay.querySelector('#enRua') ? overlay.querySelector('#enRua').value.trim() : est.endereco;
        est.numero = overlay.querySelector('#enNum') ? overlay.querySelector('#enNum').value.trim() : est.numero;
        est.bairro = overlay.querySelector('#enBairro') ? overlay.querySelector('#enBairro').value : est.bairro;
        est.cep = overlay.querySelector('#enCep') ? overlay.querySelector('#enCep').value.trim() : est.cep;
        est.referencia = overlay.querySelector('#enRef') ? overlay.querySelector('#enRef').value.trim() : est.referencia;
        var t = formularioControles(est);
        overlay.querySelector('#enTaxa').textContent = 'R$ ' + t.taxaEntrega.toFixed(2);
        overlay.querySelector('#enCartao').textContent = 'R$ ' + t.taxaCartao.toFixed(2);
        overlay.querySelector('#enTotal').textContent = 'R$ ' + t.total.toFixed(2);
      }

      overlay.querySelectorAll('input[name="enTipo"]').forEach(function(r) {
        r.onchange = function() {
          est.tipoEntrega = r.value;
          overlay.querySelector('#blocoEntrega').style.display = r.value === 'delivery' ? '' : 'none';
          atualizaRecap();
        };
      });
      overlay.querySelector('#enBairro').onchange = function() { atualizaRecap(); };
      overlay.querySelector('#enRua').oninput = function() { atualizaRecap(); };
      overlay.querySelector('#enNum').oninput = function() { atualizaRecap(); };
      overlay.querySelector('#enCep').oninput = function() { atualizaRecap(); };
      overlay.querySelector('#enRef').oninput = function() { atualizaRecap(); };
      atualizaRecap();

      overlay.querySelector('#enSave').onclick = function() {
        atualizaRecap();
        overlay.remove();
        resolve(montarPayload(est));
      };
      overlay.querySelector('#enCancel').onclick = function() { overlay.remove(); resolve(null); };
      overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    }
    build();
  });
}
```

> Edge: `recalcularTotais` (admin.html:457) já trata `tipoEntrega !== 'delivery'` → taxaEntrega 0; `bairro` vazio + delivery → taxa 0 (bairro pendente). Sem quebra.

- [ ] **Step 10: Verificação manual (browser MCP)**

Backend na porta 3000 + vite 5173. Admin logado (djesus/tsa110594). Testar em pedido `producao`:
- Ícones `bi-*` presentes em Endereço, Bairro, CEP, Ref, Pagamento, Troco, Desconto, Entrega.
- Ícone Entrega → modal só de entrega → trocar `retirada`→`delivery` → bloco endereço aparece → preencher rua/número/bairro/cep/ref → taxa entrega + total recalculam → salvar → PATCH 200 → card recarrega com endereço novo.
- Ícone Pagamento → trocar crédito → taxa cartão recalcula → salvar → PATCH 200.
- Ícone Desconto → valor → total recalcula.
- Retirada/balcão: sem botão "Em Rota" (regressão).

- [ ] **Step 11: Commit**

```bash
git add admin.html
git commit -m "feat(admin): edicao isolada de campos pedido com icones bootstrap"
```

---

## Self-Review

**1. Cobertura spec:**
- Bug 1 (pagamento separado) → Task 2, ícone Pagamento (`bi-credit-card`) → `modalCampoSimples('pagamento')`. ✅
- Bug 2 (endereço ao trocar retirada→delivery) → `modalEntrega` bloco delivery (Step 9) + Task 1 backend. ✅
- Ícone próprio por campo (Bootstrap 5) → Step 3 `iconeCampo` com `bi-*`. ✅
- Backend autorizado → Task 1 (`orderService.js`). ✅
- Endereço visível só delivery + bairro p/ taxa → `modalEntrega` (`isDel` toggles `#blocoEntrega`). ✅

**2. Placeholder scan:** Sem TBD/TODO. Todas as funções têm código completo executável. ✅

**3. Type/contrato consistência:** `montarPayload(est)` produz shape esperado pelo controller (`{ formaPagamento, tipoEntrega, bairro, endereco, numero, cep, referencia, taxasEntrega, taxasCartao, desconto, total, troco, itens[] }`). `modalCampo` retorna Promise(payload|null). `data-campo` valores: `endereco|bairro|cep|referencia|pagamento|troco|desconto|entrega`. Backend mapeia `bairro→clienteBairro`, `endereco→clienteEndereco`, `numero→clienteNumero`, `cep→clienteCep`, `referencia→clienteReferencia`. `optsBairros(est)` standalone usada em `modalCampoSimples` e `modalEntrega`. `recalcularTotais`/`calcularTaxaCartao`/`calcularTaxaEntrega` existentes inalterados. ✅
