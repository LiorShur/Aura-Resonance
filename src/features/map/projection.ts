import type { LatLng } from '@/lib/geo';

/**
 * A tiny local equirectangular projection for the schematic sim map. Valid only
 * over a small neighbourhood window (errors are negligible at ≤2 km). This is a
 * stand-in for a real basemap; Mapbox GL replaces it in M2.
 */
export interface Projection {
  size: number; // square viewport, px
  toXY: (p: LatLng) => { x: number; y: number };
  toLatLng: (xy: { x: number; y: number }) => LatLng;
}

const M_PER_DEG_LAT = 111_320;

export function makeProjection(
  centre: LatLng,
  windowM = 1200,
  size = 600,
): Projection {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((centre.lat * Math.PI) / 180);
  const scale = size / windowM; // px per metre
  const half = size / 2;

  const toXY = (p: LatLng) => {
    const east = (p.lng - centre.lng) * mPerDegLng;
    const north = (p.lat - centre.lat) * M_PER_DEG_LAT;
    return { x: half + east * scale, y: half - north * scale };
  };

  const toLatLng = ({ x, y }: { x: number; y: number }) => {
    const east = (x - half) / scale;
    const north = (half - y) / scale;
    return {
      lat: centre.lat + north / M_PER_DEG_LAT,
      lng: centre.lng + east / mPerDegLng,
    };
  };

  return { size, toXY, toLatLng };
}
