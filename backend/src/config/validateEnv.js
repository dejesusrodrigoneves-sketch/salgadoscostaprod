// backend/src/config/validateEnv.js
const REQUIRED = ['JWT_SECRET', 'DATABASE_URL'];
const RECOMMENDED = ['DIRECT_URL', 'CORS_ORIGIN', 'ASAAS_WEBHOOK_TOKEN'];

function validateEnv(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k] || String(env[k]).trim() === '');
  const warnings = RECOMMENDED.filter((k) => !env[k]);
  return { ok: missing.length === 0, missing, warnings };
}

module.exports = { validateEnv };