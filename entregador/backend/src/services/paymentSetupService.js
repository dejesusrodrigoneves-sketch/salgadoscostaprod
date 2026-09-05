const defaultDeps = {
  sql: require('../repositories/sqlRepository'),
  asaasClient: (() => { const m = require('../services/asaasClient'); return m.default || m; })(),
  encrypt: require('../utils/crypto').encrypt,
  auditService: require('./auditService'),
  getNextBusinessDay: require('../utils/businessDays').getNextBusinessDay,
};

const VALID_PIX_KEY_TYPES = ['cpf', 'cnpj', 'email', 'phone', 'random'];

function validatePixKey(key, type) {
  if (!key || typeof key !== 'string') return false;
  switch (type) {
    case 'cpf': return /^\d{11}$/.test(key);
    case 'cnpj': return /^\d{14}$/.test(key);
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case 'phone': return /^\d{10,11}$/.test(key);
    case 'random': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    default: return false;
  }
}

/**
 * Setup Asaas split onboarding for an empresa.
 * Creates subconta, encrypts apiKey, saves to Empresa.
 */
async function setup(empresaId, { email, cpfCnpj, pixKey, pixKeyType }, deps = defaultDeps) {
  const { sql, asaasClient, encrypt, auditService, getNextBusinessDay } = deps;

  if (!empresaId) throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });
  if (!email) throw Object.assign(new Error('email obrigatório'), { status: 400 });
  if (!cpfCnpj) throw Object.assign(new Error('cpfCnpj obrigatório'), { status: 400 });
  if (!pixKey) throw Object.assign(new Error('pixKey obrigatório'), { status: 400 });
  if (!pixKeyType || !VALID_PIX_KEY_TYPES.includes(pixKeyType)) {
    throw Object.assign(new Error(`pixKeyType inválido. Valores aceitos: ${VALID_PIX_KEY_TYPES.join(', ')}`), { status: 400 });
  }
  if (!validatePixKey(pixKey, pixKeyType)) {
    throw Object.assign(new Error(`pixKey inválido para o tipo "${pixKeyType}"`), { status: 400 });
  }

  const empresa = await sql.buscarEmpresa(empresaId);
  if (!empresa) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
  if (empresa.deletedAt) throw Object.assign(new Error('Empresa inativa'), { status: 400 });
  if (empresa.asaasOnboarded) throw Object.assign(new Error('Empresa já possui split configurado'), { status: 409 });

  // Check email collision before creating subconta
  const existingByEmail = await sql.buscarEmpresaByEmail(email);
  if (existingByEmail && existingByEmail.id !== empresaId) {
    throw Object.assign(new Error('email já utilizado por outra empresa'), { status: 409 });
  }

  // Create subconta in Asaas
  const subconta = await asaasClient.criarSubconta({
    nome: empresa.nome,
    email,
    cpfCnpj,
    phone: empresa.telefone || undefined,
  });

  // Encrypt apiKey before saving
  const encryptedApiKey = encrypt(subconta.apiKey);

  // Save to Empresa
  const updateData = {
    email,
    cpfCnpj,
    pixKey,
    pixKeyType,
    asaasSubcontaId: subconta.id,
    asaasWalletId: subconta.walletId,
    asaasApiKey: encryptedApiKey,
    asaasOnboarded: true,
    asaasCreatedAt: new Date(),
  };

  await sql.atualizarEmpresa(empresaId, updateData);

  // Audit
  auditService.audit({
    action: 'empresa.payment_setup',
    module: 'pagamentos',
    targetType: 'empresa',
    targetId: empresaId,
    after: { email, cpfCnpj, pixKeyType, asaasSubcontaId: subconta.id },
    severity: 'info',
  });

  return { success: true, asaasSubcontaId: subconta.id, walletId: subconta.walletId };
}

/**
 * Get onboarding status for an empresa.
 * Includes last settlement splitStatus + next Monday.
 */
async function getStatus(empresaId, deps = defaultDeps) {
  const { sql, getNextBusinessDay } = deps;

  if (!empresaId) throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });

  const empresa = await sql.buscarEmpresa(empresaId);
  if (!empresa) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
  if (empresa.deletedAt) throw Object.assign(new Error('Empresa inativa'), { status: 400 });

  // Find last settlement
  const { settlements } = await sql.listarSettlements(empresaId, 1, 1);
  const lastSettlement = settlements && settlements.length > 0 ? settlements[0] : null;

  // Next Monday
  const now = new Date();
  const nextMonday = new Date(now);
  const dow = nextMonday.getDay();
  const daysToMonday = dow === 1 ? 7 : (7 - dow + 1) % 7 || 7;
  nextMonday.setDate(nextMonday.getDate() + daysToMonday);
  nextMonday.setHours(0, 0, 0, 0);

  // If next Monday is a holiday, advance to next business day
  const nextTransferDate = getNextBusinessDay(new Date(nextMonday.getTime() - 1));

  return {
    onboarded: empresa.asaasOnboarded,
    pixKeyType: empresa.pixKeyType || null,
    lastSplitStatus: lastSettlement?.splitStatus || null,
    nextTransferDate,
  };
}

/**
 * Update PIX data only for an already onboarded empresa.
 */
async function update(empresaId, { pixKey, pixKeyType }, deps = defaultDeps) {
  const { sql, auditService } = deps;

  if (!empresaId) throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });
  if (!pixKey) throw Object.assign(new Error('pixKey obrigatório'), { status: 400 });
  if (!pixKeyType || !VALID_PIX_KEY_TYPES.includes(pixKeyType)) {
    throw Object.assign(new Error(`pixKeyType inválido. Valores aceitos: ${VALID_PIX_KEY_TYPES.join(', ')}`), { status: 400 });
  }
  if (!validatePixKey(pixKey, pixKeyType)) {
    throw Object.assign(new Error(`pixKey inválido para o tipo "${pixKeyType}"`), { status: 400 });
  }

  const empresa = await sql.buscarEmpresa(empresaId);
  if (!empresa) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
  if (empresa.deletedAt) throw Object.assign(new Error('Empresa inativa'), { status: 400 });
  if (!empresa.asaasOnboarded) throw Object.assign(new Error('Empresa não possui split configurado'), { status: 400 });

  const before = { pixKey: empresa.pixKey, pixKeyType: empresa.pixKeyType };

  await sql.atualizarEmpresa(empresaId, { pixKey, pixKeyType });

  auditService.audit({
    action: 'empresa.payment_updated',
    module: 'pagamentos',
    targetType: 'empresa',
    targetId: empresaId,
    before,
    after: { pixKey, pixKeyType },
    severity: 'info',
  });

  return { success: true };
}

/**
 * Deactivate split for an empresa (clear asaas fields).
 */
async function deactivate(empresaId, deps = defaultDeps) {
  const { sql, auditService } = deps;

  if (!empresaId) throw Object.assign(new Error('empresaId obrigatório'), { status: 400 });

  const empresa = await sql.buscarEmpresa(empresaId);
  if (!empresa) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
  if (empresa.deletedAt) throw Object.assign(new Error('Empresa inativa'), { status: 400 });
  if (!empresa.asaasOnboarded) throw Object.assign(new Error('Empresa não possui split configurado'), { status: 400 });

  await sql.atualizarEmpresa(empresaId, {
    asaasSubcontaId: null,
    asaasWalletId: null,
    asaasApiKey: null,
    asaasOnboarded: false,
    asaasCreatedAt: null,
  });

  auditService.audit({
    action: 'empresa.payment_deactivated',
    module: 'pagamentos',
    targetType: 'empresa',
    targetId: empresaId,
    before: { asaasSubcontaId: empresa.asaasSubcontaId },
    severity: 'info',
  });

  return { success: true };
}

module.exports = { setup, getStatus, update, deactivate, VALID_PIX_KEY_TYPES, validatePixKey };
