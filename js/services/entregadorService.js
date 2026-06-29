import { api } from '../core/api.js';

export const entregadorService = {
  async listar() {
    return api.get('/entregadores');
  },
  async criar(data) {
    return api.post('/entregadores', data);
  },
  async toggle(id, ativo) {
    return api.patch(`/entregadores/${id}/toggle`, { ativo });
  },
  async deletar(id) {
    return api.delete(`/entregadores/${id}`);
  },
};
