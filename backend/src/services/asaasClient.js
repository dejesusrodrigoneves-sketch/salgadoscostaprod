import axios from 'axios';
import config from '../config/env.js';

const BASE = config.asaasEnv === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3';

function headers() {
  return { access_token: config.asaasAccessToken, 'Content-Type': 'application/json' };
}

async function criarCustomer({ nome, cpf, telefone }) {
  const { data } = await axios.post(`${BASE}/customers`, {
    name: nome,
    cpfCnpj: cpf,
    phone: telefone || undefined,
  }, { headers: headers() });
  return data.id;
}

async function criarPix({ customerId, valor, descricao, dueDate }) {
  const { data } = await axios.post(`${BASE}/payments`, {
    customer: customerId,
    billingType: 'PIX',
    value: valor,
    dueDate,
    description: descricao,
  }, { headers: headers() });
  const qr = await axios.get(`${BASE}/payments/${data.id}/pixQrCode`, { headers: headers() });
  return {
    paymentId: data.id,
    status: data.status,
    pixCode: qr.data.payload,
    pixQrCode: qr.data.encodedImage,
    expiresAt: qr.data.expirationDate,
  };
}

async function consultarPayment(paymentId) {
  const { data } = await axios.get(`${BASE}/payments/${paymentId}`, { headers: headers() });
  return data;
}

async function reembolsar(paymentId, valor) {
  const body = valor !== undefined ? { value: valor } : {};
  const { data } = await axios.post(`${BASE}/payments/${paymentId}/refund`, body, { headers: headers() });
  return data;
}

function verificarAutenticacao(headerToken) {
  return Boolean(config.asaasWebhookToken) && headerToken === config.asaasWebhookToken;
}

export default { criarCustomer, criarPix, consultarPayment, reembolsar, verificarAutenticacao };
