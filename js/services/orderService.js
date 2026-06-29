import { api } from '../core/api.js';

export const orderService = {
  async listar(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();
    return api.get(`/pedidos${params ? '?' + params : ''}`);
  },
  async buscar(id) {
    return api.get(`/pedidos/${id}`);
  },
  async criar(data) {
    return api.post('/pedidos', data);
  },
  async atualizarStatus(id, status) {
    return api.patch(`/pedidos/${id}/status`, { status });
  },
};
