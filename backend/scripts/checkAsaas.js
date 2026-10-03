#!/usr/bin/env node
// backend/scripts/checkAsaas.js — valida configuração Asaas (E3)
// Uso: node scripts/checkAsaas.js   (exit 1 = FAIL)

require('dotenv').config();
const config = require('../src/config/env');

const token = process.env.ASAAS_ACCESS_TOKEN || '';
const env = config.asaasEnv || process.env.ASAAS_ENV || '';
const webhook = process.env.ASAAS_WEBHOOK_TOKEN || '';
const subconta = process.env.ASAAS_SUBCONTA_KEY || '';

const problems = [];
if (!token) problems.push('ASAAS_ACCESS_TOKEN ausente');
else if (env === 'sandbox' && !token.startsWith('$aact')) {
  problems.push('ASAAS_ENV=sandbox mas token não parece sandbox (esperado prefixo $aact)');
} else if (env === 'production' && token.startsWith('$aact')) {
  problems.push('ASAAS_ENV=production mas token parece de sandbox ($aact) — 401 garantido');
}
if (env !== 'sandbox' && env !== 'production') problems.push(`ASAAS_ENV inválido: "${env}" (use sandbox|production)`);
if (!webhook) problems.push('ASAAS_WEBHOOK_TOKEN ausente — webhooks serão rejeitados');

console.log('Asaas env check');
console.log('  ASAAS_ENV            =', env);
console.log('  ACCESS_TOKEN         =', token ? `${token.slice(0, 8)}… (${token.length} chars)` : '(vazio)');
console.log('  WEBHOOK_TOKEN        =', webhook ? `presente (${webhook.length} chars)` : '(vazio)');
console.log('  SUBCONTA_KEY         =', subconta ? `presente (${subconta.length} chars)` : '(vazio)');

if (problems.length) {
  console.error('FAIL:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}
console.log('OK: configuração Asaas coerente.');
