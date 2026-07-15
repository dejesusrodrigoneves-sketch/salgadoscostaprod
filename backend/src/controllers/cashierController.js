const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');

exports.hoje = asyncHandler(async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0];
  const caixa = await sql.buscarCaixaHoje(data);
  res.json(caixa || { status: 'fechado', data });
});

exports.abrir = asyncHandler(async (req, res) => {
  const data = new Date().toISOString().split('T')[0];
  const caixa = await sql.criarCaixa({
    empresaId: 1,
    data: new Date(data),
    valorInicial: req.body.valorInicial || 0,
    status: 'aberto',
    abertoEm: new Date(),
  });
  res.status(201).json(caixa);
});

exports.fechar = asyncHandler(async (req, res) => {
  const data = new Date().toISOString().split('T')[0];
  const caixa = await sql.buscarCaixaHoje(data);
  if (!caixa) return res.status(404).json({ error: 'Caixa não encontrado' });
  const body = {
    totalPedidos: Number(req.body.totalPedidos) || 0,
    totalDinheiro: Number(req.body.totalDinheiro) || 0,
    totalPix: Number(req.body.totalPix) || 0,
    totalDebito: Number(req.body.totalDebito) || 0,
    totalCredito: Number(req.body.totalCredito) || 0,
    quantidadePedidos: Number(req.body.quantidadePedidos) || 0,
  };
  const atualizado = await sql.atualizarCaixa(caixa.id, { status: 'fechado', fechadoEm: new Date(), ...body });
  res.json(atualizado);
});

exports.relatorios = asyncHandler(async (req, res) => {
  const { inicio, fim } = req.query;
  const relatorios = await sql.relatoriosCaixa(inicio, fim);
  res.json(relatorios);
});
