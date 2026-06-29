const sql = require('../repositories/sqlRepository');
const { asyncHandler } = require('../middleware/errorHandler');

exports.hoje = asyncHandler(async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0];
  const caixa = await sql.buscarCaixaHoje(req.user.empresaId, data);
  res.json(caixa || { status: 'fechado', data });
});

exports.abrir = asyncHandler(async (req, res) => {
  const data = new Date().toISOString().split('T')[0];
  const caixa = await sql.criarCaixa({
    empresaId: req.user.empresaId,
    data: new Date(data),
    valorInicial: req.body.valorInicial || 0,
    status: 'aberto',
    abertoEm: new Date(),
  });
  res.status(201).json(caixa);
});

exports.fechar = asyncHandler(async (req, res) => {
  const data = new Date().toISOString().split('T')[0];
  const caixa = await sql.buscarCaixaHoje(req.user.empresaId, data);
  if (!caixa) return res.status(404).json({ error: 'Caixa não encontrado' });
  const atualizado = await sql.atualizarCaixa(caixa.id, { status: 'fechado', fechadoEm: new Date(), ...req.body });
  res.json(atualizado);
});

exports.relatorios = asyncHandler(async (req, res) => {
  const { inicio, fim } = req.query;
  const relatorios = await sql.relatoriosCaixa(req.user.empresaId, inicio, fim);
  res.json(relatorios);
});
