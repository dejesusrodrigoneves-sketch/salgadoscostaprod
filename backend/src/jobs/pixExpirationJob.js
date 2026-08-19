const cron = require('node-cron');
const sql = require('../repositories/sqlRepository');
const paymentService = require('../services/paymentService');
const logger = require('../config/logger');
const env = require('../config/env');

let isRunning = false;

async function sincronizarPendentes() {
  if (isRunning) return;
  isRunning = true;
  try {
    const pendentes = await sql.listarPedidosFiltrados({ paymentStatus: 'aguardando_pagamento' });
    for (const pedido of pendentes) {
      try {
        await paymentService.consultarESincronizar(pedido.id);
      } catch (e) {
        logger.error(`Sync PIX falhou pedido ${pedido.id}: ${e.message}`);
      }
    }
  } finally {
    isRunning = false;
  }
}

function iniciarPixExpirationJob() {
  logger.info(`PIX sync job iniciado (cron ${env.pixSyncCron})`);
  cron.schedule(env.pixSyncCron, sincronizarPendentes);
  sincronizarPendentes();
}

module.exports = { iniciarPixExpirationJob };
