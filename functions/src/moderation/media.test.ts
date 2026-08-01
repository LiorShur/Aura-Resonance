import { describe, expect, it } from 'vitest';
import { attemptOutcomeForVerdict, safeSearchVerdict, simVerdict } from './media-core.js';

describe('safeSearchVerdict', () => {
  it('passes a clean image', () => {
    expect(safeSearchVerdict({ adult: 'VERY_UNLIKELY', violence: 'UNLIKELY', racy: 'UNLIKELY' })).toEqual({
      status: 'pass',
      labels: [],
    });
  });

  it('blocks adult/violence/racy at LIKELY or above', () => {
    expect(safeSearchVerdict({ adult: 'LIKELY' }).status).toBe('block');
    expect(safeSearchVerdict({ violence: 'VERY_LIKELY' }).status).toBe('block');
    expect(safeSearchVerdict({ racy: 'LIKELY' }).labels).toContain('racy');
  });

  it('flags POSSIBLE but not below', () => {
    expect(safeSearchVerdict({ racy: 'POSSIBLE' }).status).toBe('flag');
    expect(safeSearchVerdict({ adult: 'UNLIKELY' }).status).toBe('pass');
  });

  it('block wins over flag', () => {
    expect(safeSearchVerdict({ adult: 'LIKELY', racy: 'POSSIBLE' }).status).toBe('block');
  });

  it('is safe on missing annotation (defensive pass, moderation happens on real data)', () => {
    expect(safeSearchVerdict(null).status).toBe('pass');
  });
});

describe('attemptOutcomeForVerdict', () => {
  it('pass and flag heal the Fracture', () => {
    expect(attemptOutcomeForVerdict('pass')).toBe('finalize');
    expect(attemptOutcomeForVerdict('flag')).toBe('finalize');
  });

  it('block rejects', () => {
    expect(attemptOutcomeForVerdict('block')).toBe('reject');
  });

  it('an error holds for review — never heals (fail closed)', () => {
    expect(attemptOutcomeForVerdict('error')).toBe('hold');
  });
});

describe('simVerdict (emulator only)', () => {
  it('defaults to a clean pass', () => {
    expect(simVerdict(undefined)).toEqual({ status: 'pass', labels: [] });
  });

  it('exercises the flag and block paths on demand', () => {
    expect(simVerdict('flag').status).toBe('flag');
    expect(simVerdict('block').status).toBe('block');
  });
});
