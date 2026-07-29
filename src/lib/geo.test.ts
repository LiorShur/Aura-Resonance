import { describe, expect, it } from 'vitest';
import {
  bearingDeg,
  compassPoint,
  distanceM,
  formatDistance,
  geohashBounds,
  geohashFor,
  isWithin,
  type LatLng,
} from './geo';

// Reference points around a test neighbourhood (Tel Aviv, ~arbitrary public spots).
const A: LatLng = { lat: 32.0853, lng: 34.7818 };
const B: LatLng = { lat: 32.0863, lng: 34.7818 }; // ~111 m due north

describe('distanceM', () => {
  it('is zero for identical points', () => {
    expect(distanceM(A, A)).toBe(0);
  });

  it('matches a known north-south delta (~111 m per 0.001° lat)', () => {
    // 0.001 degrees of latitude ≈ 111.19 m anywhere on Earth.
    expect(distanceM(A, B)).toBeCloseTo(111.2, 0);
  });

  it('is symmetric', () => {
    expect(distanceM(A, B)).toBeCloseTo(distanceM(B, A), 6);
  });

  it('matches a longer known distance (Tel Aviv → Jerusalem ≈ 54 km)', () => {
    const jerusalem: LatLng = { lat: 31.7683, lng: 35.2137 };
    const d = distanceM(A, jerusalem) / 1000;
    expect(d).toBeGreaterThan(52);
    expect(d).toBeLessThan(56);
  });
});

describe('bearingDeg', () => {
  it('reads ~0° (north) for a due-north target', () => {
    expect(bearingDeg(A, B)).toBeCloseTo(0, 0);
  });

  it('reads ~90° (east) for a due-east target', () => {
    const east: LatLng = { lat: A.lat, lng: A.lng + 0.001 };
    expect(bearingDeg(A, east)).toBeCloseTo(90, 0);
  });

  it('stays within [0, 360)', () => {
    const west: LatLng = { lat: A.lat, lng: A.lng - 0.001 };
    const bearing = bearingDeg(A, west);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
    expect(bearing).toBeCloseTo(270, 0);
  });
});

describe('compassPoint', () => {
  it('maps cardinal bearings', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(360)).toBe('N');
  });
});

describe('isWithin', () => {
  it('respects the radius boundary', () => {
    expect(isWithin(A, B, 200)).toBe(true);
    expect(isWithin(A, B, 50)).toBe(false);
  });
});

describe('geohash helpers', () => {
  it('produces a stable geohash string', () => {
    const hash = geohashFor(A);
    expect(hash).toMatch(/^[0-9b-hjkmnp-z]+$/);
    expect(geohashFor(A)).toBe(hash);
  });

  it('nearby points share a geohash prefix', () => {
    expect(geohashFor(A).slice(0, 5)).toBe(geohashFor(B).slice(0, 5));
  });

  it('returns non-empty query bounds covering a radius', () => {
    const bounds = geohashBounds(A, 2000);
    expect(bounds.length).toBeGreaterThan(0);
    for (const [start, end] of bounds) {
      expect(typeof start).toBe('string');
      expect(start <= end).toBe(true);
    }
  });
});

describe('formatDistance', () => {
  it('formats metres and kilometres', () => {
    expect(formatDistance(40)).toBe('40 m');
    expect(formatDistance(1200)).toBe('1.2 km');
    expect(formatDistance(54000)).toBe('54 km');
  });
});
