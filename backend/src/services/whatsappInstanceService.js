const axios = require('axios');
const QRCode = require('qrcode');
const sql = require('../repositories/sqlRepository');
const config = require('../config/env');
const auditService = require('./auditService');

async function listar(empresaId) {
  const instancias = await sql.listarWhatsAppInstances(empresaId);
  for (const inst of instancias) {
    if (config.evolutionUrl && config.evolutionApiKey) {
      try {
        const { data } = await axios.get(
          `${config.evolutionUrl}/instance/connectionState/${inst.instanceId}`,
          { headers: { apikey: config.evolutionApiKey } }
        );
        const rawStatus = data?.instance?.state || data?.state || 'disconnected';
        const status = rawStatus.toLowerCase();
        if (status !== inst.connectionStatus) {
          await sql.atualizarWhatsAppInstance(inst.id, { connectionStatus: status });
          inst.connectionStatus = status;
        }
      } catch (err) {
        console.error('Evolution API error checking status for ' + inst.instanceId + ':', err.message);
      }
    }
  }
  return sql.listarWhatsAppInstances(empresaId);
}

async function criar(role, instanceName, phoneNumber, empresaId, ctx = {}) {
  if (!empresaId) {
    throw Object.assign(
      new Error('empresaId obrigatório (crie a instância no subdomínio da empresa)'),
      { status: 400 }
    );
  }
  if (!instanceName || !phoneNumber) {
    throw Object.assign(
      new Error('Nome da instância e número de telefone são obrigatórios.'),
      { status: 400 }
    );
  }

  const existentes = await sql.listarWhatsAppInstances(empresaId);

  if (role !== 'superadmin' && existentes.length >= 1) {
    auditService.audit({
      ...ctx,
      action: 'whatsapp.instance_create_failed',
      module: 'whatsapp',
      targetType: 'whatsapp_instance',
      targetId: instanceName,
      severity: 'warning',
      reason: 'limite_uma_instancia',
    });
    throw Object.assign(
      new Error('Já existe uma instância. Delete a existente para criar uma nova.'),
      { status: 409 }
    );
  }

  const jaExisteMesmoNome = existentes.find(i => i.instanceId === instanceName);
  if (jaExisteMesmoNome) {
    auditService.audit({
      ...ctx,
      action: 'whatsapp.instance_create_failed',
      module: 'whatsapp',
      targetType: 'whatsapp_instance',
      targetId: instanceName,
      severity: 'warning',
      reason: 'nome_duplicado',
    });
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
        { instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true, number: phoneNumber },
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
    phoneNumber,
    connectionStatus: evolutionData ? 'qrcode' : 'disconnected',
    qrCode: evolutionData?.qrcode?.code || evolutionData?.qrcode?.pairingCode || null,
    isActive: true,
  });

  auditService.audit({
    ...ctx,
    action: 'whatsapp.instance_create',
    module: 'whatsapp',
    targetType: 'whatsapp_instance',
    targetId: instancia.id,
    after: { instanceId: instancia.instanceId, phoneNumber: instancia.phoneNumber, connectionStatus: instancia.connectionStatus },
    changedFields: ['instanceId', 'phoneNumber', 'connectionStatus'],
  });

  return { instancia, evolutionData };
}

async function deletar(id, empresaId, ctx = {}) {
  const instancia = await sql.buscarWhatsAppInstance(id, empresaId);
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

  auditService.audit({
    ...ctx,
    action: 'whatsapp.instance_delete',
    module: 'whatsapp',
    targetType: 'whatsapp_instance',
    targetId: instancia.id,
    after: { instanceId: instancia.instanceId, connectionStatus: instancia.connectionStatus },
    changedFields: ['instanceId'],
    severity: 'warning',
  });

  await sql.deletarWhatsAppInstance(id, empresaId);
}

async function gerarQrCode(id, empresaId, ctx = {}) {
  const instancia = await sql.buscarWhatsAppInstance(id, empresaId);
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
  } catch (err) {
    auditService.audit({
      ...ctx,
      action: 'whatsapp.qr_gerado',
      module: 'whatsapp',
      targetType: 'whatsapp_instance',
      targetId: instancia.id,
      severity: 'warning',
      reason: 'falha_evolution_api',
      metadata: { error: err.response?.data?.message || err.response?.data?.error || err.message },
    });
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    throw Object.assign(new Error('Evolution API: ' + msg), { status: err.response?.status || 502 });
  }

  let base64 = null;
  let rawCode = null;
  let pairingCode = null;

  if (data && typeof data === 'object') {
    if (data.qrcode) {
      base64 = data.qrcode.base64 || base64;
      rawCode = data.qrcode.code || rawCode;
      pairingCode = data.qrcode.pairingCode || pairingCode;
    }
    base64 = data.base64 || base64;
    rawCode = data.code || rawCode;
    pairingCode = data.pairingCode || pairingCode;
    if (data.instance?.qrcode) {
      base64 = data.instance.qrcode.base64 || base64;
      rawCode = data.instance.qrcode.code || rawCode;
      pairingCode = data.instance.qrcode.pairingCode || pairingCode;
    }
  }

  await sql.atualizarWhatsAppInstance(id, { connectionStatus: 'qrcode' });

  auditService.audit({
    ...ctx,
    action: 'whatsapp.qr_gerado',
    module: 'whatsapp',
    targetType: 'whatsapp_instance',
    targetId: instancia.id,
    after: { connectionStatus: 'qrcode' },
    changedFields: ['connectionStatus'],
  });

  if (base64) {
    return { pairingCode, base64, type: 'image', raw: data };
  }

  if (rawCode) {
    const qrBase64 = await QRCode.toDataURL(rawCode);
    return { pairingCode: null, base64: qrBase64, type: 'image', raw: data };
  }

  if (pairingCode) {
    const qrBase64 = await QRCode.toDataURL(pairingCode);
    await sql.atualizarWhatsAppInstance(id, { qrCode: pairingCode });
    return { pairingCode, base64: qrBase64, type: 'image', raw: data };
  }

  return { pairingCode: null, base64: null, type: null, raw: data };
}

async function reconectar(id, empresaId, ctx = {}) {
  const instancia = await sql.buscarWhatsAppInstance(id, empresaId);
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  if (!config.evolutionUrl || !config.evolutionApiKey) {
    throw Object.assign(new Error('Evolution API não configurada'), { status: 503 });
  }

  const { data } = await axios.get(
    `${config.evolutionUrl}/instance/reconnect/${instancia.instanceId}`,
    { headers: { apikey: config.evolutionApiKey } }
  );

  await sql.atualizarWhatsAppInstance(id, { connectionStatus: 'reconnecting' });

  auditService.audit({
    ...ctx,
    action: 'whatsapp.reconnect',
    module: 'whatsapp',
    targetType: 'whatsapp_instance',
    targetId: instancia.id,
    after: { connectionStatus: 'reconnecting' },
    changedFields: ['connectionStatus'],
  });

  return data;
}

async function status(id, empresaId) {
  const instancia = await sql.buscarWhatsAppInstance(id, empresaId);
  if (!instancia) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  if (config.evolutionUrl && config.evolutionApiKey) {
    try {
      const { data } = await axios.get(
        `${config.evolutionUrl}/instance/connectionState/${instancia.instanceId}`,
        { headers: { apikey: config.evolutionApiKey } }
      );
      const rawStatus = data?.instance?.state || data?.state || 'disconnected';
      const status = rawStatus.toLowerCase();
      const phone = data?.instance?.phone?.number || data?.phone?.number || null;
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

async function statusAtivo(empresaId) {
  if (!empresaId) return null;
  const instancia = await sql.buscarInstanciaAtiva(empresaId);
  if (!instancia) return null;
  return status(instancia.id, empresaId);
}

module.exports = { listar, criar, deletar, gerarQrCode, reconectar, status, statusAtivo };