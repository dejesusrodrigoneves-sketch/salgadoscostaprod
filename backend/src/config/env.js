require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod',
  evolutionUrl: process.env.EVOLUTION_URL,
  evolutionApiKey: process.env.EVOLUTION_API_KEY,
  evolutionInstance: process.env.EVOLUTION_INSTANCE,
  mapboxToken: process.env.MAPBOX_TOKEN,
  graphhopperKey: process.env.GRAPHHOPPER_KEY,
  geoapifyKey: process.env.GEOAPIFY_KEY,
  databaseUrl: process.env.DATABASE_URL,
};
