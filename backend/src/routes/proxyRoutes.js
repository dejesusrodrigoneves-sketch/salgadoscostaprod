const { Router } = require('express');
const axios = require('axios');
const config = require('../config/env');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

const SERVICES = {
  mapbox: { base: 'https://api.mapbox.com', token: config.mapboxToken },
  graphhopper: { base: 'https://graphhopper.com/api/1', token: config.graphhopperKey, param: 'key' },
  geoapify: { base: 'https://api.geoapify.com/v1', token: config.geoapifyKey, param: 'apiKey' },
};

router.get('/:service', asyncHandler(async (req, res) => {
  const svc = SERVICES[req.params.service];
  if (!svc) return res.status(400).json({ error: 'Serviço não suportado' });
  const path = req.query.path || '';
  delete req.query.path;
  const params = { ...req.query };
  params[svc.param || 'access_token'] = svc.token;
  const { data } = await axios.get(`${svc.base}${path}`, { params, timeout: 10000 });
  res.json(data);
}));

router.post('/:service', asyncHandler(async (req, res) => {
  const svc = SERVICES[req.params.service];
  if (!svc) return res.status(400).json({ error: 'Serviço não suportado' });
  const path = req.query.path || '';
  delete req.query.path;
  const params = { ...req.query };
  params[svc.param || 'access_token'] = svc.token;
  const { data } = await axios.post(`${svc.base}${path}`, req.body, { params, timeout: 10000 });
  res.json(data);
}));

module.exports = router;
