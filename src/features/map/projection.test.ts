import { describe, expect, it } from 'vitest';
import { makeProjection } from './projection';
import { distanceM, type LatLng } from '@/lib/geo';

const centre: LatLng = { lat: 32.0853, lng: 34.7818 };

describe('makeProjection', () => {
  const proj = makeProjection(centre, 1200, 600);

  it('places the centre at the middle of the viewport', () => {
    const { x, y } = proj.toXY(centre);
    expect(x).toBeCloseTo(300, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  it('round-trips lat/lng → xy → lat/lng within a metre', () => {
    const p: LatLng = { lat: 32.0861, lng: 34.7831 };
    const back = proj.toLatLng(proj.toXY(p));
    expect(distanceM(p, back)).toBeLessThan(1);
  });

  it('puts north above and east to the right of centre', () => {
    const north = proj.toXY({ lat: centre.lat + 0.001, lng: centre.lng });
    const east = proj.toXY({ lat: centre.lat, lng: centre.lng + 0.001 });
    expect(north.y).toBeLessThan(300); // smaller y is higher on screen
    expect(east.x).toBeGreaterThan(300);
  });
});
