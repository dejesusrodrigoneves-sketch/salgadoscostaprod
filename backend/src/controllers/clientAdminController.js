const clientService = require('../services/clientService');
const { asyncHandler } = require('../middleware/errorHandler');
const { getCtx } = require('../middleware/context');

function ctxFrom(req) {
  return {
    requestId: req.context?.requestId,
    ip: req.context?.ip,
    userAgent: req.context?.userAgent,
    path: req.context?.path,
    actor: {
      actorType: 'admin',
      actorId: Number(req.user.id),
      actorUsername: req.user.username,
      actorRole: req.user.role,
    },
  };
}

exports.listar = asyncHandler(async (req, res) => {
  res.json(await clientService.listarClientes());
});

exports.atualizar = asyncHandler(async (req, res) => {
  const { nome, telefone, endereco, numero, bairro, cep, pontoReferencia } = req.body;
  const cliente = await clientService.atualizarCliente(req.params.id, { nome, telefone, endereco, numero, bairro, cep, pontoReferencia }, ctxFrom(req));
  res.json(cliente);
});

exports.resetarSenha = asyncHandler(async (req, res) => {
  const { password } = req.body;
  res.json(await clientService.resetarSenha(req.params.id, password, ctxFrom(req)));
});

exports.deletar = asyncHandler(async (req, res) => {
  res.json(await clientService.deletarCliente(req.params.id, ctxFrom(req)));
});