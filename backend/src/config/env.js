require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  evolutionUrl: process.env.EVOLUTION_URL,
  evolutionApiKey: process.env.EVOLUTION_API_KEY,
  evolutionInstance: process.env.EVOLUTION_INSTANCE,
  mapboxToken: process.env.MAPBOX_TOKEN,
  graphhopperKey: process.env.GRAPHHOPPER_KEY,
  geoapifyKey: process.env.GEOAPIFY_KEY,
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  asaasAccessToken: process.env.ASAAS_ACCESS_TOKEN,
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
  asaasEnv: process.env.ASAAS_ENV || 'production',
  asaasPixExpiryMin: Number(process.env.ASAAS_PIX_EXPIRY_MIN) || 5,
  asaasPixFeePercent: Number(process.env.ASAAS_PIX_FEE_PERCENT) || 2,
  pedidoRetencaoDias: Number(process.env.PEDIDO_RETENCAO_DIAS) || 30,
  pixEnabled: process.env.PIX_ENABLED === 'true',
};
