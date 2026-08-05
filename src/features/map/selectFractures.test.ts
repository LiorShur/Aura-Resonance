import { describe, expect, it } from 'vitest';
import { selectVisibleFractures } from './selectFractures';
import { geohashFor, type LatLng } from '@/lib/geo';
import type { Fracture } from './types';

const CENTRE: LatLng = { lat: 32.0853, lng: 34.7818 };

function frac(id: string, lat: number, lng: number, activeHours = { from: 0, to: 24 }): Fracture {
  return {
    id,
    type: 'kindness',
    templateId: 't',
    geo: { lat, lng, geohash: geohashFor({ lat, lng }) },
    radiusM: 50,
    status: 'active',
    neighbourhoodId: 'sim',
    activeHours,
  };
}

// Noon: inside a 06–21 window, outside a 21–06 window.
const NOON = new Date('2026-07-31T12:00:00');

describe('selectVisibleFractures', () => {
  const near = frac('near', 32.0854, 34.7819); // ~15 m
  const mid = frac('mid', 32.0862, 34.7818); // ~100 m
  const far = frac('far', 32.0953, 34.7818); // ~1.1 km
  const all = [far, near, mid];

  it('includes only fractures within the radius, nearest first', () => {
    const r = selectVisibleFractures(all, CENTRE, 200, NOON);
    expect(r.map((x) => x.fracture.id)).toEqual(['near', 'mid']);
    expect(r[0]!.distanceM).toBeLessThan(r[1]!.distanceM);
  });

  it('lets fractures enter and leave range as the player moves', () => {
    const tight = selectVisibleFractures(all, CENTRE, 50, NOON);
    expect(tight.map((x) => x.fracture.id)).toEqual(['near']);

    // Move ~1.1 km north toward `far` — it enters range, `near`/`mid` leave.
    const moved: LatLng = { lat: 32.0953, lng: 34.7818 };
    const after = selectVisibleFractures(all, moved, 60, NOON);
    expect(after.map((x) => x.fracture.id)).toEqual(['far']);
  });

  it('suppresses fractures outside their active hours (local time)', () => {
    const daytimeOnly = frac('day', 32.0854, 34.7819, { from: 6, to: 21 });
    const midnight = new Date('2026-07-31T23:30:00');
    expect(selectVisibleFractures([daytimeOnly], CENTRE, 200, NOON)).toHaveLength(1);
    expect(selectVisibleFractures([daytimeOnly], CENTRE, 200, midnight)).toHaveLength(0);
  });

  it('excludes non-active statuses', () => {
    const healed: Fracture = { ...near, id: 'healed', status: 'healed' };
    const r = selectVisibleFractures([healed], CENTRE, 200, NOON);
    expect(r).toHaveLength(0);
  });

  it('ignoreNight (sim desk override) shows a night-suppressed fracture but still hides healed ones', () => {
    const daytimeOnly = frac('day', 32.0854, 34.7819, { from: 6, to: 21 });
    const midnight = new Date('2026-07-31T23:30:00');
    // Suppressed at night normally…
    expect(selectVisibleFractures([daytimeOnly], CENTRE, 200, midnight)).toHaveLength(0);
    // …but visible with the desk override.
    expect(selectVisibleFractures([daytimeOnly], CENTRE, 200, midnight, true)).toHaveLength(1);
    // The override does not resurrect a healed Fracture.
    const healed: Fracture = { ...daytimeOnly, id: 'healed', status: 'healed' };
    expect(selectVisibleFractures([healed], CENTRE, 200, midnight, true)).toHaveLength(0);
  });
});
