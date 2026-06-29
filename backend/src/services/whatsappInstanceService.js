const axios = require('axios');
const sql = require('../repositories/sqlRepository');
const config = require('../config/env');

function buildInstanceName(empresaId) {
  return `loja_${empresaId}`;
}

async function listar(empresaId) {
  return sql.listarWhatsAppInstances(empresaId);
}

async function criar(empresaId, role) {
  const existentes = await sql.listarWhatsAppInstances(empresaId);

  if (role !== 'superadmin' && existentes.length >= 1) {
    throw Object.assign(
      new Error('Cada empresa pode ter apenas 1 instância. Delete a existente para criar uma nova.'),
      { status: 409 }
    );
  }

  const instanceName = buildInstanceName(empresaId);

  const jaExisteMesmoNome = existentes.find(i => i.instanceId === instanceName);
  if (jaExisteMesmoNome) {
    throw Object.assign(
      new Error('Já existe uma instância com este nome para esta empresa.'),
      { status: 409 }
    );
  }

  let evolutionData = null;

  if (config.evolutionUrl && config.evolutionApiKey) {
    try {
      const { data } = await axios.post(
        `${config.evolutionUrl}/instance/create`,
        { instanceName, integration: 'WHATSAPP-BAILEYS' },
        { headers: { apikey: config.evolutionApiKey } }
      );
      evolutionData = data;
    } catch (err) {
      console.error('Evolution API error creating instance:', err.message);
      throw Object.assign(
        new Error(`Evolution API: ${err.response?.data?.message || err.message}`),
        { status: err.response?.status || 502 }
      );
    }
  }

  const instancia = await sql.criarWhatsAppInstance({
    empresaId,
    instanceId: instanceName,
    connectionStatus: evolutionData ? 'qrcode' : 'disconnected',
    qrCode: evolutionData?.qrcode?.pairingCode || null,
    isActive: true,
  });

  return { instancia, evolutionData };
}

async function deletar(empresaId, id) {
  const instancia = await sql.buscarWhatsAppInstance(empresaId, id);
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  if (config.evolutionUrl && config.evolutionApiKey) {
    try {
      await axios.delete(`${config.evolutionUrl}/instance/delete/${instancia.instanceId}`, {
        headers: { apikey: config.evolutionApiKey },
      });
    } catch (err) {
      console.error('Evolution API error deleting instance:', err.message);
    }
  }

  await sql.deletarWhatsAppInstance(id);
}

async function gerarQrCode(empresaId, id) {
  const instancia = await sql.buscarWhatsAppInstance(empresaId, id);
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  if (!config.evolutionUrl || !config.evolutionApiKey) {
    throw Object.assign(new Error('Evolution API não configurada'), { status: 503 });
  }

  const { data } = await axios.get(
    `${config.evolutionUrl}/instance/connect/${instancia.instanceId}`,
    { headers: { apikey: config.evolutionApiKey } }
  );

  if (data?.qrcode?.pairingCode) {
    await sql.atualizarWhatsAppInstance(id, {
      qrCode: data.qrcode.pairingCode,
      connectionStatus: 'qrcode',
    });
  }

  return data;
}

async function reconectar(empresaId, id) {
  const instancia = await sql.buscarWhatsAppInstance(empresaId, id);
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  if (!config.evolutionUrl || !config.evolutionApiKey) {
    throw Object.assign(new Error('Evolution API não configurada'), { status: 503 });
  }

  const { data } = await axios.get(
    `${config.evolutionUrl}/instance/reconnect/${instancia.instanceId}`,
    { headers: { apikey: config.evolutionApiKey } }
  );

  await sql.atualizarWhatsAppInstance(id, { connectionStatus: 'reconnecting' });

  return data;
}

async function status(empresaId, id) {
  const instancia = await sql.buscarWhatsAppInstance(empresaId, id);
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  if (config.evolutionUrl && config.evolutionApiKey) {
    try {
      const { data } = await axios.get(
        `${config.evolutionUrl}/instance/connectionState/${instancia.instanceId}`,
        { headers: { apikey: config.evolutionApiKey } }
      );
      const status = data?.state || 'disconnected';
      const phone = data?.phone?.number || null;
      await sql.atualizarWhatsAppInstance(id, {
        connectionStatus: status,
        ...(phone && { phoneNumber: phone }),
      });
      return { ...instancia, connectionStatus: status, phoneNumber: phone };
    } catch (err) {
      console.error('Evolution API error checking status:', err.message);
    }
  }

  return instancia;
}

module.exports = { listar, criar, deletar, gerarQrCode, reconectar, status };
