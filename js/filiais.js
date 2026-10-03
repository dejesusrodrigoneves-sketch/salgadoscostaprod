(function() {
  const API_BASE = (window.getApiBase ? window.getApiBase() : '');

  function getToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('authUser'));
      return auth?.token;
    } catch { return null; }
  }

  function getAuthUser() {
    try {
      return JSON.parse(localStorage.getItem('authUser'));
    } catch { return null; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function apiFetch(path, options = {}) {
    const skip = options.skipLoading === true;
    const opts = { ...options };
    delete opts.skipLoading;
    if (!skip && typeof showLoading === 'function') showLoading();
    try {
      const token = getToken();
      const res = await fetch(API_BASE + path, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          ...opts.headers,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'API ' + res.status);
      }
      return res.json();
    } finally {
      if (!skip && typeof hideLoading === 'function') hideLoading();
    }
  }

  async function carregarFiliais() {
    const tbody = document.getElementById('filiaisBody');
    const authUser = getAuthUser();
    const empresaId = authUser?.empresaId;

    if (!empresaId) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Empresa não identificada</td></tr>';
      return;
    }

    try {
      const filiais = await apiFetch('/api/admin/empresas/' + empresaId + '/filiais');
      if (filiais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhuma filial criada</td></tr>';
        return;
      }
      tbody.innerHTML = filiais.map(function(f) {
        var statusClass = f.status === 'active' ? 'badge-active' : 'badge-pending';
        var statusLabel = f.status === 'active' ? 'Ativa' : 'Pendente';
        return '<tr>' +
          '<td>' + escapeHtml(f.nome) + '</td>' +
          '<td>' + escapeHtml(f.slug) + '</td>' +
          '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
          '<td>' +
            '<button class="btn btn-secondary" data-action="desvincularAction" data-id="' + f.id + '" style="margin-right:8px;"><i class="fas fa-unlink"></i> Desvincular</button>' +
            '<button class="btn btn-danger" data-action="excluirFilialAction" data-id="' + f.id + '"><i class="fas fa-trash"></i> Excluir</button>' +
          '</td>' +
          '</tr>';
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Erro ao carregar filiais: ' + escapeHtml(err.message) + '</td></tr>';
    }
  }

  window.abrirModalCriarAction = window.abrirModalCriar = function() {
    document.getElementById('modalCriar').classList.add('active');
  };

  window.fecharModalAction = window.fecharModal = function() {
    document.getElementById('modalCriar').classList.remove('active');
    document.getElementById('filialNome').value = '';
    document.getElementById('filialJustificativa').value = '';
  };

  window.criarFilialAction = window.criarFilial = async function() {
    var nome = document.getElementById('filialNome').value.trim();
    var justificativa = document.getElementById('filialJustificativa').value.trim();

    if (!nome) {
      alert('Nome é obrigatório');
      return;
    }

    try {
      await apiFetch('/api/admin/filiais', {
        method: 'POST',
        body: JSON.stringify({ nome, justificativa: justificativa || undefined }),
      });
      window.fecharModal();
      carregarFiliais();
      alert('Filial criada! Aguardando aprovação do superadmin.');
    } catch (err) {
      alert('Erro ao criar filial: ' + err.message);
    }
  };

  window.desvincularAction = function(ds) { window._desvincularId = Number(ds.id); document.getElementById('modalDesvincular').classList.add('active'); };
  window.excluirFilialAction = function(ds) { window._excluirId = Number(ds.id); document.getElementById('modalExcluir').classList.add('active'); };

  window.cancelarDesvincularAction = function() { document.getElementById('modalDesvincular').classList.remove('active'); window._desvincularId = null; };
  window.cancelarExcluirAction = function() { document.getElementById('modalExcluir').classList.remove('active'); window._excluirId = null; };

  window.confirmarDesvincularAction = async function() {
    var id = window._desvincularId;
    document.getElementById('modalDesvincular').classList.remove('active');
    window._desvincularId = null;
    if (!id) return;
    try {
      await apiFetch('/api/admin/empresas/' + id + '/parent', {
        method: 'PUT',
        body: JSON.stringify({ parentEmpresaId: null }),
      });
      carregarFiliais();
      alert('Filial desvinculada!');
    } catch (err) {
      alert('Erro ao desvincular: ' + err.message);
    }
  };

  window.confirmarExcluirAction = async function() {
    var id = window._excluirId;
    document.getElementById('modalExcluir').classList.remove('active');
    window._excluirId = null;
    if (!id) return;
    try {
      await apiFetch('/api/admin/filiais/' + id, { method: 'DELETE' });
      carregarFiliais();
      alert('Filial excluída!');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  async function buscarProximoCiclo(empresaId) {
    try {
      var r = await apiFetch('/api/admin/empresas/' + empresaId + '/next-due-date');
      if (r.nextDueDate) {
        var d = new Date(r.nextDueDate + 'T12:00:00');
        return d.toLocaleDateString('pt-BR');
      }
    } catch (e) {}
    // Fallback client-side: próximo dia útil
    var d = new Date();
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return d.toLocaleDateString('pt-BR');
  }

  async function initFiliais() {
    await carregarFiliais();
    var authUser = getAuthUser();
    var empresaId = authUser?.empresaId;
    if (empresaId) {
      var data = await buscarProximoCiclo(empresaId);
      var elD = document.getElementById('dataCicloDesvincular');
      var elE = document.getElementById('dataCicloExcluir');
      if (elD) elD.textContent = data;
      if (elE) elE.textContent = data;
    }
  }

  document.addEventListener('DOMContentLoaded', initFiliais);
})();
