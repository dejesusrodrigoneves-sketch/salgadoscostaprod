import { describe, it, expect } from 'vitest';
import { isFeriado, getNextBusinessDay, FERIADOS_FIXOS } from '../src/utils/businessDays.js';

describe('isFeriado', () => {
  it('ANO_NOVO Jan 1', () => {
    expect(isFeriado(new Date(2025, 0, 1)).is).toBe(true);
    expect(isFeriado(new Date(2025, 0, 1)).name).toBe('ANO_NOVO');
  });

  it('TIRADENTES Apr 21', () => {
    expect(isFeriado(new Date(2025, 3, 21)).is).toBe(true);
    expect(isFeriado(new Date(2025, 3, 21)).name).toBe('TIRADENTES');
  });

  it('DIA_TRABALHO May 1', () => {
    expect(isFeriado(new Date(2025, 4, 1)).is).toBe(true);
  });

  it('INDEPENDENCIA Sep 7', () => {
    expect(isFeriado(new Date(2025, 8, 7)).is).toBe(true);
  });

  it('NOSSA_SENHORA Oct 12', () => {
    expect(isFeriado(new Date(2025, 9, 12)).is).toBe(true);
  });

  it('FINADOS Nov 2', () => {
    expect(isFeriado(new Date(2025, 10, 2)).is).toBe(true);
  });

  it('PROCLAMACAO Nov 15', () => {
    expect(isFeriado(new Date(2025, 10, 15)).is).toBe(true);
  });

  it('NATAL Dec 25', () => {
    expect(isFeriado(new Date(2025, 11, 25)).is).toBe(true);
  });

  it('regular weekday is not feriado', () => {
    expect(isFeriado(new Date(2025, 0, 2)).is).toBe(false); // Jan 2, Thursday
  });

  it('CARNAVAL 2025 Monday', () => {
    // Easter 2025 = Apr 20. Carnaval = Apr 20 - 47 = Mar 4 (Tuesday).
    // Carnaval Sunday = Mar 2, Monday = Mar 3
    const result = isFeriado(new Date(2025, 2, 3)); // Mar 3 Monday
    expect(result.is).toBe(true);
    expect(result.name).toBe('CARNAVAL');
  });

  it('CARNAVAL Sunday 2025', () => {
    const result = isFeriado(new Date(2025, 2, 2)); // Mar 2 Sunday
    expect(result.is).toBe(true);
    expect(result.name).toBe('CARNAVAL');
  });
});

describe('getNextBusinessDay', () => {
  it('skips weekend to Monday', () => {
    // Friday Jan 10, 2025
    const fri = new Date(2025, 0, 10);
    const next = getNextBusinessDay(fri);
    expect(next.getDay()).toBe(1); // Monday
    expect(next.getDate()).toBe(13);
  });

  it('skips Saturday to Monday', () => {
    const sat = new Date(2025, 0, 11);
    const next = getNextBusinessDay(sat);
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(13);
  });

  it('skips Sunday to Monday', () => {
    const sun = new Date(2025, 0, 12);
    const next = getNextBusinessDay(sun);
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(13);
  });

  it('skips holiday', () => {
    // Jan 1 2025 (ANO_NOVO, Wednesday)
    const wed = new Date(2025, 0, 1);
    const next = getNextBusinessDay(wed);
    expect(next.getDate()).toBe(2); // Jan 2 Thursday
    expect(next.getDay()).toBe(4); // Thursday
  });

  it('skips holiday on Friday → Monday', () => {
    // Apr 21 2025 (TIRADENTES, Monday)
    const mon = new Date(2025, 3, 21);
    const next = getNextBusinessDay(mon);
    expect(next.getDate()).toBe(22); // Tuesday
    expect(next.getDay()).toBe(2);
  });
});

describe('FERIADOS_FIXOS', () => {
  it('has 8 fixed holidays', () => {
    expect(FERIADOS_FIXOS).toHaveLength(8);
  });

  it('all entries have month, day, name', () => {
    for (const h of FERIADOS_FIXOS) {
      expect(h.month).toBeGreaterThanOrEqual(1);
      expect(h.month).toBeLessThanOrEqual(12);
      expect(h.day).toBeGreaterThanOrEqual(1);
      expect(h.day).toBeLessThanOrEqual(31);
      expect(typeof h.name).toBe('string');
    }
  });
});
