const cron = require('node-cron');
const sql = require('../repositories/sqlRepository');
const prisma = require('../config/prisma');
const paymentService = require('../services/paymentService');
const logger = require('../config/logger');
const env = require('../config/env');

let isRunning = false;
let cronTask = null;

async function sincronizarPendentes() {
  if (isRunning) return;
  isRunning = true;
  try {
    const empresas = await prisma.empresa.findMany({ select: { id: true } });
    for (const emp of empresas) {
      const pendentes = await sql.listarPedidosFiltrados(emp.id, { paymentStatus: 'aguardando_pagamento' });
      for (const pedido of pendentes) {
        try {
          await paymentService.consultarESincronizar(pedido.id);
        } catch (e) {
          logger.error(`Sync PIX falhou pedido ${pedido.id}: ${e.message}`);
        }
      }
    }
  } finally {
    isRunning = false;
  }
}

function iniciarPixExpirationJob() {
  logger.info(`PIX sync job iniciado (cron ${env.pixSyncCron})`);
  cronTask = cron.schedule(env.pixSyncCron, sincronizarPendentes);
  sincronizarPendentes();
}

function stop() {
  if (cronTask) { cronTask.stop(); cronTask = null; logger.info('PIX sync job parado'); }
}

module.exports = { iniciarPixExpirationJob, stop };
