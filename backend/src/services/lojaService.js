const sql = require('../repositories/sqlRepository');

function isWorkingDay(workingDays) {
  if (!Array.isArray(workingDays) || workingDays.length === 0) return true;
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const hoje = diasSemana[new Date().getDay()];
  return workingDays.includes(hoje);
}

function isWithinHours(openingTime, closingTime) {
  if (!openingTime || !closingTime) return true;
  const now = new Date();
  const minutos = now.getHours() * 60 + now.getMinutes();
  const [hIni, mIni] = openingTime.split(':').map(Number);
  const [hFim, mFim] = closingTime.split(':').map(Number);
  const inicio = hIni * 60 + mIni;
  const fim = hFim * 60 + mFim;
  return minutos >= inicio && minutos < fim;
}

async function getStatus(slug) {
  const empresa = await sql.buscarEmpresaPorSlug(slug);
  if (!empresa) return { isOpen: false, message: 'Loja não encontrada' };

  const workingDays = Array.isArray(empresa.workingDays) ? empresa.workingDays : [];

  let isOpen;
  if (empresa.manualOverride) {
    isOpen = empresa.isOpen;
  } else {
    isOpen = isWorkingDay(workingDays) && isWithinHours(empresa.openingTime, empresa.closingTime);
  }

  return {
    isOpen,
    openingTime: empresa.openingTime,
    closingTime: empresa.closingTime,
    workingDays,
    manualOverride: empresa.manualOverride,
    message: isOpen
      ? 'Estamos ABERTOS! Faça seu pedido agora.'
      : 'A loja encontra-se fechada no momento.',
  };
}

const DEFAULT_THEME = {
  primaryColor: '#F26D3D',
  backgroundColor: '#FFFAF8',
  surfaceColor: '#FFFFFF',
  textColor: '#2D1A12',
  textMuted: '#7C7C7C',
  successColor: '#4CAF50',
  warningColor: '#F59E0B',
  dangerColor: '#DC2626',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  isDark: false,
  borderRadius: '16px',
  borderRadiusSm: '8px',
  borderRadiusLg: '24px',
};

function parseRawTheme(empresa) {
  if (!empresa.themeSettings) return {};
  return typeof empresa.themeSettings === 'string'
    ? JSON.parse(empresa.themeSettings)
    : empresa.themeSettings;
}

function parseTheme(empresa) {
  return { ...DEFAULT_THEME, ...parseRawTheme(empresa) };
}

function formatImageUrl(img) {
  if (!img) return null;
  if (img.startsWith('http')) return img;
  const base = process.env.SUPABASE_URL;
  if (!base) return null;
  return base + '/storage/v1/object/public/produtos/' + img;
}

function formatEmpresa(empresa) {
  const raw = parseRawTheme(empresa);
  return {
    nome: empresa.nome || '',
    slug: empresa.slug || '',
    logo: empresa.logo || '',
    logoUrl: formatImageUrl(empresa.logo),
    capa: raw.capa || '',
    capaUrl: formatImageUrl(raw.capa),
    bairrosAtendidos: Array.isArray(raw.bairrosAtendidos) ? raw.bairrosAtendidos : [],
    telefone: empresa.telefone || '',
    endereco: empresa.endereco || '',
    numero: empresa.numero || '',
    bairro: empresa.bairro || '',
    cidade: empresa.cidade || '',
    estado: empresa.estado || '',
    cep: empresa.cep || '',
    latitude: empresa.latitude ? Number(empresa.latitude) : null,
    longitude: empresa.longitude ? Number(empresa.longitude) : null,
    descricao: empresa.descricao || '',
    openingTime: empresa.openingTime || '',
    closingTime: empresa.closingTime || '',
    workingDays: Array.isArray(empresa.workingDays) ? empresa.workingDays : [],
    isOpen: empresa.isOpen,
    manualOverride: empresa.manualOverride,
    themeSettings: parseTheme(empresa),
  };
}

async function getSettings() {
  const empresa = await sql.buscarEmpresa(1);
  if (!empresa) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
  return formatEmpresa(empresa);
}

async function updateSettings(data) {
  const allowed = [
    'openingTime', 'closingTime', 'workingDays', 'isOpen', 'manualOverride',
    'nome', 'telefone', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep',
    'latitude', 'longitude', 'descricao', 'logo', 'themeSettings',
  ];
  const payload = {};
  for (const key of allowed) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  // Store capa and bairrosAtendidos inside themeSettings JSON (no migration needed)
  if (data.capa !== undefined || data.bairrosAtendidos !== undefined) {
    const empresa = await sql.buscarEmpresa(1);
    const current = empresa?.themeSettings ? (typeof empresa.themeSettings === 'string' ? JSON.parse(empresa.themeSettings) : empresa.themeSettings) : {};
    if (data.capa !== undefined) current.capa = data.capa;
    if (data.bairrosAtendidos !== undefined) current.bairrosAtendidos = data.bairrosAtendidos;
    payload.themeSettings = current;
  }
  return sql.atualizarEmpresa(1, payload);
}

module.exports = { getStatus, getSettings, updateSettings };
