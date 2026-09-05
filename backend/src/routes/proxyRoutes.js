const { Router } = require('express');
const axios = require('axios');
const config = require('../config/env');
const { asyncHandler } = require('../middleware/errorHandler');
const { proxyLimiter } = require('../middleware/rateLimit');

const router = Router();

const SERVICES = {
  mapbox: { base: 'https://api.mapbox.com', token: config.mapboxToken },
  graphhopper: { base: 'https://graphhopper.com/api/1', token: config.graphhopperKey, param: 'key' },
  geoapify: { base: 'https://api.geoapify.com/v1', token: config.geoapifyKey, param: 'apiKey' },
};

// SSRF prevention: validate path against allowlist per service
const ALLOWED_PATHS = {
  mapbox: [
    '/geocoding/v5/mapbox.places/',
    '/styles/v1/',
    '/static-map/',
  ],
  graphhopper: [
    '/route',
    '/geocode',
    '/isochrone',
  ],
  geoapify: [
    '/geocode/search',
    '/geocode/reverse',
    '/geocode/autocomplete',
    '/routing',
    '/places',
  ],
};

function validatePath(service, path) {
  const allowed = ALLOWED_PATHS[service];
  if (!allowed) return false;
  // Normalize: ensure path starts with / and no protocol injection
  const normalized = path.split('?')[0];
  if (normalized.includes('://') || normalized.includes('\\')) return false;
  return allowed.some(prefix => normalized.startsWith(prefix));
}

router.get('/:service', proxyLimiter, asyncHandler(async (req, res) => {
  const svc = SERVICES[req.params.service];
  if (!svc) return res.status(400).json({ error: 'Serviço não suportado' });
  const path = req.query.path || '';
  if (!validatePath(req.params.service, path)) {
    return res.status(400).json({ error: 'Path não permitido' });
  }
  delete req.query.path;
  const params = { ...req.query };
  params[svc.param || 'access_token'] = svc.token;
  const { data } = await axios.get(`${svc.base}${path}`, { params, timeout: 10000 });
  res.json(data);
}));

router.post('/:service', proxyLimiter, asyncHandler(async (req, res) => {
  const svc = SERVICES[req.params.service];
  if (!svc) return res.status(400).json({ error: 'Serviço não suportado' });
  const path = req.query.path || '';
  if (!validatePath(req.params.service, path)) {
    return res.status(400).json({ error: 'Path não permitido' });
  }
  delete req.query.path;
  const params = { ...req.query };
  params[svc.param || 'access_token'] = svc.token;
  const { data } = await axios.post(`${svc.base}${path}`, req.body, { params, timeout: 10000 });
  res.json(data);
}));

module.exports = router;
