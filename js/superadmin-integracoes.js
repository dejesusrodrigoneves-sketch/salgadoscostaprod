window.SuperIntegracoes = (function () {
  function auth() {
    const raw = localStorage.getItem('authUser');
    if (!raw) { window.location.href = 'login.html'; return null; }
    return JSON.parse(raw);
  }

  async function carregar() {
    const a = auth();
    const res = await fetch('/api/admin/integracoes', {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const integs = await res.json();
    const lista = document.getElementById('super-integ-lista');
    lista.innerHTML = '';
    integs.forEach(i => {
      const div = document.createElement('div');
      div.innerHTML = `
        <strong>${i.platform}</strong>
        <span>${i.configured ? 'Configurado' : 'Não configurado'}</span>
        <span>Empresas conectadas: ${i.empresasConectadas}</span>
        <span>Com erro: ${i.comErro}</span>
      `;
      lista.appendChild(div);
    });
  }

  return { carregar };
})();
