import { describe, it, expect } from 'vitest';
import { dayRangeSaoPaulo } from '../src/utils/financialTime.js';

describe('financialTime', () => {
  it('mapeia um instante para o range do dia em Sao Paulo', () => {
    // 2026-08-26 00:30 UTC => 25/08 21:30 em SP => dateKey 2026-08-25
    const { start, end, dateKey } = dayRangeSaoPaulo(new Date('2026-08-26T00:30:00Z'));
    expect(dateKey.toISOString().slice(0, 10)).toBe('2026-08-25');
    // start = 25/08 00:00 SP = 25/08 03:00 UTC
    expect(start.toISOString()).toBe('2026-08-25T03:00:00.000Z');
    // end = 26/08 00:00 SP = 26/08 03:00 UTC
    expect(end.toISOString()).toBe('2026-08-26T03:00:00.000Z');
  });

  it('20:00 UTC do mesmo dia fica no mesmo dateKey', () => {
    const { dateKey } = dayRangeSaoPaulo(new Date('2026-08-25T20:00:00Z'));
    expect(dateKey.toISOString().slice(0, 10)).toBe('2026-08-25');
  });
});
