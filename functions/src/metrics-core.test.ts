import { describe, expect, it } from 'vitest';
import {
  brightnessFor,
  funnelFromEvents,
  pct,
  returnedOnMultipleDays,
  secondDayCompleters,
} from './metrics-core.js';

describe('brightnessFor', () => {
  it('scales healed count to 0..1 and clamps', () => {
    expect(brightnessFor(0)).toBe(0);
    expect(brightnessFor(5, 10)).toBe(0.5);
    expect(brightnessFor(20, 10)).toBe(1);
  });
});

describe('secondDayCompleters', () => {
  it('counts users active on 2+ distinct days', () => {
    expect(
      secondDayCompleters([
        { distinctActiveDays: 1 },
        { distinctActiveDays: 2 },
        { distinctActiveDays: 5 },
      ]),
    ).toBe(2);
  });
});

describe('funnelFromEvents', () => {
  it('tallies the funnel stages', () => {
    const f = funnelFromEvents([
      { event: 'quest_view' },
      { event: 'quest_view' },
      { event: 'quest_checkin' },
      { event: 'quest_verified' },
      { event: 'echo_create' },
    ]);
    expect(f).toEqual({ viewed: 2, checkedIn: 1, verified: 1 });
  });
});

describe('returnedOnMultipleDays', () => {
  it('counts users who opened on 2+ distinct days', () => {
    const day = (d: string) => new Date(`2026-08-${d}T10:00:00Z`).getTime();
    expect(
      returnedOnMultipleDays([
        { uid: 'a', tsMs: day('01') },
        { uid: 'a', tsMs: day('01') }, // same day — doesn't count twice
        { uid: 'a', tsMs: day('02') }, // second day → a returned
        { uid: 'b', tsMs: day('01') }, // b only one day
      ]),
    ).toBe(1);
  });
});

describe('pct', () => {
  it('rounds a ratio to a percentage, guarding divide-by-zero', () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(0, 0)).toBe(0);
  });
});
