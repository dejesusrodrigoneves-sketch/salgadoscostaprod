import { PLATFORMS, ENTRY_TYPES } from '../core/types.js';

function round2(v) {
  return Math.round(v * 100) / 100;
}

// Normaliza um Pedido pago + total recebido em uma entrada financeira.
export function normalizePedido(pedido, recebido) {
  const gross = Number(pedido.total || 0);
  const discount = Number(pedido.desconto || 0);
  const entrega = Number(pedido.taxasEntrega || 0);
  const cartao = Number(pedido.taxasCartao || 0);
  const fees = entrega + cartao;
  const net = gross - discount - fees;
  return {
    empresaId: pedido.empresaId,
    source: PLATFORMS.SAAS,
    externalId: pedido.id,
    type: ENTRY_TYPES.SALE,
    grossAmount: round2(gross),
    discountAmount: round2(discount),
    platformFee: 0,
    paymentFee: 0,
    deliveryAmount: round2(entrega),
    otherFees: round2(cartao),
    netAmount: round2(net),
    expectedAmount: round2(net),
    receivedAmount: recebido != null ? round2(recebido) : null,
    transactionDate: new Date(pedido.createdAt),
    settlementDate: null,
    status: 'PAID',
  };
}

const saasProvider = {
  platform: PLATFORMS.SAAS,
  isConfigured() { return true; },
  buildAuthorizeUrl() { return null; },
  async exchangeCode() { throw new Error('SAAS nao usa OAuth'); },
  async refreshToken() { throw new Error('SAAS nao usa OAuth'); },
  async revoke() { throw new Error('SAAS nao usa OAuth'); },
  async syncFinancialData() { return []; },
  async syncSettlements() { return []; },
  async handleWebhook() { throw new Error('SAAS nao usa webhook'); },
  normalizePedido,
};

export default saasProvider;
export { saasProvider };
