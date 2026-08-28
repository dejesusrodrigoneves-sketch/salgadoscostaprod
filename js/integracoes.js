window.Integracoes = (function () {
  function auth() {
    const raw = localStorage.getItem('authUser');
    if (!raw) { window.location.href = 'login.html'; return null; }
    return JSON.parse(raw);
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

  async function carregar() {
    const integs = await api('/api/financeiro/integrations');
    const lista = document.getElementById('integ-lista');
    lista.innerHTML = '';
    integs.forEach(i => {
      const card = document.createElement('div');
      card.className = 'integ-card';
      const label = i.configured ? (i.status === 'CONNECTED' ? '🟢 Conectado' : 'Conectar') : 'Indisponível — aguardando liberação';
      card.innerHTML = `
        <strong>${i.platform}</strong>
        <span>${label}</span>
        ${i.lastSyncAt ? `<small>Última sync: ${new Date(i.lastSyncAt).toLocaleString('pt-BR')}</small>` : ''}
        <button data-platform="${i.platform}" ${!i.configured ? 'disabled' : ''}>${i.status === 'CONNECTED' ? 'Desconectar' : 'Conectar'}</button>
      `;
      lista.appendChild(card);
    });
    lista.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.textContent === 'Desconectar') desconectar(btn.dataset.platform);
        else conectar(btn.dataset.platform);
      });
    });
  }

  async function conectar(platform) {
    const { url } = await api(`/api/financeiro/integrations/${platform}/connect`, { method: 'POST' });
    window.location.href = url;
  }

  async function desconectar(platform) {
    await api(`/api/financeiro/integrations/${platform}/disconnect`, { method: 'POST' });
    await carregar();
  }

  return { carregar };
})();
