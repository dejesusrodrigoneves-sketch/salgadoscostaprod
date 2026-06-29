import { api } from '../core/api.js';

export const caixaService = {
  async hoje(data) {
    const params = data ? `?data=${data}` : '';
    return api.get(`/caixa/hoje${params}`);
  },
  async abrir(valorInicial) {
    return api.post('/caixa/abrir', { valorInicial });
  },
  async fechar(dados) {
    return api.post('/caixa/fechar', dados);
  },
  async relatorios(inicio, fim) {
    return api.get(`/caixa/relatorios?inicio=${inicio}&fim=${fim}`);
  },
};
