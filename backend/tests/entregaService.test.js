import { describe, it, expect } from 'vitest';
import { agruparPorEntregador, montarResumoPeriodo } from '../src/services/entregaService.js';

describe('agruparPorEntregador', () => {
  it('agrupa por entregadorId somando entregas e valorTotal', () => {
    const entregas = [
      { entregadorId: 1, valor: '5.00', entregador: { nome: 'João' } },
      { entregadorId: 1, valor: '3.00', entregador: { nome: 'João' } },
      { entregadorId: 2, valor: '10.00', entregador: { nome: 'Maria' } },
    ];
    const result = agruparPorEntregador(entregas);
    expect(result).toHaveLength(2);
    const joao = result.find(r => r.id === 1);
    expect(joao.nome).toBe('João');
    expect(joao.entregas).toBe(2);
    expect(joao.valorTotal).toBe(8);
    const maria = result.find(r => r.id === 2);
    expect(maria.entregas).toBe(1);
    expect(maria.valorTotal).toBe(10);
  });

  it('trata valor null como 0', () => {
    const entregas = [
      { entregadorId: 1, valor: null, entregador: { nome: 'João' } },
    ];
    const result = agruparPorEntregador(entregas);
    expect(result[0].valorTotal).toBe(0);
  });

  it('retorna array vazio para input vazio', () => {
    expect(agruparPorEntregador([])).toEqual([]);
  });
});

describe('montarResumoPeriodo', () => {
  it('agrupa com detalhe dos pedidos enriquecidos via buscarPedidoFn', async () => {
    const entregas = [
      { entregadorId: 1, valor: '12.00', pedidoId: '003', data: new Date('2026-08-04T10:00:00Z'), entregador: { nome: 'João' } },
      { entregadorId: 1, valor: '12.00', pedidoId: '004', data: new Date('2026-08-04T11:00:00Z'), entregador: { nome: 'João' } },
      { entregadorId: 2, valor: '10.00', pedidoId: '005', data: new Date('2026-08-04T12:00:00Z'), entregador: { nome: 'Maria' } },
    ];
    const buscarPedidoFn = async (ids) => Array.isArray(ids) ? ids.map(id => ({
      id, clienteNome: 'Cliente ' + id,
      itens: [{ produtoId: 1, quantidade: 2, precoUnitario: '6.00' }],
      total: id === '005' ? '10.00' : '12.00',
    })) : [];

    const result = await montarResumoPeriodo(entregas, buscarPedidoFn);

    expect(result.totalEntregas).toBe(3);
    expect(result.totalValor).toBe(34);
    expect(result.entregadores).toHaveLength(2);

    const joao = result.entregadores.find(r => r.id === 1);
    expect(joao.nome).toBe('João');
    expect(joao.entregas).toBe(2);
    expect(joao.valorTotal).toBe(24);
    expect(joao.pedidos).toHaveLength(2);
    expect(joao.pedidos[0]).toMatchObject({
      pedidoId: '003',
      valor: 12,
      cliente: 'Cliente 003',
      totalPedido: 12,
    });
    expect(joao.pedidos[0].itens).toEqual([{ produtoId: 1, nome: 'Produto #1', quantidade: 2, precoUnitario: '6.00' }]);

    const maria = result.entregadores.find(r => r.id === 2);
    expect(maria.valorTotal).toBe(10);
    expect(maria.pedidos[0].totalPedido).toBe(10);
  });

  it('usa cliente "-" e totalPedido 0 quando buscarPedidoFn falha', async () => {
    const entregas = [
      { entregadorId: 1, valor: '5.00', pedidoId: 'X1', entregador: { nome: 'João' } },
    ];
    const buscarPedidoFn = async () => { throw new Error('db off'); };
    const result = await montarResumoPeriodo(entregas, buscarPedidoFn);
    expect(result.entregadores[0].pedidos[0]).toMatchObject({
      cliente: '-', itens: [], totalPedido: 0,
    });
    // valor da entrega preservado mesmo sem pedido
    expect(result.entregadores[0].pedidos[0].valor).toBe(5);
    expect(result.totalValor).toBe(5);
  });

  it('retorna vazio quando sem entregas', async () => {
    const result = await montarResumoPeriodo([], async () => null);
    expect(result).toMatchObject({ totalEntregas: 0, totalValor: 0, entregadores: [] });
  });

  it('exclui entregas de pedidos deletados ou não encontrados (buscarPedidoFn retorna null)', async () => {
    const entregas = [
      { entregadorId: 1, valor: '12.00', pedidoId: 'DEL', entregador: { nome: 'X' } },
    ];
    const result = await montarResumoPeriodo(entregas, async () => []);
    expect(result.totalEntregas).toBe(0);
    expect(result.totalValor).toBe(0);
    expect(result.entregadores).toEqual([]);
  });

  it('exclui entrega de pedido deletado sem zerar taxa de entregas válidas do mesmo entregador', async () => {
    const entregas = [
      { entregadorId: 1, valor: '5.00', pedidoId: 'VAL', entregador: { nome: 'João' } },
      { entregadorId: 1, valor: '8.00', pedidoId: 'DEL', entregador: { nome: 'João' } },
    ];
    const buscarPedidoFn = async (ids) => Array.isArray(ids) ? ids.map(id => (id === 'DEL' ? null : { id, clienteNome: 'Cliente', total: '20.00', itens: [], formaPagamento: 'dinheiro', tipoEntrega: 'delivery' })) : [];
    const result = await montarResumoPeriodo(entregas, buscarPedidoFn);
    expect(result.totalEntregas).toBe(1);
    expect(result.totalValor).toBe(5);
    const joao = result.entregadores[0];
    expect(joao.entregas).toBe(1);
    expect(joao.valorTotal).toBe(5);
    expect(joao.pedidos).toHaveLength(1);
    expect(joao.pedidos[0].pedidoId).toBe('VAL');
  });
});
