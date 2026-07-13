const axios = require('axios');
const QRCode = require('qrcode');
const sql = require('../repositories/sqlRepository');
const config = require('../config/env');

function buildInstanceName() {
  return 'loja_1';
}

async function listar() {
  return sql.listarWhatsAppInstances();
}

async function criar(role) {
  const existentes = await sql.listarWhatsAppInstances();

  if (role !== 'superadmin' && existentes.length >= 1) {
    throw Object.assign(
      new Error('Já existe uma instância. Delete a existente para criar uma nova.'),
      { status: 409 }
    );
  }

  const instanceName = buildInstanceName();

  const jaExisteMesmoNome = existentes.find(i => i.instanceId === instanceName);
  if (jaExisteMesmoNome) {
    throw Object.assign(
      new Error('Já existe uma instância com este nome.'),
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
    empresaId: 1,
    instanceId: instanceName,
    connectionStatus: evolutionData ? 'qrcode' : 'disconnected',
    qrCode: evolutionData?.qrcode?.pairingCode || null,
    isActive: true,
  });

  return { instancia, evolutionData };
}

async function deletar(id) {
  const instancia = await sql.buscarWhatsAppInstance(id);
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

async function gerarQrCode(id) {
  const instancia = await sql.buscarWhatsAppInstance(id);
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  if (!config.evolutionUrl || !config.evolutionApiKey) {
    throw Object.assign(new Error('Evolution API não configurada'), { status: 503 });
  }

  let data;
  try {
    const response = await axios.get(
      `${config.evolutionUrl}/instance/connect/${instancia.instanceId}`,
      { headers: { apikey: config.evolutionApiKey } }
    );
    data = response.data;
    console.log('[QR debug] Evolution /connect response:', JSON.stringify(data, null, 2));
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    throw Object.assign(new Error('Evolution API: ' + msg), { status: err.response?.status || 502 });
  }

  let pairingCode = null;
  let base64 = null;

  if (data && typeof data === 'object') {
    if (data.qrcode) {
      pairingCode = data.qrcode.pairingCode || data.qrcode.code || pairingCode;
      base64 = data.qrcode.base64 || base64;
    }
    pairingCode = data.pairingCode || data.code || pairingCode;
    base64 = data.base64 || base64;
    if (data.instance?.qrcode) {
      pairingCode = data.instance.qrcode.pairingCode || data.instance.qrcode.code || pairingCode;
      base64 = data.instance.qrcode.base64 || base64;
    }
  }

  if (base64) {
    await sql.atualizarWhatsAppInstance(id, { connectionStatus: 'qrcode' });
    return { pairingCode, base64, type: 'image', raw: data };
  }

  if (pairingCode) {
    await sql.atualizarWhatsAppInstance(id, {
      qrCode: pairingCode,
      connectionStatus: 'qrcode',
    });
    const qrBase64 = await QRCode.toDataURL(pairingCode);
    return { pairingCode, base64: qrBase64, type: 'image', raw: data };
  }

  return { pairingCode: null, base64: null, type: null, raw: data };
}

async function reconectar(id) {
  const instancia = await sql.buscarWhatsAppInstance(id);
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

async function status(id) {
  const instancia = await sql.buscarWhatsAppInstance(id);
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
