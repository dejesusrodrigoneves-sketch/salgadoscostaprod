// OTP de primeiro acesso do cliente (Task 9 — plano proteção de dados)
const nodeCrypto = require('node:crypto');
const { hashPassword, verifyPassword } = require('../utils/password');
const { maskTelefone } = require('../utils/pii');

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function buildOtpService({ repo, sendOtp, now = () => new Date() }) {
  async function request(empresaId, clienteId, telefone) {
    await repo.invalidatePending(empresaId, clienteId);
    const code = String(nodeCrypto.randomInt(0, 1000000)).padStart(6, '0');
    await repo.create({ empresaId, clienteId, otpHash: await hashPassword(code), expiresAt: new Date(now().getTime() + TTL_MS) });
    await sendOtp(telefone, code);
    return { masked: maskTelefone(telefone), code };
  }
  async function verify(empresaId, clienteId, code) {
    const row = await repo.findLatest(empresaId, clienteId);
    if (!row || row.consumedAt) return false;
    if (new Date(row.expiresAt) <= now()) return false;
    if (row.attempts >= MAX_ATTEMPTS) return false;
    const ok = await verifyPassword(String(code), row.otpHash);
    if (!ok) { await repo.incrementAttempts(row.id); return false; }
    await repo.consume(row.id);
    return true;
  }
  return { request, verify };
}
module.exports = { buildOtpService, TTL_MS, MAX_ATTEMPTS };
