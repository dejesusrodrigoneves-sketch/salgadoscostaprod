(function() {
  const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';

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
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'API ' + res.status);
    }
    return res.json();
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
            '<button class="btn btn-secondary" onclick="desvincular(' + f.id + ')" style="margin-right:8px;"><i class="fas fa-unlink"></i> Desvincular</button>' +
            '<button class="btn btn-danger" onclick="excluir(' + f.id + ')"><i class="fas fa-trash"></i> Excluir</button>' +
          '</td>' +
          '</tr>';
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Erro ao carregar filiais: ' + escapeHtml(err.message) + '</td></tr>';
    }
  }

  window.abrirModalCriar = function() {
    document.getElementById('modalCriar').classList.add('active');
  };

  window.fecharModal = function() {
    document.getElementById('modalCriar').classList.remove('active');
    document.getElementById('filialNome').value = '';
    document.getElementById('filialJustificativa').value = '';
  };

  window.criarFilial = async function() {
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

  window.desvincular = async function(id) {
    if (!confirm('Tem certeza que deseja desvincular esta filial?')) return;
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

  window.excluir = async function(id) {
    if (!confirm('Tem certeza que deseja excluir esta filial? Os dados serão preservados.')) return;
    try {
      await apiFetch('/api/admin/filiais/' + id, { method: 'DELETE' });
      carregarFiliais();
      alert('Filial excluída (soft delete)!');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  document.addEventListener('DOMContentLoaded', carregarFiliais);
})();
