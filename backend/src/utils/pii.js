const nodeCrypto = require('node:crypto');
const { getCryptoKeys } = require('../config/cryptoKeys');

function normalizeTelefone(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

function normalizeCpf(d) { return String(d || '').replace(/\D/g, ''); }

function maskTelefone(t) {
  const d = normalizeTelefone(t);
  if (d.length < 8) return '*****';
  const ddd = d.slice(2, 4);
  const last = d.slice(-4);
  return `+55 ${ddd} *****-${last}`;
}

function maskCpf(d) {
  const v = normalizeCpf(d);
  return v.length === 11 ? `***.***.***-${v.slice(-2)}` : '***';
}

function maskEmail(e) {
  const s = String(e || '');
  const [u, dom] = s.split('@');
  if (!u || !dom) return '***';
  return `${u.slice(0, 2)}***@${dom}`;
}

function bidxVersionOf() { return getCryptoKeys().activeBidxVersion; }

function blindIndex(value, { empresaId, version } = {}) {
  const cfg = getCryptoKeys();
  const ver = version || cfg.activeBidxVersion;
  const secret = cfg.bidxKeys[ver];
  if (!secret) throw new Error(`[pii] versão de bidx desconhecida: ${ver}`);
  const input = `${empresaId ?? 'global'}:${normalizeTelefone(value)}`;
  return nodeCrypto.createHmac('sha256', secret).update(input).digest('hex');
}

module.exports = { normalizeTelefone, normalizeCpf, maskTelefone, maskCpf, maskEmail, blindIndex, bidxVersionOf };
