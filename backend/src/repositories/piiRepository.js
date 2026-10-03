const nodeCrypto = require('node:crypto');
const { encryptField, decryptField } = require('../utils/crypto');
const { blindIndex, normalizeTelefone, bidxVersionOf } = require('../utils/pii');
const { getCryptoKeys } = require('../config/cryptoKeys');
const prisma = require('../config/prisma');

function enc(value, model, field, scopeId) {
  return value === undefined || value === null ? null : encryptField(value, { model, field, scopeId });
}
function dec(value, model, field, scopeId) {
  return value === undefined || value === null ? null : decryptField(value, { model, field, scopeId });
}

function mapClienteIn(c) {
  const scopeId = String(c.empresaId);
  return {
    ...(c.id ? { id: c.id } : {}),
    empresaId: c.empresaId,
    nome: c.nome,
    bairro: c.bairro ?? null,
    telefoneEnc: enc(c.telefone, 'Cliente', 'telefone', scopeId),
    telefoneBidx: c.telefone ? blindIndex(c.telefone, { empresaId: c.empresaId }) : null,
    telefoneBidxKeyVer: c.telefone ? bidxVersionOf() : null,
    enderecoEnc: enc(c.endereco, 'Cliente', 'endereco', scopeId),
    numeroEnc: enc(c.numero, 'Cliente', 'numero', scopeId),
    cepEnc: enc(c.cep, 'Cliente', 'cep', scopeId),
    pontoReferenciaEnc: enc(c.pontoReferencia, 'Cliente', 'pontoReferencia', scopeId),
    passwordHash: c.passwordHash,
  };
}

function mapClienteOut(row) {
  const scopeId = String(row.empresaId);
  const empty = { telefoneEnc: null, enderecoEnc: null, numeroEnc: null, cepEnc: null, pontoReferenciaEnc: null };
  const merged = { ...empty, ...row };
  return {
    ...row,
    telefone: merged.telefoneEnc ? dec(merged.telefoneEnc, 'Cliente', 'telefone', scopeId) : row.telefone,
    endereco: merged.enderecoEnc ? dec(merged.enderecoEnc, 'Cliente', 'endereco', scopeId) : row.endereco,
    numero: merged.numeroEnc ? dec(merged.numeroEnc, 'Cliente', 'numero', scopeId) : row.numero,
    cep: merged.cepEnc ? dec(merged.cepEnc, 'Cliente', 'cep', scopeId) : row.cep,
    pontoReferencia: merged.pontoReferenciaEnc ? dec(merged.pontoReferenciaEnc, 'Cliente', 'pontoReferencia', scopeId) : row.pontoReferencia,
  };
}

function mapEntregadorIn(e) {
  const s = String(e.empresaId);
  return {
    ...e,
    telefoneEnc: enc(e.telefone, 'Entregador', 'telefone', s),
    telefoneBidx: e.telefone ? blindIndex(e.telefone, { empresaId: e.empresaId }) : null,
    telefoneBidxKeyVer: e.telefone ? bidxVersionOf() : null,
    enderecoEnc: enc(e.endereco, 'Entregador', 'endereco', s),
    whatsappEnc: enc(e.whatsapp, 'Entregador', 'whatsapp', s),
    chavePixEnc: enc(e.chavePix, 'Entregador', 'chavePix', s),
    fcmTokenEnc: enc(e.fcmToken, 'Entregador', 'fcmToken', s),
  };
}
function mapEntregadorOut(r) {
  const s = String(r.empresaId);
  return {
    ...r,
    telefone: r.telefoneEnc ? dec(r.telefoneEnc, 'Entregador', 'telefone', s) : r.telefone,
    endereco: r.enderecoEnc ? dec(r.enderecoEnc, 'Entregador', 'endereco', s) : r.endereco,
    whatsapp: r.whatsappEnc ? dec(r.whatsappEnc, 'Entregador', 'whatsapp', s) : r.whatsapp,
    chavePix: r.chavePixEnc ? dec(r.chavePixEnc, 'Entregador', 'chavePix', s) : r.chavePix,
    fcmToken: r.fcmTokenEnc ? dec(r.fcmTokenEnc, 'Entregador', 'fcmToken', s) : r.fcmToken,
  };
}

function mapPedidoIn(p) {
  const s = String(p.empresaId);
  return {
    ...p,
    clienteNomeEnc: enc(p.clienteNome, 'Pedido', 'clienteNome', s),
    clienteWhatsappEnc: enc(p.clienteWhatsapp, 'Pedido', 'clienteWhatsapp', s),
    clienteWhatsappBidx: p.clienteWhatsapp ? blindIndex(p.clienteWhatsapp, { empresaId: p.empresaId }) : null,
    clienteWhatsappBidxKeyVer: p.clienteWhatsapp ? bidxVersionOf() : null,
    clienteEnderecoEnc: enc(p.clienteEndereco, 'Pedido', 'clienteEndereco', s),
    clienteNumeroEnc: enc(p.clienteNumero, 'Pedido', 'clienteNumero', s),
  };
}
function mapPedidoOut(p) {
  const s = String(p.empresaId);
  return {
    ...p,
    clienteNome: p.clienteNomeEnc ? dec(p.clienteNomeEnc, 'Pedido', 'clienteNome', s) : p.clienteNome,
    clienteWhatsapp: p.clienteWhatsappEnc ? dec(p.clienteWhatsappEnc, 'Pedido', 'clienteWhatsapp', s) : p.clienteWhatsapp,
    clienteEndereco: p.clienteEnderecoEnc ? dec(p.clienteEnderecoEnc, 'Pedido', 'clienteEndereco', s) : p.clienteEndereco,
    clienteNumero: p.clienteNumeroEnc ? dec(p.clienteNumeroEnc, 'Pedido', 'clienteNumero', s) : p.clienteNumero,
  };
}

function mapEmpresaIn(e) {
  const s = String(e.id);
  const cfg = getCryptoKeys();
  const emailBidx = e.email
    ? nodeCrypto.createHmac('sha256', cfg.bidxKeys[bidxVersionOf()])
        .update(String(e.email).toLowerCase().trim()).digest('hex')
    : null;
  return {
    ...e,
    emailBidx,
    cpfCnpjEnc: enc(e.cpfCnpj, 'Empresa', 'cpfCnpj', s),
    pixKeyEnc: enc(e.pixKey, 'Empresa', 'pixKey', s),
  };
}
function mapEmpresaOut(e) {
  const s = String(e.id);
  return {
    ...e,
    cpfCnpj: e.cpfCnpjEnc ? dec(e.cpfCnpjEnc, 'Empresa', 'cpfCnpj', s) : e.cpfCnpj,
    pixKey: e.pixKeyEnc ? dec(e.pixKeyEnc, 'Empresa', 'pixKey', s) : e.pixKey,
  };
}

function buildBidxWhere(empresaId, telefone, versions) {
  if (!empresaId) throw new Error('[piiRepository] empresaId obrigatório');
  const cfg = getCryptoKeys();
  // dual-version: default = TODAS as versões configuradas (ativa + legadas pós-rotação T14)
  const vers = versions && versions.length ? versions : Object.keys(cfg.bidxKeys);
  return {
    OR: vers.map((v) => ({ empresaId, telefoneBidxKeyVer: v, telefoneBidx: blindIndex(telefone, { empresaId, version: v }) })),
  };
}

async function findClienteByTelefone(empresaId, telefone) {
  if (!empresaId) throw new Error('[piiRepository] empresaId obrigatório');
  const row = await prisma.cliente.findFirst({ where: buildBidxWhere(empresaId, telefone) })
    // transição (T6→T13): bidx ainda não backfillado — fallback plaintext (removido no contract T13)
    || await prisma.cliente.findUnique({ where: { empresaId_telefone: { empresaId, telefone } } }).catch(() => null);
  return row ? mapClienteOut(row) : null;
}

// Patch parcial (update): só gera chaves enc/bidx para campos PRESENTES em data
// (senão update parcial apagaria enc existente com null)
const CLIENTE_PII_PAIRS = {
  telefone: ['telefoneEnc', 'telefoneBidx', 'telefoneBidxKeyVer'],
  endereco: ['enderecoEnc'],
  numero: ['numeroEnc'],
  cep: ['cepEnc'],
  pontoReferencia: ['pontoReferenciaEnc'],
};
function mapClientePatch(data, empresaId) {
  const hasPii = Object.keys(CLIENTE_PII_PAIRS).some((k) => data[k] !== undefined);
  if (!hasPii) return {};
  const m = mapClienteIn({ ...data, empresaId });
  const out = {};
  for (const [plain, encs] of Object.entries(CLIENTE_PII_PAIRS)) {
    if (data[plain] !== undefined) for (const e of encs) out[e] = m[e];
  }
  return out;
}

module.exports = {
  enc, dec,
  mapClienteIn, mapClienteOut, mapClientePatch,
  mapEntregadorIn, mapEntregadorOut,
  mapPedidoIn, mapPedidoOut,
  mapEmpresaIn, mapEmpresaOut,
  buildBidxWhere, findClienteByTelefone,
};
