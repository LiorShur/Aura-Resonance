import { describe, expect, it } from 'vitest';
import { safeSearchVerdict } from './media-core.js';

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
