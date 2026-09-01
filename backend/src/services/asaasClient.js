import axios from 'axios';
import crypto from 'crypto';
import config from '../config/env.js';

const BASE = config.asaasEnv === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3';

function headers() {
  return { access_token: config.asaasAccessToken, 'Content-Type': 'application/json' };
}

function subcontaHeaders(accessToken) {
  return { access_token: accessToken, 'Content-Type': 'application/json' };
}

async function criarCustomer({ nome, cpf, telefone }) {
  const { data } = await axios.post(`${BASE}/customers`, {
    name: nome,
    cpfCnpj: cpf,
    phone: telefone || undefined,
  }, { headers: headers() });
  return data.id;
}

async function criarSubconta({ nome, email, cpfCnpj, phone, address }) {
  const { data } = await axios.post(`${BASE}/accounts`, {
    name: nome,
    email,
    cpfCnpj,
    phone: phone || undefined,
    address: address || undefined,
  }, { headers: headers() });
  return { id: data.id, apiKey: data.apiKey, walletId: data.walletId };
}

async function criarPix({ customerId, valor, descricao, dueDate, splits }) {
  const body = {
    customer: customerId,
    billingType: 'PIX',
    value: valor,
    dueDate,
    description: descricao,
  };
  if (splits && splits.length > 0) {
    body.split = splits;
  }
  const { data } = await axios.post(`${BASE}/payments`, body, { headers: headers() });
  const qr = await axios.get(`${BASE}/payments/${data.id}/pixQrCode`, { headers: headers() });
  return {
    paymentId: data.id,
    status: data.status,
    pixCode: qr.data.payload,
    pixQrCode: qr.data.encodedImage,
    expiresAt: qr.data.expirationDate,
  };
}

async function criarSubscription({ customerId, valor, descricao, nextDueDate }) {
  const { data } = await axios.post(`${BASE}/subscriptions`, {
    customer: customerId,
    billingType: 'PIX',
    value: valor,
    cycle: 'MONTHLY',
    nextDueDate,
    description: descricao,
  }, { headers: headers() });
  return { subscriptionId: data.id, status: data.status };
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

async function agendarTransferencia({ accessToken, valor, pixAddressKey, pixAddressKeyType, scheduleDate, description }) {
  const { data } = await axios.post(`${BASE}/transfers`, {
    value: valor,
    pixAddressKey,
    pixAddressKeyType,
    scheduleDate,
    description: description || undefined,
  }, { headers: subcontaHeaders(accessToken) });
  return { id: data.id, status: data.status };
}

async function consultarSaldo({ accessToken, subcontaId }) {
  const { data } = await axios.get(`${BASE}/accounts/${subcontaId}/balance`, { headers: subcontaHeaders(accessToken) });
  // Normalize: Asaas API may return availableBalance or balance
  return {
    available: data.availableBalance ?? data.balance ?? 0,
    unavailable: data.unavailableBalance ?? 0,
  };
}

function verificarAutenticacao(headerToken) {
  if (!config.asaasWebhookToken || !headerToken) return false;
  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(config.asaasWebhookToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default { criarCustomer, criarSubconta, criarPix, criarSubscription, consultarPayment, reembolsar, agendarTransferencia, consultarSaldo, verificarAutenticacao };
