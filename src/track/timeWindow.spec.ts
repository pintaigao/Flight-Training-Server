import { isChicagoMorning } from './timeWindow';

describe('isChicagoMorning', () => {
  it('includes 06:00 and excludes 12:00 (America/Chicago)', () => {
    expect(isChicagoMorning('2026-01-15T12:00:00Z')).toBe(true); // 06:00 CST
    expect(isChicagoMorning('2026-01-15T17:59:00Z')).toBe(true); // 11:59 CST
    expect(isChicagoMorning('2026-01-15T18:00:00Z')).toBe(false); // 12:00 CST
    expect(isChicagoMorning('2026-01-15T11:59:00Z')).toBe(false); // 05:59 CST
  });
});

