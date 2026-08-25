const cron = require('node-cron');
const settlementService = require('../services/settlementService');
const sql = require('../repositories/sqlRepository');
const auditService = require('../services/auditService');

async function processarTodasEmpresas() {
  const empresas = await sql.listarEmpresasAtivas();
  let processadas = 0;
  let erros = 0;

  for (const emp of empresas) {
    try {
      const result = await settlementService.fecharSemana(emp.id);
      if (result) processadas++;
    } catch (err) {
      erros++;
      auditService.audit({
        action: 'settlement.error',
        module: 'settlements',
        targetType: 'empresa',
        targetId: emp.id,
        severity: 'error',
        reason: err.message,
      });
    }
  }

  auditService.audit({
    action: 'settlement.batch_complete',
    module: 'settlements',
    severity: 'info',
    metadata: { processadas, erros, total: empresas.length },
  });

  return { processadas, erros };
}

async function catchUp() {
  const now = new Date();
  const day = now.getDay();
  if (day === 1) {
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    const { weekStart } = settlementService.getWeekRange(lastWeek);
    const empresas = await sql.listarEmpresasAtivas();
    for (const emp of empresas) {
      const existing = await sql.buscarSettlementActual(emp.id, weekStart);
      if (!existing) {
        await settlementService.fecharSemana(emp.id, lastWeek);
      }
    }
  }
}

function start() {
  cron.schedule('0 0 * * 6', async () => {
    console.log('[SETTLEMENT] Iniciando processamento semanal...');
    const result = await processarTodasEmpresas();
    console.log('[SETTLEMENT] Concluido: ' + result.processadas + ' ok, ' + result.erros + ' erros');
  });

  catchUp().catch(err => {
    console.error('[SETTLEMENT] Catch-up error:', err.message);
  });

  console.log('[SETTLEMENT] Cron job registrado ( sab 00:00)');
}

module.exports = { start, processarTodasEmpresas, catchUp };
