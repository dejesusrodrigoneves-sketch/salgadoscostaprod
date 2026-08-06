import { describe, it, expect } from 'vitest';
import { processarEdicaoPedido } from '../src/services/orderService.js';

describe('processarEdicaoPedido', () => {
  const pedido = {
    id: '003',
    formaPagamento: 'dinheiro',
    tipoEntrega: 'retirada',
    bairro: '',
    taxasEntrega: 0,
    taxasCartao: 0,
    desconto: 0,
    total: '30.00',
    troco: null,
    itens: [
      { produtoId: 1, quantidade: 2, precoUnitario: '10.00', sabores: null },
    ],
  };
  const produtoEstoqueAtivo = { id: 1, controlaEstoque: true, estoqueAtual: 5, price: '10.00' };
  const produtoEstoqueAtivo2 = { id: 2, controlaEstoque: true, estoqueAtual: 3, price: '8.00' };
  const produtoSemEstoque = { id: 3, controlaEstoque: false, estoqueAtual: 0, price: '5.00' };
  const buscarProdutoFn = async (id) => {
    if (Number(id) === 1) return produtoEstoqueAtivo;
    if (Number(id) === 2) return produtoEstoqueAtivo2;
    if (Number(id) === 3) return produtoSemEstoque;
    return null;
  };

  it('retorna updates do pedido com valores recalculados', async () => {
    const data = {
      formaPagamento: 'pix',
      tipoEntrega: 'retirada',
      bairro: '',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '30.00',
      troco: null,
      itens: pedido.itens,
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data);
    expect(result.updates).toMatchObject({
      formaPagamento: 'pix',
      tipoEntrega: 'retirada',
      taxasEntrega: 0,
      taxasCartao: 0,
      total: '30.00',
    });
  });

  it('detecta itens removidos (presentes em pedido mas ausentes em data.itens)', async () => {
    const data = {
      formaPagamento: 'dinheiro',
      tipoEntrega: 'retirada',
      bairro: '',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '0',
      troco: null,
      itens: [],
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data);
    expect(result.itensRemovidos).toEqual([{ produtoId: 1, quantidade: 2 }]);
  });

  it('detecta itens novos (presentes em data.itens mas ausentes em pedido)', async () => {
    const data = {
      formaPagamento: 'dinheiro',
      tipoEntrega: 'retirada',
      bairro: '',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '46.00',
      troco: null,
      itens: [
        { produtoId: 1, quantidade: 2, precoUnitario: '10.00' },
        { produtoId: 2, quantidade: 1, precoUnitario: '8.00' },
      ],
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data);
    expect(result.itensNovos).toEqual([{ produtoId: 2, quantidade: 1, precoUnitario: '8.00', sabores: null }]);
    expect(result.itensRemovidos).toEqual([]);
  });

  it('quantidade editada gera remocao do antigo + adicao do novo', async () => {
    const data = {
      formaPagamento: 'dinheiro',
      tipoEntrega: 'retirada',
      bairro: '',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '30.00',
      troco: null,
      itens: [
        { produtoId: 1, quantidade: 5, precoUnitario: '6.00' },
      ],
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data);
    // qtd antiga 2 removida; qtd nova 5 adicionada
    expect(result.itensRemovidos).toEqual([{ produtoId: 1, quantidade: 2 }]);
    expect(result.itensNovos).toEqual([{ produtoId: 1, quantidade: 5, precoUnitario: '6.00', sabores: null }]);
  });

  it('gera movimentosEstoque corretamente (reversao e baixa)', async () => {
    const data = {
      formaPagamento: 'dinheiro',
      tipoEntrega: 'retirada',
      bairro: '',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '30.00',
      troco: null,
      itens: [
        { produtoId: 2, quantidade: 4, precoUnitario: '8.00' },
      ],
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data, buscarProdutoFn);
    // Removido: produtoId 1 qtd 2 (controlaEstoque=true) => +2
    expect(result.movimentosEstoque).toContainEqual({ produtoId: 1, delta: 2 });
    // Novo: produtoId 2 qtd 4 (controlaEstoque=true) => -4
    expect(result.movimentosEstoque).toContainEqual({ produtoId: 2, delta: -4 });
  });

  it('ignora movimento de estoque para produto sem controlaEstoque', async () => {
    const data = {
      formaPagamento: 'dinheiro',
      tipoEntrega: 'retirada',
      bairro: '',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '15.00',
      troco: null,
      itens: [
        { produtoId: 3, quantidade: 3, precoUnitario: '5.00' },
      ],
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data, buscarProdutoFn);
    // produto 3 sem estoque, mas removeu produto 1 (controlaEstoque=true) => +2
    expect(result.movimentosEstoque).toEqual([{ produtoId: 1, delta: 2 }]);
  });

  it('grava endereco/numero/cep/referencia quando fornecidos', async () => {
    const data = {
      formaPagamento: 'credito',
      tipoEntrega: 'delivery',
      bairro: 'Centro',
      endereco: 'Rua A',
      numero: '123',
      cep: '12345678',
      referencia: 'Perto da praça',
      taxasEntrega: 7,
      taxasCartao: 2.22,
      desconto: 0,
      total: '39.22',
      troco: 0,
      itens: pedido.itens,
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data);
    expect(result.updates).toMatchObject({
      clienteBairro: 'Centro',
      clienteEndereco: 'Rua A',
      clienteNumero: '123',
      clienteCep: '12345678',
      clienteReferencia: 'Perto da praça',
      tipoEntrega: 'delivery',
    });
  });

  it('limpa endereco/bairro/cep/ref ao mudar para retirada', async () => {
    const pedidoBairro = { ...pedido, clienteBairro: 'Centro', clienteEndereco: 'Rua Velha', clienteNumero: '10', clienteCep: '123', clienteReferencia: 'Praça' };
    const data = {
      formaPagamento: 'pix',
      tipoEntrega: 'retirada',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '30.00',
      troco: null,
      itens: pedido.itens,
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedidoBairro, data);
    // trocou para retirada -> campos de endereco zerados
    expect(result.updates).toMatchObject({
      clienteBairro: null,
      clienteEndereco: null,
      clienteNumero: null,
      clienteCep: null,
      clienteReferencia: null,
    });
  });

  it('preserva endereco quando entrega continua delivery e campo ausente', async () => {
    const pedidoBairro = { ...pedido, clienteBairro: 'Centro', clienteEndereco: 'Rua Velha' };
    const data = {
      formaPagamento: 'pix',
      tipoEntrega: 'delivery',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '30.00',
      troco: null,
      itens: pedido.itens,
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedidoBairro, data);
    // delivery sem bairro/endereco no data -> NAO aparece no updates (preserva banco)
    expect('clienteBairro' in result.updates).toBe(false);
    expect('clienteEndereco' in result.updates).toBe(false);
  });

  it('passa buscarProdutoFn opcional sem buscar produto (sem controle)', async () => {
    const data = {
      formaPagamento: 'dinheiro',
      tipoEntrega: 'retirada',
      bairro: '',
      taxasEntrega: 0,
      taxasCartao: 0,
      desconto: 0,
      total: '0',
      troco: null,
      itens: [],
      itensRemovidos: [],
    };
    const result = await processarEdicaoPedido(pedido, data, async () => null);
    // Sem funcao retorna null => sem movimentos de estoque
    expect(result.movimentosEstoque).toEqual([]);
  });
});
