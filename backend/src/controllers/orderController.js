const orderService = require('../services/orderService');
const whatsapp = require('../services/whatsappService');
const whatsappInstance = require('../services/whatsappInstanceService');
const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listar = asyncHandler(async (req, res) => {
  const pedidos = await orderService.listarFiltrado(req.query);
  const formatado = pedidos.map(function(p) {
    return {
      ...p,
      cliente: {
        nome: p.clienteNome,
        whatsapp: p.clienteWhatsapp,
        endereco: p.clienteEndereco,
        numero: p.clienteNumero,
        bairro: p.clienteBairro,
        pontoReferencia: p.clienteReferencia
      },
      cep: p.clienteCep,
      valores: {
        itens: p.valoresItens,
        entrega: p.taxasEntrega,
        desconto: p.desconto,
        total: p.total
      },
      taxaCartao: p.taxasCartao,
    };
  });
  res.json(formatado);
});

exports.buscar = asyncHandler(async (req, res) => {
  const pedido = await orderService.buscar(req.params.id);
  res.json(pedido);
});

exports.criar = asyncHandler(async (req, res) => {
  const pedido = await orderService.criar({ ...req.body, empresaId: 1 });
  res.status(201).json(pedido);
});

exports.deletar = asyncHandler(async (req, res) => {
  await orderService.deletarPedido(req.params.id);
  res.json({ success: true });
});

exports.finalizar = asyncHandler(async (req, res) => {
  const pedido = await orderService.finalizarPedido(req.params.id);

  if (pedido.clienteWhatsapp) {
    try {
      const instancia = await whatsappInstance.statusAtivo();
      if (instancia && (instancia.connectionStatus === 'connected' || instancia.connectionStatus === 'open')) {
        await whatsapp.enviarMensagem(pedido.clienteWhatsapp, `🎉 Olá ${pedido.clienteNome}!\n\nSeu pedido ${pedido.id} foi finalizado. Obrigado pela preferência!`);
      }
    } catch (err) {
      console.error('WhatsApp finalizacao failed:', err.message);
    }
  }

  res.json(pedido);
});

exports.atualizarStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status obrigatório' });
  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  const atualizado = await orderService.atualizarStatus(req.params.id, status);

  const mensagens = {
    producao: `🍳 Olá ${pedido.clienteNome}!\n\nSeu pedido ${pedido.id} entrou em produção.`,
    pronto: `Obaaa! ${pedido.clienteNome}, seu pedido ${pedido.id} já está pronto para retirada 🎉`,
    em_rota: `${pedido.clienteNome}, seu pedido já está a caminho da sua casa 🚚💖`,
  };

  if (mensagens[status] && pedido.clienteWhatsapp) {
    try {
      const instancia = await whatsappInstance.statusAtivo();
      if (instancia && (instancia.connectionStatus === 'connected' || instancia.connectionStatus === 'open')) {
        await whatsapp.enviarMensagem(pedido.clienteWhatsapp, mensagens[status]);
      }
    } catch (err) {
      console.error('WhatsApp notification failed:', err.message);
    }
  }

  res.json(atualizado);
});
