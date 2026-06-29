const axios = require('axios');
const config = require('../config/env');
const sql = require('../repositories/sqlRepository');

async function enviarMensagem(empresaId, numero, mensagem) {
  if (!config.evolutionUrl || !config.evolutionApiKey) {
    console.warn('WhatsApp: EVOLUTION_URL ou EVOLUTION_API_KEY não configurados');
    return null;
  }

  const instancia = await sql.buscarInstanciaAtiva(empresaId);
  if (!instancia) {
    console.warn(`WhatsApp: Nenhuma instância ativa para empresa ${empresaId}`);
    return null;
  }

  if (instancia.connectionStatus !== 'connected' && instancia.connectionStatus !== 'open') {
    console.warn(`WhatsApp: Instância da empresa ${empresaId} não está conectada (status: ${instancia.connectionStatus})`);
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
    console.error(`WhatsApp send failed for ${numero} (empresa ${empresaId}):`, err.message);
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
  const { clienteNome, clienteWhatsapp: telefone, id: pedidoId, empresaId } = pedido;
  if (!telefone) return;

  const mensagens = {
    producao: `🍔 Olá ${clienteNome}!\n\nSeu pedido ${pedidoId} entrou em produção.`,
    pronto: `✅ Olá ${clienteNome}!\n\nSeu pedido ${pedidoId} está pronto para retirada.`,
    em_rota: `🚚 Olá ${clienteNome}!\n\nSeu pedido está a caminho!`,
  };

  const msg = mensagens[status];
  if (msg) await enviarMensagem(empresaId, telefone, msg);
}

module.exports = { enviarMensagem, enviarMensagemDireta, notificarStatus };
