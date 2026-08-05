import { describe, expect, it } from 'vitest';
import { computeAge, meetsMinimumAge, MIN_AGE } from './age';

const NOW = new Date('2026-07-31T12:00:00Z');

describe('computeAge', () => {
  it('computes whole years', () => {
    expect(computeAge('2000-01-01', NOW)).toBe(26);
    expect(computeAge('2010-07-31', NOW)).toBe(16);
  });

  it('does not count an un-reached birthday this year', () => {
    expect(computeAge('2010-08-01', NOW)).toBe(15); // birthday is tomorrow
  });

  it('rejects malformed and impossible dates', () => {
    expect(computeAge('not-a-date', NOW)).toBeNull();
    expect(computeAge('2020-02-31', NOW)).toBeNull();
    expect(computeAge('2026-13-01', NOW)).toBeNull();
  });

  it('rejects future dates', () => {
    expect(computeAge('2030-01-01', NOW)).toBeNull();
  });
});

describe('meetsMinimumAge', () => {
  it('gates exactly at the boundary', () => {
    expect(MIN_AGE).toBe(16);
    expect(meetsMinimumAge('2010-07-31', NOW)).toBe(true); // turns 16 today
    expect(meetsMinimumAge('2010-08-01', NOW)).toBe(false); // 15 until tomorrow
  });

  it('is false for unparseable input', () => {
    expect(meetsMinimumAge('', NOW)).toBe(false);
  });
});
