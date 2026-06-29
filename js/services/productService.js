import { api } from '../core/api.js';

export const productService = {
  async listar() {
    return api.get('/produtos');
  },
  async buscar(id) {
    return api.get(`/produtos/${id}`);
  },
  async criar(data) {
    return api.post('/produtos', data);
  },
  async atualizar(id, data) {
    return api.put(`/produtos/${id}`, data);
  },
  async deletar(id) {
    return api.delete(`/produtos/${id}`);
  },
};
