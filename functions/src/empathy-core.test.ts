import { describe, expect, it } from 'vitest';
import {
  adviserAward,
  DILEMMA_MAX,
  DILEMMA_MIN,
  validateAdvice,
  validateDilemma,
} from './empathy-core.js';

const body = (n: number) => 'x'.repeat(n);

describe('validateDilemma', () => {
  it('accepts an in-range body with a known category', () => {
    expect(validateDilemma(body(DILEMMA_MIN), 'work')).toEqual({ ok: true });
  });

  it('rejects too short / too long / unknown category', () => {
    expect(validateDilemma(body(DILEMMA_MIN - 1), 'work').reason).toBe('too-short');
    expect(validateDilemma(body(DILEMMA_MAX + 1), 'work').reason).toBe('too-long');
    expect(validateDilemma(body(200), 'nonsense').reason).toBe('bad-category');
  });

  it('counts trimmed length (whitespace padding does not pad the minimum)', () => {
    expect(validateDilemma('   ' + body(50) + '   ', 'work').reason).toBe('too-short');
  });
});

describe('validateAdvice', () => {
  it('accepts a reasonable message, rejects empty and overly long', () => {
    expect(validateAdvice('That sounds really hard. Hang in there.')).toEqual({ ok: true });
    expect(validateAdvice('ok').reason).toBe('too-short');
    expect(validateAdvice('x'.repeat(601)).reason).toBe('too-long');
  });
});

describe('adviserAward', () => {
  it('pays only for genuinely helpful advice, scaling with rating', () => {
    expect(adviserAward(1)).toBe(0);
    expect(adviserAward(2)).toBe(0);
    expect(adviserAward(3)).toBe(4);
    expect(adviserAward(5)).toBe(12);
    expect(adviserAward(0)).toBe(0);
    expect(adviserAward(99)).toBe(0);
  });
});
