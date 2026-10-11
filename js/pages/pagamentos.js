// js/pages/pagamentos.js — módulo SPA (receita Task6)
const HTML_PAGAMENTOS = `<body>
<div class="pg-wrap">

  <div class="pg-top">
    <span class="pg-brand" id="pgBrand">Loja</span>
    <h2>Pagamentos</h2>
    <span class="pg-flag" id="pgTipo"></span>
    <span class="pg-spacer"></span>
  </div>

  <div class="pg-tabs" id="pagamentosTabs" role="tablist">
    <button type="button" data-tab="mensalidade" role="tab" aria-selected="true">Mensalidade</button>
    <button type="button" data-tab="extrato" role="tab" aria-selected="false">Extrato</button>
    <button type="button" data-tab="receber" role="tab" aria-selected="false">Receber e recebimentos</button>
  </div>

  <!-- ══════════ ABA: MENSALIDADE (matriz/independente) ══════════ -->
  <section id="mensalidadeSection">
    <div class="pg-hero">
      <div>
        <span class="pg-eyebrow">Mensalidade · ciclo mensal</span>
        <h1 class="pg-month" id="invoiceMonth">—</h1>
        <dl class="pg-breakdown">
          <div><dt>Base</dt><dd id="invoiceBase">—</dd></div>
          <div><dt>Filiais cadastradas</dt><dd id="invoiceFilial">—</dd></div>
          <div id="rowJuros" class="hidden alert"><dt>Juros <span class="qty">1% ao dia</span></dt><dd id="invoiceJuros">—</dd></div>
        </dl>
        <p class="pg-cycle">A fatura abre todo dia <b>1</b> e vence dia <b>10</b>.<br>Juros de <b>1%</b> por dia a partir do dia <b>11</b> · leitura limitada em <b>5</b> dias · bloqueio em <b>10</b>.</p>
      </div>
      <div class="pg-due">
        <span class="lbl">Total da fatura</span>
        <p class="pg-amount" id="invoiceTotal">—</p>
        <p class="note" id="invoiceNote">—</p>
        <p class="pg-meta">Vence em <b id="invoiceDue">—</b> · <span id="invoiceStatus">—</span></p>
      </div>
    </div>

    <div class="pg-actions">
      <button class="pg-btn primary" id="btnPay" disabled>Gerar PIX</button>
      <span class="pg-hint" id="payHint"></span>
    </div>

    <div class="pg-pix hidden" id="pixBox">
      <div class="pg-pix-code">
        <span class="lbl">Código PIX copia e cola</span>
        <div class="row">
          <input id="pixCode" readonly aria-label="Código PIX copia e cola">
          <button class="pg-btn quiet" id="btnCopyPix" type="button">Copiar</button>
        </div>
      </div>
      <img id="pixQr" alt="QR Code do PIX" width="140" height="140">
    </div>

    <div class="pg-receipt hidden" id="receiptRow">
      <span class="txt">Pago em <b id="receiptDate">—</b> · comprovante gerado pelo backend</span>
      <button class="pg-link" id="btnReceipt" type="button">Baixar comprovante (PDF)</button>
    </div>
  </section>

  <!-- ══════════ ABA: EXTRATO (matriz e filial) ══════════ -->
  <section id="vExtrato" class="hidden">
    <div class="pg-filter">
      <span class="cap">Mês</span>
      <div class="pg-chips" id="monthChips"></div>
    </div>

    <div id="extratoMens">
      <span class="pg-eyebrow">Mensalidade do mês</span>
      <div class="pg-mblock">
        <div class="head">
          <div class="t" id="emTitle">—</div>
          <div class="big" id="emTotal">—</div>
        </div>
        <div class="rows">
          <div><dt>Base</dt><dd id="emBase">—</dd></div>
          <div id="emFilRow"><dt>Filiais cadastradas</dt><dd id="emFil">—</dd></div>
          <div><dt>Juros</dt><dd id="emJuros">—</dd></div>
          <div><dt>Situação</dt><dd><span class="pg-tag mute" id="emStatus">—</span></dd></div>
          <div><dt>Pago em</dt><dd id="emPaid">—</dd></div>
          <div id="emReceiptRow" class="hidden"><dt>Comprovante</dt><dd><button class="pg-link" id="emReceipt" type="button" data-url="">Baixar comprovante (PDF)</button></dd></div>
        </div>
      </div>
    </div>

    <span class="pg-eyebrow">Recebido no mês</span>
    <div class="pg-week">
      <div><div class="k">Período</div><div class="v" id="rcPeriod">—</div><div class="sub" id="rcWeeks">—</div></div>
      <div><div class="k">Semanas repassadas</div><div class="v" id="rcWeeks2">—</div><div class="sub">valores por semana abaixo</div></div>
    </div>

    <table class="pg-ledger">
      <caption>Valores semanais</caption>
      <thead><tr><th>Semana</th><th class="num">Pedidos</th><th class="num">Bruto</th><th class="num">Líquido</th><th class="num">Pago em</th><th>Situação</th></tr></thead>
      <tbody id="rcRows"></tbody>
    </table>

    <div id="extratoFilialNote" class="pg-banner hidden">
      <span class="rule"></span>
      <p>A mensalidade desta loja é paga pela <b>matriz</b>. O extrato mostra apenas o que você <b>recebeu</b>.</p>
    </div>
  </section>

  <!-- ══════════ ABA: RECEBER E RECEBIMENTOS ══════════ -->
  <section id="vReceber" class="hidden">
    <div class="pg-cols">
      <section>
        <h3 class="pg-panel-title">Receber pagamentos</h3>
        <p class="pg-sub">A chave PIX que recebe os pedidos da loja.</p>

        <div class="pg-status pending" id="pixStatus">
          <span class="dot"></span>
          <span class="txt" id="pixStatusText">Carregando…</span>
        </div>

        <div class="pg-field"><span class="lbl">E-mail</span><input type="email" id="payEmail" aria-label="E-mail" placeholder="email@exemplo.com"></div>
        <div class="pg-field"><span class="lbl">CPF / CNPJ</span><input type="text" id="payCpfCnpj" aria-label="CPF ou CNPJ" placeholder="000.000.000-00" maxlength="18"></div>
        <div class="pg-field"><span class="lbl">Tipo da chave</span>
          <select id="payPixKeyType" aria-label="Tipo da chave PIX">
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
            <option value="email">E-mail</option>
            <option value="phone">Telefone</option>
            <option value="random">Aleatória</option>
          </select>
        </div>
        <div class="pg-field"><span class="lbl">Chave PIX</span><input type="text" id="payPixKey" aria-label="Chave PIX" placeholder="Sua chave PIX"></div>

        <p class="pg-error hidden" id="payment-error"></p>

        <div class="pg-actions">
          <button class="pg-btn quiet" id="btnAtivarPayment" type="button">Ativar pagamentos</button>
          <button class="pg-btn quiet hidden" id="btnAtualizarPayment" type="button">Atualizar chave</button>
          <button class="pg-btn danger hidden" id="btnDesativarPayment" type="button">Desativar recebimento</button>
        </div>
      </section>

      <section>
        <h3 class="pg-panel-title">Recebimentos</h3>
        <p class="pg-sub">Repasse do que a loja vendeu, por semana.</p>

        <div class="pg-week">
          <div><div class="k">Semana atual</div><div class="v" id="wkPeriod">—</div><div class="sub" id="wkPedidos">—</div></div>
          <div><div class="k">Líquido</div><div class="v" id="wkLiquido">—</div><div class="sub"><span id="wkStatus">—</span> · <span id="wkPaid">—</span></div></div>
        </div>

        <table class="pg-ledger">
          <thead><tr><th>Semana</th><th class="num">Pedidos</th><th class="num">Bruto</th><th class="num">Líquido</th><th class="num">Pago em</th><th>Situação</th></tr></thead>
          <tbody id="receberRows"></tbody>
        </table>
      </section>
    </div>
  </section>

</div>

</body>
`;
let _abort = null;
const _cleanups = [];

export  function mount(container, params) {
  unmount();
  _abort = new AbortController();
  _cleanups.push(pageCss('css/pagamentos-page.css', 'pagamentos'));
  container.innerHTML = HTML_PAGAMENTOS;
  (function () {
  var au = {};
  try { au = JSON.parse(localStorage.getItem('authUser') || '{}'); } catch (e) { au = {}; }
  var isFilial = au.empresaTipo === 'filial';
  // superadmin não usa esta página (spec §4)
  if (au.role === 'superadmin') { goTo('superadmin'); return; }

  var fmtBRL = function (v) {
    if (window.fmtMoeda) return window.fmtMoeda(v);
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  };
  var fmtDate = function (iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  };
  var mesOf = function (iso) {
    return String(iso || '').slice(0, 7);
  };
  var api = function (path, opts) {
    if (typeof showLoading === 'function') showLoading();
    var token = (typeof safeGetToken === 'function') ? safeGetToken() : (au.token || '');
    var base = window.getApiBase ? window.getApiBase() : '';
    return authFetch(base + '/api' + path, Object.assign({}, opts, {
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        (opts && opts.headers) || {}
      ),
    })).then(function (r) {
      return r.json().then(function (b) {
        if (!r.ok) {
          var err = new Error(b.error || ('Erro ' + r.status));
          err.status = r.status;
          err.payload = b;
          throw err;
        }
        return b;
      });
    }).finally(function () {
      if (typeof hideLoading === 'function') hideLoading();
    });
  };
  var getToken = function () {
    return (typeof safeGetToken === 'function') ? safeGetToken() : (au.token || '');
  };

  function el(id) { return document.getElementById(id); }

  var REASON_TEXT = {
    mes_pago: 'Esta fatura já foi paga. A próxima abre no dia 1 do mês seguinte.',
    ciclo_fechado: 'A fatura ainda não abriu. Ela é liberada todo dia 1.',
    trial: 'Você está no período de teste. A primeira fatura abre no dia 1 do mês seguinte ao cadastro.',
    sem_fatura: 'Nenhuma fatura em aberto agora.',
  };

  var state = { status: null, payments: [], weeks: [], mesSel: null };

  /* ── Mensalidade ─────────────────────────────────────────── */
  function renderInvoice(p) {
    if (!p || p.aplicavel === false) {
      var sec = el('mensalidadeSection');
      if (sec) sec.classList.add('hidden');
      return;
    }
    state.status = p;
    var b = p.breakdown || {};

    el('invoiceMonth').textContent = p.mesRef || '—';
    el('invoiceTotal').textContent = fmtBRL(p.totalDue);
    el('invoiceTotal').classList.toggle('is-overdue', !!p.hasInterest);
    el('invoiceBase').textContent = fmtBRL(b.base);
    el('invoiceFilial').textContent = (b.nFiliais || 0) + ' × ' + fmtBRL(b.valorPorFilial) + ' · ' + fmtBRL(b.filialTotal);
    el('invoiceDue').textContent = fmtDate(p.dueDate);
    el('invoiceStatus').textContent = p.paidAt
      ? 'Paga em ' + fmtDate(p.paidAt)
      : (p.canPay ? 'Aberta' : (p.canPayReason === 'mes_pago' ? 'Paga' : 'Fechada'));

    var hasInterest = !!p.hasInterest;
    el('rowJuros').classList.toggle('hidden', !hasInterest);
    el('rowJuros').classList.toggle('alert', hasInterest);
    if (hasInterest) {
      el('invoiceJuros').textContent = fmtBRL(p.interest);
      el('invoiceNote').textContent = p.daysOverdue + ' dias de atraso · juros de ' + fmtBRL(p.interest);
    } else {
      el('invoiceNote').textContent = 'Vence em ' + fmtDate(p.dueDate);
    }

    el('btnPay').disabled = !p.canPay;
    el('btnPay').textContent = p.canPay
      ? ('Gerar PIX e pagar ' + fmtBRL(p.totalDue))
      : 'Próxima fatura abre no dia 1';
    el('payHint').textContent = p.canPay
      ? 'PIX gerado vale 7 dias.'
      : (REASON_TEXT[p.canPayReason] || '');

    var paid = !!p.paidAt;
    el('receiptRow').classList.toggle('hidden', !paid);
    if (paid) el('receiptDate').textContent = fmtDate(p.paidAt);

    // status pode chegar depois de payments/weeks (race) → refaz chips do filtro
    renderChips();
  }

  function gerarPix() {
    var btn = el('btnPay');
    btn.disabled = true;
    api('/empresa/subscription/pay', { method: 'POST', body: '{}' })
      .then(function (d) {
        el('pixBox').classList.remove('hidden');
        el('pixCode').value = d.pixCode || '';
        el('pixQr').src = d.pixQrCode ? ('data:image/png;base64,' + d.pixQrCode) : '';
        el('payHint').textContent = 'PIX da fatura ' + (d.mesRef || '') + ' gerado — vale 7 dias.';
      })
      .catch(function (e) {
        if (e.payload && e.payload.error === 'pagamento_nao_liberado') {
          var txt = REASON_TEXT[e.payload.reason] || 'Pagamento não liberado agora.';
          if (e.payload.cycleOpenAt) txt += ' Abre em ' + fmtDate(e.payload.cycleOpenAt) + '.';
          el('payHint').textContent = txt;
        } else {
          el('payHint').textContent = e.message || 'Erro ao gerar PIX.';
        }
      })
      .then(function () {
        btn.disabled = !(state.status && state.status.canPay);
      });
  }

  function baixarComprovante(url) {
    if (!url) return;
    if (typeof showLoading === 'function') showLoading();
    var base = window.getApiBase ? window.getApiBase() : '';
    authFetch(base + url)
      .then(function (r) {
        if (!r.ok) throw new Error('Comprovante indisponível');
        return r.blob();
      })
      .then(function (blob) {
        var u = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = u;
        a.download = 'comprovante.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      })
      .catch(function (e) {
        if (typeof toast === 'function') toast(e.message);
      })
      .finally(function () {
        if (typeof hideLoading === 'function') hideLoading();
      });
  }

  /* ── Extrato ─────────────────────────────────────────────── */
  function allMesRefs() {
    var out = [];
    var push = function (m) { if (m && out.indexOf(m) === -1) out.push(m); };
    if (state.status) push(state.status.mesRef);
    state.payments.forEach(function (r) { push(r.mesRef); });
    state.weeks.forEach(function (w) { push(mesOf(w.weekStart)); });
    out.sort();
    out.reverse();
    return out;
  }

  function renderChips() {
    var box = el('monthChips');
    if (!box) return;
    var months = allMesRefs();
    if (!months.length) return;
    if (!state.mesUser && state.status && months.indexOf(state.status.mesRef) !== -1) {
      state.mesSel = state.status.mesRef;
    }
    if (!state.mesSel || months.indexOf(state.mesSel) === -1) {
      state.mesSel = months[0];
    }
    box.innerHTML = months.map(function (m) {
      return '<button type="button" data-month="' + m + '" aria-pressed="' + (m === state.mesSel) + '">' + m + '</button>';
    }).join('');
    renderExtratoMes();
    renderWeeks();
  }

  function findPaymentRow(mes) {
    for (var i = 0; i < state.payments.length; i++) {
      if (state.payments[i].mesRef === mes) return state.payments[i];
    }
    return null;
  }

  function setExtratoBlock(o) {
    el('extratoMens').classList.remove('hidden');
    el('emTitle').innerHTML = o.title;
    el('emTotal').textContent = o.total;
    el('emBase').textContent = o.base;
    el('emFilRow').classList.toggle('hidden', !o.fil);
    if (o.fil) el('emFil').textContent = o.fil;
    el('emJuros').textContent = o.juros;
    el('emStatus').textContent = o.status;
    el('emStatus').className = 'pg-tag ' + o.statusCls;
    el('emPaid').textContent = o.paid;
    el('emReceiptRow').classList.toggle('hidden', !o.receiptUrl);
    if (o.receiptUrl) el('emReceipt').dataset.url = o.receiptUrl;
  }

  function renderExtratoMes() {
    var mes = state.mesSel;
    var row = findPaymentRow(mes);
    var s = state.status;
    if (row) {
      setExtratoBlock({
        title: mes + '<span>vencimento ' + fmtDate(row.dueDate) + '</span>',
        total: fmtBRL(row.total),
        base: fmtBRL(row.base),
        fil: null,
        juros: Number(row.interest) > 0 ? fmtBRL(row.interest) : '—',
        status: row.status === 'PAID' ? 'paga' : 'aberta',
        statusCls: row.status === 'PAID' ? 'ok' : 'mute',
        paid: row.paidAt ? fmtDate(row.paidAt) : '—',
        receiptUrl: row.status === 'PAID' ? row.receiptUrl : null,
      });
      return;
    }
    if (s && s.mesRef === mes) {
      var b = s.breakdown || {};
      setExtratoBlock({
        title: mes + '<span>vencimento ' + fmtDate(s.dueDate) + '</span>',
        total: fmtBRL(s.totalDue),
        base: fmtBRL(b.base),
        fil: (b.nFiliais || 0) + ' × ' + fmtBRL(b.valorPorFilial) + ' · ' + fmtBRL(b.filialTotal),
        juros: s.hasInterest ? fmtBRL(s.interest) : '—',
        status: s.paidAt ? 'paga' : 'aberta',
        statusCls: s.paidAt ? 'ok' : 'mute',
        paid: s.paidAt ? fmtDate(s.paidAt) : '—',
        receiptUrl: s.paidAt ? s.receiptUrl : null,
      });
      return;
    }
    el('extratoMens').classList.add('hidden');
  }

  function weekRow(w) {
    var pago = w.status === 'pago';
    return '<tr>'
      + '<td class="num">' + fmtDate(w.weekStart) + '–' + fmtDate(w.weekEnd) + '</td>'
      + '<td class="num">' + w.totalPedidos + '</td>'
      + '<td class="num mo">' + fmtBRL(w.totalBruto) + '</td>'
      + '<td class="num mo">' + fmtBRL(w.totalLiquido) + '</td>'
      + '<td class="num">' + (w.paidAt ? fmtDate(w.paidAt) : '—') + '</td>'
      + '<td><span class="pg-tag ' + (pago ? 'ok' : 'mute') + '">' + (w.status || '—') + '</span></td>'
      + '</tr>';
  }

  function renderWeeks() {
    var extrato = state.weeks.filter(function (w) { return mesOf(w.weekStart) === state.mesSel; });
    var rcRows = el('rcRows');
    if (rcRows) {
      rcRows.innerHTML = extrato.length
        ? extrato.map(weekRow).join('')
        : '<tr><td colspan="6">Nenhuma semana neste mês.</td></tr>';
    }
    var rcWeeks = el('rcWeeks');
    if (rcWeeks) rcWeeks.textContent = extrato.length + (extrato.length === 1 ? ' semana' : ' semanas');
    var rcWeeks2 = el('rcWeeks2');
    if (rcWeeks2) rcWeeks2.textContent = extrato.length + (extrato.length === 1 ? ' semana' : ' semanas');
    var rcPeriod = el('rcPeriod');
    if (rcPeriod) rcPeriod.textContent = state.mesSel || '—';
    var receberRows = el('receberRows');
    if (receberRows) {
      receberRows.innerHTML = state.weeks.length
        ? state.weeks.map(weekRow).join('')
        : '<tr><td colspan="6">Nenhum repasse registrado ainda.</td></tr>';
    }
  }

  function renderWeekActual(a) {
    if (!a || a.message) return;
    el('wkPeriod').textContent = fmtDate(a.weekStart) + '–' + fmtDate(a.weekEnd);
    el('wkLiquido').textContent = fmtBRL(a.totalLiquido);
    el('wkPedidos').textContent = a.totalPedidos + ' pedidos';
    el('wkStatus').textContent = a.status || '—';
    el('wkPaid').textContent = a.paidAt
      ? ('pago em ' + fmtDate(a.paidAt))
      : 'entra na conta após o fechamento da semana';
  }

  /* ── Receber (chave PIX) ─────────────────────────────────── */
  function fillPixForm(empresa) {
    if (!el('pixStatus')) return; // pós-unmount (resposta atrasada)
    var configurada = !!(empresa && empresa.pixKey);
    el('pixStatus').classList.toggle('active', configurada && empresa.status === 'active');
    el('pixStatus').classList.toggle('pending', !configurada || empresa.status !== 'active');
    el('pixStatusText').innerHTML = configurada
      ? '<b>Recebimento ' + (empresa.status === 'active' ? 'ativo' : 'inativo') + '</b> na chave ' + escapeHtml(empresa.pixKey)
        + '<span>' + escapeHtml(empresa.pixKeyType || '') + (empresa.nextMonday ? ' · próximo repasse ' + fmtDate(empresa.nextMonday) : '') + '</span>'
      : '<b>Recebimento pendente</b><span>cadastre uma chave para ativar</span>';

    if (el('payEmail')) el('payEmail').value = (empresa && empresa.email) || '';
    if (el('payCpfCnpj')) el('payCpfCnpj').value = (empresa && empresa.cpfCnpj) || '';
    if (el('payPixKey')) el('payPixKey').value = (empresa && empresa.pixKey) || '';
    if (el('payPixKeyType')) el('payPixKeyType').value = (empresa && empresa.pixKeyType) || 'cpf';

    el('btnAtualizarPayment').classList.toggle('hidden', !configurada);
    el('btnDesativarPayment').classList.toggle('hidden', !configurada);
    el('btnAtivarPayment').classList.toggle('hidden', configurada);
  }

  function validatePixForm() {
    var email = (el('payEmail') || {}).value || '';
    var cpfCnpj = (el('payCpfCnpj') || {}).value || '';
    var pixKey = (el('payPixKey') || {}).value || '';
    var pixKeyType = (el('payPixKeyType') || {}).value || '';
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return { ok: false, msg: 'E-mail inválido.' };
    var digits = cpfCnpj.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) {
      return { ok: false, msg: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos.' };
    }
    if (!pixKey.trim()) return { ok: false, msg: 'Chave PIX é obrigatória.' };
    if (pixKeyType === 'cpf' && pixKey.replace(/\D/g, '').length !== 11) {
      return { ok: false, msg: 'Chave PIX CPF deve ter 11 dígitos.' };
    }
    if (pixKeyType === 'cnpj' && pixKey.replace(/\D/g, '').length !== 14) {
      return { ok: false, msg: 'Chave PIX CNPJ deve ter 14 dígitos.' };
    }
    if (pixKeyType === 'email' && !emailRe.test(pixKey)) {
      return { ok: false, msg: 'Chave PIX e-mail inválida.' };
    }
    return { ok: true };
  }

  function showPixError(msg) {
    var box = el('payment-error');
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function salvarPagamentos(metodo) {
    var v = validatePixForm();
    if (!v.ok) return showPixError(v.msg);
    el('payment-error').classList.add('hidden');
    var body = {
      email: el('payEmail').value.trim(),
      cpfCnpj: el('payCpfCnpj').value.replace(/\D/g, ''),
      pixKey: el('payPixKey').value.trim(),
      pixKeyType: el('payPixKeyType').value,
    };
    var req = metodo === 'POST'
      ? api('/empresa/payment/setup', { method: 'POST', body: JSON.stringify(body) })
      : api('/empresa/payment', { method: 'PUT', body: JSON.stringify({ pixKey: body.pixKey, pixKeyType: body.pixKeyType }) });
    req.then(function () {
      if (typeof toast === 'function') toast('Chave PIX salva.');
      return api('/empresa/payment/status').then(fillPixForm);
    }).catch(function (e) { showPixError(e.message); });
  }

  function desativarPagamentos() {
    var ok = window.confirm
      ? window.confirm('Desativar pagamentos? Você não receberá transferências automaticamente.')
      : true;
    if (!ok) return;
    api('/empresa/payment', { method: 'DELETE' })
      .then(function () {
        if (typeof toast === 'function') toast('Pagamentos desativados.');
        return api('/empresa/payment/status').then(fillPixForm);
      })
      .catch(function (e) {
        // sem configuração = nada a desativar
        fillPixForm(null);
        if (e.message && typeof toast === 'function') toast(e.message);
      });
  }

  /* ── sub-abas ────────────────────────────────────────────── */
  var VIEWS = { mensalidade: 'mensalidadeSection', extrato: 'vExtrato', receber: 'vReceber' };

  function selectTab(key) {
    Object.keys(VIEWS).forEach(function (k) {
      var v = el(VIEWS[k]);
      if (v) v.classList.toggle('hidden', k !== key);
      var t = document.querySelector('#pagamentosTabs [data-tab="' + k + '"]');
      if (t) t.setAttribute('aria-selected', String(k === key));
    });
  }

  window.__pagamentos = {
    renderInvoice: renderInvoice,
    renderPayments: function () { renderChips(); },
    renderWeeks: renderWeeks,
    selectTab: selectTab,
    state: state,
  };

  /* ── init ────────────────────────────────────────────────── */
  (function () {
    if (el('pgBrand')) {
      el('pgBrand').textContent = au.lojaNome || au.empresaNome || au.username || 'Loja';
    }
    if (el('pgTipo')) {
      el('pgTipo').textContent = isFilial ? 'Filial' : (au.empresaTipo || '');
      el('pgTipo').classList.toggle('hidden', !au.empresaTipo);
    }

    var tabsBox = el('pagamentosTabs');
    if (tabsBox) {
      tabsBox.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () { selectTab(b.dataset.tab); });
      });
    }

    if (isFilial) {
      var tabM = document.querySelector('#pagamentosTabs [data-tab="mensalidade"]');
      if (tabM) tabM.classList.add('hidden');
      var sec = el('mensalidadeSection');
      if (sec) sec.classList.add('hidden');
      var filNote = el('extratoFilialNote');
      if (filNote) filNote.classList.remove('hidden');
      var emBlock = el('extratoMens');
      if (emBlock) emBlock.classList.add('hidden');
      selectTab('extrato');
    }

    if (el('btnPay')) el('btnPay').addEventListener('click', gerarPix);
    if (el('btnReceipt')) {
      el('btnReceipt').addEventListener('click', function () {
        baixarComprovante((state.status && state.status.receiptUrl) || null);
      });
    }
    if (el('btnCopyPix')) {
      el('btnCopyPix').addEventListener('click', function () {
        var input = el('pixCode');
        if (input && navigator.clipboard) {
          navigator.clipboard.writeText(input.value).then(function () {
            if (typeof toast === 'function') toast('Código PIX copiado.');
          });
        }
      });
    }
    if (el('monthChips')) {
      el('monthChips').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-month]');
        if (!b) return;
        state.mesSel = b.dataset.month;
        state.mesUser = true;
        renderChips();
      });
    }
    var emReceipt = el('emReceipt');
    if (emReceipt) {
      emReceipt.addEventListener('click', function () { baixarComprovante(emReceipt.dataset.url); });
    }
    if (el('btnAtivarPayment')) el('btnAtivarPayment').addEventListener('click', function () { salvarPagamentos('POST'); });
    if (el('btnAtualizarPayment')) el('btnAtualizarPayment').addEventListener('click', function () { salvarPagamentos('PUT'); });
    if (el('btnDesativarPayment')) el('btnDesativarPayment').addEventListener('click', desativarPagamentos);

    api('/empresa/subscription/status')
      .then(renderInvoice)
      .catch(function () {});
    if (!isFilial) {
      api('/empresa/subscription/payments')
        .then(function (d) {
          state.payments = (d && d.payments) || [];
          renderChips();
        })
        .catch(function () {});
    }
    api('/empresa/settlement/history')
      .then(function (d) {
        state.weeks = (d && d.settlements) || [];
        renderChips();
      })
      .catch(function () {});
    api('/empresa/settlement/actual')
      .then(renderWeekActual)
      .catch(function () {});
    api('/empresa/payment/status')
      .then(fillPixForm)
      .catch(function () { fillPixForm(null); });
  })();
  })();
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
