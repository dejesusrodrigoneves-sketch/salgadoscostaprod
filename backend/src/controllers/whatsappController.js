const service = require('../services/whatsappInstanceService');
const whatsapp = require('../services/whatsappService');
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const instancias = await service.listar(req.user.empresaId);
  res.json(instancias);
});

exports.criar = asyncHandler(async (req, res) => {
  const resultado = await service.criar(req.user.empresaId, req.user.role);
  res.status(201).json(resultado);
});

exports.deletar = asyncHandler(async (req, res) => {
  await service.deletar(req.user.empresaId, req.params.id);
  res.json({ success: true });
});

exports.qrCode = asyncHandler(async (req, res) => {
  const resultado = await service.gerarQrCode(req.user.empresaId, req.params.id);
  res.json(resultado);
});

exports.reconectar = asyncHandler(async (req, res) => {
  const resultado = await service.reconectar(req.user.empresaId, req.params.id);
  res.json(resultado);
});

exports.status = asyncHandler(async (req, res) => {
  const resultado = await service.status(req.user.empresaId, req.params.id);
  res.json(resultado);
});

exports.enviarTeste = asyncHandler(async (req, res) => {
  const instancia = await sql.buscarWhatsAppInstance(req.user.empresaId, Number(req.params.id));
  if (!instancia) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }
  if (instancia.connectionStatus !== 'connected' && instancia.connectionStatus !== 'open') {
    return res.status(400).json({ error: 'Instância não está conectada' });
  }
  if (!instancia.phoneNumber) {
    return res.status(400).json({ error: 'Instância não possui número de telefone registrado' });
  }

  const resultado = await whatsapp.enviarMensagemDireta(
    instancia.instanceId,
    instancia.phoneNumber,
    '✅ Mensagem de teste! A integração WhatsApp está funcionando corretamente.'
  );

  res.json({ success: true, message: 'Mensagem de teste enviada', to: instancia.phoneNumber });
});
