// backend/src/services/subscriptionCycle.js (ESM)
// Regras puras do ciclo mensal: abre dia 1, vence dia 10. Sem I/O.
const DUE_DAY = 10;
const OPEN_DAY = 1;
const INTEREST_RATE_DAILY = 0.01;

function utcMidnight(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function mesRefOf(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayOfMonth(year, monthIndex, day) {
  // monthIndex é 0-based; Date normaliza overflow de mês/ano
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
}

export function firstDueDate(signup) {
  const d = new Date(signup);
  return dayOfMonth(d.getUTCFullYear(), d.getUTCMonth() + 1, DUE_DAY);
}

export function nextDueAfterPayment(paidAt) {
  const d = new Date(paidAt);
  return dayOfMonth(d.getUTCFullYear(), d.getUTCMonth() + 1, DUE_DAY);
}

export function cycleOpenAt(dueDate) {
  const d = new Date(dueDate);
  return dayOfMonth(d.getUTCFullYear(), d.getUTCMonth(), OPEN_DAY);
}

export function computeBreakdown({ base, valorPorFilial, nFiliais }) {
  const b = Number(base) || 0;
  const x = Number(valorPorFilial) || 0;
  const n = Number(nFiliais) || 0;
  const filialTotal = round2(x * n);
  return { base: b, valorPorFilial: x, nFiliais: n, filialTotal, total: round2(b + filialTotal) };
}

export function daysOverdue(dueDate, now = new Date()) {
  if (!dueDate) return 0;
  const due = utcMidnight(dueDate);
  const ref = utcMidnight(now);
  if (ref <= due) return 0;
  return Math.floor((ref - due) / (1000 * 60 * 60 * 24));
}

function round2(v) { return Math.round(Number(v) * 100) / 100; }

export function interestFor(base, days) {
  if (!Number(base) || !Number(days) || days <= 0) return 0;
  return round2(Number(base) * INTEREST_RATE_DAILY * Number(days));
}

export function canPay({ now = new Date(), dueDate, hasPaidCurrentCycle }) {
  if (hasPaidCurrentCycle) return { canPay: false, reason: 'mes_pago' };
  if (!dueDate) return { canPay: false, reason: 'ciclo_fechado' };
  const open = cycleOpenAt(dueDate);
  if (utcMidnight(now) < open) return { canPay: false, reason: 'ciclo_fechado' };
  return { canPay: true, reason: null };
}

export default { mesRefOf, firstDueDate, nextDueAfterPayment, cycleOpenAt, computeBreakdown, daysOverdue, interestFor, canPay };
