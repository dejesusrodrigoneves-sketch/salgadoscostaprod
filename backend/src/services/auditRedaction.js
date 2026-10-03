// Redação de PII em audit (Task 11 — plano proteção de dados)
const { maskTelefone, maskCpf, maskEmail } = require('../utils/pii');

const PII = new Set([
  'clienteNome', 'clienteWhatsapp', 'clienteEndereco', 'clienteNumero', 'clienteBairro',
  'telefone', 'endereco', 'numero', 'cep', 'pontoReferencia', 'nome', 'whatsapp',
  'chavePix', 'fcmToken',
  // corrigido vs plano: senão redactValue('cpf'/'email') nunca era chamado
  'cpf', 'cpfCnpj', 'email',
]);

function redactValue(key, v) {
  if (v == null) return v;
  if (key === 'cpf' || key === 'cpfCnpj') return maskCpf(v);
  if (key === 'email') return maskEmail(v);
  if (key === 'telefone' || key === 'clienteWhatsapp' || key === 'whatsapp') return maskTelefone(v);
  return '***';
}

function redactAudit(obj) {
  if (Array.isArray(obj)) return obj.map((v) => redactAudit(v));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = PII.has(k) ? redactValue(k, v) : (v && typeof v === 'object' ? redactAudit(v) : v);
    }
    return out;
  }
  return obj;
}

// actorUsername: telefone/email são PII; username de admin não (utilidade do audit preservada)
const PHONE_RE = /^\+?\d{10,14}$/;
function maskActor(u) {
  if (u == null) return u;
  const s = String(u);
  if (PHONE_RE.test(s.replace(/[\s-]/g, ''))) return maskTelefone(s);
  if (s.includes('@')) return maskEmail(s);
  return s;
}

module.exports = { redactAudit, maskActor };
