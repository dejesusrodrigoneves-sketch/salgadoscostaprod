/**
 * API wrapper for delivery driver app
 */
const EntregadorAPI = {
  BASE: '/api/entregador',

  getHeaders() {
    const token = localStorage.getItem('entregador_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  },

  async request(method, path, body) {
    const res = await fetch(this.BASE + path, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      // Token expired — redirect to login
      localStorage.removeItem('entregador_token');
      localStorage.removeItem('entregador_refresh');
      localStorage.removeItem('entregador_user');
      localStorage.removeItem('entregador_expiry');
      window.location.href = 'entregador-login.html';
      throw new Error('Sessão expirada');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  },

  // Orders
  getPedidos(status) {
    const q = status ? `?status=${status}` : '';
    return this.request('GET', `/pedidos${q}`);
  },

  getPedido(id) {
    return this.request('GET', `/pedidos/${id}`);
  },

  confirmarEntrega(pedidoId, valorCobrado, observacao) {
    return this.request('POST', `/pedidos/${pedidoId}/confirmar`, { valorCobrado, observacao });
  },

  registrarFalha(pedidoId, motivo) {
    return this.request('POST', `/pedidos/${pedidoId}/falha`, { motivo });
  },

  // History
  getHistorico(inicio, fim) {
    return this.request('GET', `/historico?inicio=${inicio}&fim=${fim}`);
  },

  // Profile
  getPerfil() {
    return this.request('GET', '/perfil');
  },

  updatePerfil(data) {
    return this.request('PUT', '/perfil', data);
  },

  // Push
  registerPush(fcmToken) {
    return this.request('POST', '/push/register', { fcmToken });
  },

  unregisterPush() {
    return this.request('POST', '/push/unregister');
  },

  // Auth
  changePassword(currentPassword, newPassword) {
    return fetch('/api/entregador/auth/change-password', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');
      return data;
    });
  },

  refreshToken() {
    const refresh = localStorage.getItem('entregador_refresh');
    if (!refresh) throw new Error('Sem refresh token');
    return fetch('/api/entregador/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('entregador_token', data.token);
      localStorage.setItem('entregador_refresh', data.refreshToken);
      localStorage.setItem('entregador_expiry', String(Date.now() + 30 * 60 * 1000));
      return data;
    });
  },
};
