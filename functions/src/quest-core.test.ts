import { describe, expect, it } from 'vitest';
import {
  computeAward,
  computeLevel,
  dayKey,
  DEFAULT_DAILY_RP_CAP,
  evaluateCheckIn,
} from './quest-core.js';
import { distanceM } from './geo.js';

describe('distanceM (server)', () => {
  it('matches ~111 m per 0.001° latitude', () => {
    expect(distanceM({ lat: 32.0853, lng: 34.7818 }, { lat: 32.0863, lng: 34.7818 })).toBeCloseTo(111.2, 0);
  });
});

describe('evaluateCheckIn', () => {
  const geo = { lat: 32.0853, lng: 34.7818 };

  it('accepts a position inside the radius', () => {
    const ev = evaluateCheckIn(geo, 50, { lat: 32.08532, lng: 34.7818 });
    expect(ev.withinRange).toBe(true);
    expect(ev.remainingM).toBe(0);
  });

  it('rejects a position outside the radius and reports how far to go', () => {
    const ev = evaluateCheckIn(geo, 50, { lat: 32.0863, lng: 34.7818 }); // ~111 m
    expect(ev.withinRange).toBe(false);
    expect(ev.distanceM).toBeGreaterThan(100);
    expect(ev.remainingM).toBeGreaterThan(50);
  });
});

describe('computeAward — daily cap', () => {
  it('awards the full reward with room to spare', () => {
    expect(computeAward(30, DEFAULT_DAILY_RP_CAP, 0)).toBe(30);
  });

  it('caps a reward that would exceed the daily limit', () => {
    expect(computeAward(30, 200, 190)).toBe(10);
  });

  it('awards nothing once the cap is reached', () => {
    expect(computeAward(30, 200, 200)).toBe(0);
    expect(computeAward(30, 200, 250)).toBe(0);
  });
});

describe('computeLevel', () => {
  it('maps cumulative points to a level', () => {
    expect(computeLevel(0)).toBe(1);
    expect(computeLevel(99)).toBe(1);
    expect(computeLevel(100)).toBe(2);
    expect(computeLevel(500)).toBe(4);
  });
});

describe('dayKey', () => {
  it('is a stable UTC date string', () => {
    expect(dayKey(new Date('2026-07-31T23:59:00Z'))).toBe('2026-07-31');
  });
});
