const axios = require('axios');
const config = require('../config/env');

async function geocode(endereco) {
  const { data } = await axios.get('https://api.geoapify.com/v1/geocode/search', {
    params: { text: endereco, apiKey: config.geoapifyKey, limit: 1 },
  });
  if (!data.features?.length) return null;
  const { lat, lon } = data.features[0].properties;
  return { lat, lon };
}

async function rota(origem, destino) {
  const { data } = await axios.get('https://graphhopper.com/api/1/route', {
    params: {
      point: [`${origem.lat},${origem.lng}`, `${destino.lat},${destino.lng}`],
      vehicle: 'car',
      locale: 'pt-BR',
      instructions: true,
      key: config.graphhopperKey,
    },
  });
  return data;
}

module.exports = { geocode, rota };
