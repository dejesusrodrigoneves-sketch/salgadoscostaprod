// Fuso fixo America/Sao_Paulo (UTC-3, sem DST). Offset em minutos.
export const SAO_PAULO_OFFSET_MIN = -180;

// Retorna o range [start, end) de um dia no fuso de São Paulo,
// e dateKey = Date em UTC-midnight representando a data local (para a coluna DATE).
export function dayRangeSaoPaulo(date) {
  const d = new Date(date);
  const local = new Date(d.getTime() + SAO_PAULO_OFFSET_MIN * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const day = local.getUTCDate();
  const dateKey = new Date(Date.UTC(y, m, day));
  const start = new Date(Date.UTC(y, m, day) - SAO_PAULO_OFFSET_MIN * 60000);
  const end = new Date(Date.UTC(y, m, day + 1) - SAO_PAULO_OFFSET_MIN * 60000);
  return { start, end, dateKey };
}

export function todayDateKey() {
  return dayRangeSaoPaulo(new Date()).dateKey;
}

export default { SAO_PAULO_OFFSET_MIN, dayRangeSaoPaulo, todayDateKey };
