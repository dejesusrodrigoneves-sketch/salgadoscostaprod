window.Financeiro = (function () {
  function auth() {
    const raw = localStorage.getItem('authUser');
    if (!raw) { window.location.href = 'login.html'; return null; }
    return JSON.parse(raw);
  }

  function fmt(v) {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function api(path, opts = {}) {
    const a = auth();
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}`, ...(opts.headers || {}) },
    });
    if (res.status === 401) { window.location.href = 'login.html'; throw new Error('unauthorized'); }
    return res.json();
  }

  async function carregarBalanco() {
    const b = await api('/api/financeiro/balance');
    document.getElementById('fin-bruto').textContent = fmt(b.gross);
    document.getElementById('fin-descontos').textContent = fmt(b.discounts);
    document.getElementById('fin-taxas').textContent = fmt(b.fees);
    document.getElementById('fin-liquido').textContent = fmt(b.net);
    document.getElementById('fin-recebido').textContent = fmt(b.received);
    document.getElementById('fin-a-receber').textContent = fmt(b.receivable);
    const lista = document.getElementById('fin-por-plataforma');
    lista.innerHTML = '';
    (b.porPlataforma || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.source}: ${fmt(p.net)}`;
      lista.appendChild(li);
    });
  }

  async function sincronizar() {
    await api('/api/financeiro/sync', { method: 'POST' });
    await carregarBalanco();
  }

  async function gerarFechamento() {
    await api('/api/financeiro/closing', { method: 'POST', body: JSON.stringify({}) });
    await carregarBalanco();
  }

  return { carregarBalanco, sincronizar, gerarFechamento };
})();
