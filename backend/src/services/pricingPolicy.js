function calcularTaxaEntrega(empresa, bairro, tipoEntrega) {
  if ((tipoEntrega || 'delivery') !== 'delivery') return 0;
  const lista = Array.isArray(empresa?.bairrosAtendidos) ? empresa.bairrosAtendidos : [];
  const alvo = String(bairro || '').trim().toLowerCase();
  const achado = lista.find((b) => String(b.nome || '').trim().toLowerCase() === alvo);
  if (!achado) throw Object.assign(new Error('Bairro não atendido'), { status: 400 });
  return Number(achado.taxa) || 0;
}

function calcularDesconto(percent, base) {
  const p = Number(percent) || 0;
  if (p <= 0) return 0;
  return Number(((Number(base) || 0) * p / 100).toFixed(2));
}

function calcularTaxaCartao(formaPagamento, base) {
  const f = String(formaPagamento || '').toLowerCase();
  const percent = f === 'debito' ? 0.02 : f === 'credito' ? 0.06 : 0;
  return Number(((Number(base) || 0) * percent).toFixed(2));
}

module.exports = { calcularTaxaEntrega, calcularDesconto, calcularTaxaCartao };
