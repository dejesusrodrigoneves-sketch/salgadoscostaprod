const axios = require('axios');
const config = require('../config/env');
const sql = require('../repositories/sqlRepository');

async function enviarMensagem(numero, mensagem) {
  if (!config.evolutionUrl || !config.evolutionApiKey) {
    console.warn('WhatsApp: EVOLUTION_URL ou EVOLUTION_API_KEY não configurados');
    return null;
  }

  const instancia = await sql.buscarInstanciaAtiva();
  if (!instancia) {
    console.warn('WhatsApp: Nenhuma instância ativa');
    return null;
  }

  if (instancia.connectionStatus !== 'connected' && instancia.connectionStatus !== 'open') {
    console.warn(`WhatsApp: Instância não está conectada (status: ${instancia.connectionStatus})`);
    return null;
  }

  try {
    const telefone = numero.replace(/\D/g, '');
    return await axios.post(
      `${config.evolutionUrl}/message/sendText/${instancia.instanceId}`,
      { number: `55${telefone}`, text: mensagem },
      { headers: { apikey: config.evolutionApiKey, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`WhatsApp send failed for ${numero}:`, err.message);
    return null;
  }
}

async function enviarMensagemDireta(instanceId, numero, mensagem) {
  if (!config.evolutionUrl || !config.evolutionApiKey) {
    throw Object.assign(new Error('Evolution API não configurada'), { status: 503 });
  }

  try {
    const telefone = numero.replace(/\D/g, '');
    return await axios.post(
      `${config.evolutionUrl}/message/sendText/${instanceId}`,
      { number: `55${telefone}`, text: mensagem },
      { headers: { apikey: config.evolutionApiKey, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`WhatsApp send failed for ${numero} (instance ${instanceId}):`, err.message);
    throw err;
  }
}

async function notificarStatus(pedido, status) {
  const { clienteNome, clienteWhatsapp: telefone, id: pedidoId } = pedido;
  if (!telefone) return;

  const mensagens = {
    producao: '\uD83C\uDF54 Olá ' + clienteNome + '!\n\nSeu pedido ' + pedidoId + ' entrou em produção.',
    pronto: 'Obaaa! ' + clienteNome + ', seu pedido ' + pedidoId + ' j\u00E1 est\u00E1 pronto para retirada \uD83C\uDF89',
    em_rota: clienteNome + ', seu pedido j\u00E1 est\u00E1 a caminho da sua casa com muito amor e cuidado \uD83D\uDE97\uD83D\uDC95',
    finalizado: '\uD83C\uDF89 Olá ' + clienteNome + '!\n\nSeu pedido ' + pedidoId + ' foi finalizado. Obrigado pela prefer\u00EAncia!',
  };

  const msg = mensagens[status];
  if (msg) await enviarMensagem(telefone, msg);
}

module.exports = { enviarMensagem, enviarMensagemDireta, notificarStatus };
