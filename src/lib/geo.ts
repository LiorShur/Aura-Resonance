import {
  geohashForLocation,
  geohashQueryBounds,
  type Geopoint,
} from 'geofire-common';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8; // mean Earth radius (IUGG)
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Great-circle distance between two points, in metres (haversine).
 * Accurate to well within the tens-of-metres tolerances this game cares about.
 */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Initial bearing from `a` to `b`, in degrees clockwise from true north
 * (0 = N, 90 = E). Used for the "distance and bearing to Fracture" readout.
 */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Compass point for a bearing, for a human-readable readout. */
export function compassPoint(bearing: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  return points[Math.round(bearing / 45) % 8] as string;
}

export function isWithin(a: LatLng, b: LatLng, radiusM: number): boolean {
  return distanceM(a, b) <= radiusM;
}

const asPoint = (p: LatLng): Geopoint => [p.lat, p.lng];

/** Geohash for a location — the value stored on Fractures/Echoes for range queries. */
export function geohashFor(p: LatLng): string {
  return geohashForLocation(asPoint(p));
}

/**
 * Geohash prefix ranges covering a radius around a centre. Firestore has no
 * radius query, so we query these ranges then distance-filter on the client.
 * Returns `[startInclusive, endInclusive]` string bounds for `orderBy(geohash)`.
 */
export function geohashBounds(centre: LatLng, radiusM: number): [string, string][] {
  return geohashQueryBounds(asPoint(centre), radiusM) as [string, string][];
}

/** Human-readable distance, e.g. "40 m" or "1.2 km". */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}
