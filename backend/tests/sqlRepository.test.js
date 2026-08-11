import { describe, it, expect } from 'vitest';
import * as sqlRepository from '../src/repositories/sqlRepository.js';

describe('listarPedidosFiltrados - input sanitization (integration)', () => {
  it('handles empty status string', async () => {
    const result = await sqlRepository.listarPedidosFiltrados({ status: '' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles invalid date strings', async () => {
    const result = await sqlRepository.listarPedidosFiltrados({ 
      createdAtFrom: 'invalid-date',
      createdAtTo: 'also-invalid'
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles undefined filtros', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(undefined);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles null filtros', async () => {
    const result = await sqlRepository.listarPedidosFiltrados(null);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles valid status filter', async () => {
    const result = await sqlRepository.listarPedidosFiltrados({ status: 'pendente' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles multiple status filter', async () => {
    const result = await sqlRepository.listarPedidosFiltrados({ status: 'pendente,producao' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles valid date filter', async () => {
    const result = await sqlRepository.listarPedidosFiltrados({ 
      createdAtFrom: '2024-01-01',
      createdAtTo: '2024-12-31'
    });
    expect(Array.isArray(result)).toBe(true);
  });
});