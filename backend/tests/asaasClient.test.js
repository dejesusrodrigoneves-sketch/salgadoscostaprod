import { describe, it, expect, vi, beforeEach } from 'vitest';

const axios = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('axios', () => ({ default: axios }));

// Mock config so ASAAS_WEBHOOK_TOKEN is defined for verification tests
vi.mock('../src/config/env.js', () => ({
  default: {
    asaasAccessToken: 'plat_token_123',
    asaasWebhookToken: 'whsec_test',
    asaasEnv: 'sandbox',
  },
}));

import asaasClient from '../src/services/asaasClient.js';

describe('asaasClient', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  /* ─── criarPix (existing, with split extension) ─── */

  it('criarPix cria pagamento e busca QR code', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'pay_123', status: 'PENDING' } });
    axios.get.mockResolvedValueOnce({
      data: { payload: '00020126580014BR.GOV.BCB.PIX', encodedImage: 'iVBORw0KGgo=', expirationDate: '2026-08-15 12:00:00' },
    });
    const out = await asaasClient.criarPix({ customerId: 'cus_1', valor: 10.5, descricao: 'Pedido 001', dueDate: '2026-08-15' });
    expect(out.paymentId).toBe('pay_123');
    expect(out.pixCode).toBe('00020126580014BR.GOV.BCB.PIX');
    expect(out.pixQrCode).toBe('iVBORw0KGgo=');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/payments'),
      expect.objectContaining({ billingType: 'PIX', value: 10.5, customer: 'cus_1' }),
      expect.anything()
    );
  });

  it('criarPix includes split array when splits provided', async () => {
    const splits = [
      { walletId: 'wallet_a', fixedValue: 8.0 },
      { walletId: 'wallet_b', fixedValue: 2.5 },
    ];
    axios.post.mockResolvedValueOnce({ data: { id: 'pay_split_1', status: 'PENDING' } });
    axios.get.mockResolvedValueOnce({
      data: { payload: 'pix_payload', encodedImage: 'qr_img', expirationDate: '2026-08-20' },
    });
    const out = await asaasClient.criarPix({
      customerId: 'cus_1', valor: 10.5, descricao: 'Split order', dueDate: '2026-08-20', splits,
    });
    expect(out.paymentId).toBe('pay_split_1');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/payments'),
      expect.objectContaining({ split: splits }),
      expect.anything()
    );
  });

  it('criarPix omits split when splits is empty/undefined', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'pay_no_split', status: 'PENDING' } });
    axios.get.mockResolvedValueOnce({
      data: { payload: 'pix', encodedImage: 'img', expirationDate: '2026-08-20' },
    });
    await asaasClient.criarPix({ customerId: 'cus_2', valor: 5, descricao: 'No split', dueDate: '2026-08-20' });
    const body = axios.post.mock.calls[0][1];
    expect(body.split).toBeUndefined();
  });

  /* ─── criarSubconta ─── */

  it('criarSubconta posts /v3/accounts with platform token', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'acc_1', apiKey: 'sub_key_abc', walletId: 'wal_1' } });
    const result = await asaasClient.criarSubconta({
      nome: 'Loja Teste', email: 'loja@test.com', cpfCnpj: '12345678901', phone: '11999990000',
    });
    expect(result).toEqual({ id: 'acc_1', apiKey: 'sub_key_abc', walletId: 'wal_1' });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/accounts'),
      expect.objectContaining({ name: 'Loja Teste', email: 'loja@test.com', cpfCnpj: '12345678901' }),
      expect.objectContaining({ headers: expect.objectContaining({ access_token: 'plat_token_123' }) })
    );
  });

  it('criarSubconta handles optional fields', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'acc_2', apiKey: 'key2', walletId: 'wal_2' } });
    await asaasClient.criarSubconta({ nome: 'X', email: 'x@y.com', cpfCnpj: '000' });
    const body = axios.post.mock.calls[0][1];
    expect(body.phone).toBeUndefined();
    expect(body.address).toBeUndefined();
  });

  it('criarSubconta throws on API error', async () => {
    axios.post.mockRejectedValueOnce(new Error('400 Bad Request'));
    await expect(asaasClient.criarSubconta({ nome: 'E', email: 'e@e.com', cpfCnpj: '0' }))
      .rejects.toThrow('400 Bad Request');
  });

  /* ─── agendarTransferencia ─── */

  it('agendarTransferencia uses subconta token, not platform token', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'trans_1', status: 'SCHEDULED' } });
    const result = await asaasClient.agendarTransferencia({
      accessToken: 'sub_api_key_xyz',
      valor: 100,
      pixAddressKey: 'chave_pix_123',
      pixAddressKeyType: 'EVP',
      scheduleDate: '2026-08-25',
      description: 'Transferencia semanal',
    });
    expect(result).toEqual({ id: 'trans_1', status: 'SCHEDULED' });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/transfers'),
      expect.objectContaining({ value: 100, pixAddressKey: 'chave_pix_123', scheduleDate: '2026-08-25' }),
      expect.objectContaining({ headers: expect.objectContaining({ access_token: 'sub_api_key_xyz' }) })
    );
  });

  it('agendarTransferencia uses subconta token NOT platform token', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'trans_2', status: 'PENDING' } });
    await asaasClient.agendarTransferencia({
      accessToken: 'sub_secret_key',
      valor: 50,
      pixAddressKey: 'key',
      pixAddressKeyType: 'CPF',
      scheduleDate: '2026-09-01',
    });
    const headers = axios.post.mock.calls[0][2].headers;
    expect(headers.access_token).toBe('sub_secret_key');
    expect(headers.access_token).not.toBe('plat_token_123');
  });

  it('agendarTransferencia throws on API error', async () => {
    axios.post.mockRejectedValueOnce(new Error('Insufficient balance'));
    await expect(asaasClient.agendarTransferencia({
      accessToken: 'sub_key', valor: 999, pixAddressKey: 'k', pixAddressKeyType: 'EVP', scheduleDate: '2026-09-01',
    })).rejects.toThrow('Insufficient balance');
  });

  /* ─── consultarSaldo ─── */

  it('consultarSaldo normalizes availableBalance from Asaas API', async () => {
    axios.get.mockResolvedValueOnce({ data: { availableBalance: 250.75, unavailableBalance: 10.00 } });
    const result = await asaasClient.consultarSaldo({ accessToken: 'sub_key_42', subcontaId: 'acc_42' });
    expect(result).toEqual({ available: 250.75, unavailable: 10.00 });
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/accounts/acc_42/balance'),
      expect.objectContaining({ headers: expect.objectContaining({ access_token: 'sub_key_42' }) })
    );
  });

  it('consultarSaldo uses subconta token NOT platform token', async () => {
    axios.get.mockResolvedValueOnce({ data: { availableBalance: 0 } });
    await asaasClient.consultarSaldo({ accessToken: 'sub_real_key', subcontaId: 'acc_99' });
    const headers = axios.get.mock.calls[0][1].headers;
    expect(headers.access_token).toBe('sub_real_key');
    expect(headers.access_token).not.toBe('plat_token_123');
  });

  it('consultarSaldo throws on API error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Account not found'));
    await expect(asaasClient.consultarSaldo({ accessToken: 'k', subcontaId: 'bad' }))
      .rejects.toThrow('Account not found');
  });

  /* ─── verificarAutenticacao (existing) ─── */

  it('verificarAutenticacao compara header com token do env', () => {
    expect(asaasClient.verificarAutenticacao('whsec_test')).toBe(true);
    expect(asaasClient.verificarAutenticacao('errado')).toBe(false);
  });
});
