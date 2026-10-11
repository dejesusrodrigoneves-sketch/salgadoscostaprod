// backend/src/jobs/caixaAutoCloseWorker.js (CJS)
// Fecha automaticamente caixas 'aberto' de dias anteriores (rede de segurança).
const cron = require('node-cron');

let cronTask = null;

function start() {
  cronTask = cron.schedule('0 5 * * *', async () => {
    console.log('[CAIXA AUTO-CLOSE] Verificando caixas abertos de dias anteriores...');
    try {
      const result = await executarAutoClose();
      console.log(`[CAIXA AUTO-CLOSE] Concluído: ${result.fechados} fechados, ${result.erros} erros`);
    } catch (err) {
      console.error('[CAIXA AUTO-CLOSE] Erro fatal:', err.message);
    }
  });
  console.log('[CAIXA AUTO-CLOSE] Cron job registrado (diário 05:00)');
}

function stop() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[CAIXA AUTO-CLOSE] Cron job parado');
  }
}

async function executarAutoClose() {
  const { default: prisma } = await import('../config/prisma.js');
  const { default: auditService } = await import('../services/auditService.js');

  const hojeUtc = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');

  const caixas = await prisma.caixaDiario.findMany({
    where: { status: 'aberto', data: { lt: hojeUtc } }
  });

  console.log(`[CAIXA AUTO-CLOSE] ${caixas.length} caixas abertos de dias anteriores encontrados`);

  let fechados = 0;
  let erros = 0;

  for (const caixa of caixas) {
    try {
      const fechadoEm = new Date();
      await prisma.caixaDiario.update({
        where: { id: caixa.id },
        data: { status: 'fechado', fechadoEm }
      });

      auditService.audit({
        empresaId: caixa.empresaId,
        action: 'caixa.auto_close',
        module: 'caixa_auto_close_worker',
        targetType: 'caixa',
        targetId: caixa.id,
        before: { status: caixa.status },
        after: { status: 'fechado', fechadoEm },
        changedFields: ['status', 'fechadoEm'],
        severity: 'warning',
        reason: 'Fecho automático - caixa aberto de dia anterior (05:00)',
      });

      fechados++;
      console.log(`[CAIXA AUTO-CLOSE] Caixa ${caixa.id} (empresa ${caixa.empresaId}, data ${caixa.data.toISOString().split('T')[0]}) fechado`);
    } catch (err) {
      erros++;
      console.error(`[CAIXA AUTO-CLOSE] Caixa ${caixa.id} erro: ${err.message}`);
    }
  }

  return { fechados, erros };
}

module.exports = { start, stop, executarAutoClose };
