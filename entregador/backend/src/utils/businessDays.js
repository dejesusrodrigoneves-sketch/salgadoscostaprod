/**
 * Brazilian business days utility.
 * Static holiday table (fixed-date national holidays).
 * Skips weekends (Sat/Sun) + feriados.
 */

const FERIADOS_FIXOS = [
  { month: 1, day: 1, name: 'ANO_NOVO' },
  { month: 4, day: 21, name: 'TIRADENTES' },
  { month: 5, day: 1, name: 'DIA_TRABALHO' },
  { month: 9, day: 7, name: 'INDEPENDENCIA' },
  { month: 10, day: 12, name: 'NOSSA_SENHORA' },
  { month: 11, day: 2, name: 'FINADOS' },
  { month: 11, day: 15, name: 'PROCLAMACAO' },
  { month: 12, day: 25, name: 'NATAL' },
];

/**
 * Check if a date is a Brazilian national holiday (fixed-date only).
 * @param {Date} date
 * @returns {{ is: boolean, name?: string }}
 */
function isFeriado(date) {
  const month = date.getMonth() + 1; // 0-indexed → 1-indexed
  const day = date.getDate();

  for (const h of FERIADOS_FIXOS) {
    if (h.month === month && h.day === day) {
      return { is: true, name: h.name };
    }
  }

  // Carnaval (47 days before Easter) - compute dynamically
  // Easter - 47 = Carnaval Tuesday, -48 = Monday, -49 = Sunday
  const year = date.getFullYear();
  const easter = getEaster(year);
  const carnavalTerca = new Date(easter);
  carnavalTerca.setDate(carnavalTerca.getDate() - 47);

  const carnavalSegunda = new Date(carnavalTerca);
  carnavalSegunda.setDate(carnavalSegunda.getDate() - 1);

  const carnavalDomingo = new Date(carnavalTerca);
  carnavalDomingo.setDate(carnavalDomingo.getDate() - 2);

  const d = new Date(year, month - 1, day);
  if (
    d.getTime() === carnavalDomingo.getTime() ||
    d.getTime() === carnavalSegunda.getTime() ||
    d.getTime() === carnavalTerca.getTime()
  ) {
    return { is: true, name: 'CARNAVAL' };
  }

  return { is: false };
}

/**
 * Get the next business day after the given date.
 * @param {Date} date
 * @returns {Date}
 */
function getNextBusinessDay(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);

  while (true) {
    const dow = next.getDay();
    if (dow !== 0 && dow !== 6) {
      const feriado = isFeriado(next);
      if (!feriado.is) break;
    }
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Compute Easter Sunday for a given year (Anonymous Gregorian algorithm).
 * @param {number} year
 * @returns {Date}
 */
function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

module.exports = { isFeriado, getNextBusinessDay, FERIADOS_FIXOS };
