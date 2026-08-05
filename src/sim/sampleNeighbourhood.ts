import type { Fracture } from '@/features/map/types';
import { geohashFor, type LatLng } from '@/lib/geo';

/**
 * Self-contained sample Fractures so the desk map is never empty before the
 * database is seeded (scripts/seed-fractures.ts). These are illustrative, NOT
 * the curated pilot set. Dev samples are active 24h so night suppression never
 * hides them at a desk; real seeded Fractures use real active hours.
 */
export const SIM_CENTRE: LatLng = { lat: 32.0853, lng: 34.7818 };

// Offsets (Δlat, Δlng) from a centre, so the sample can be dropped anywhere —
// e.g. recentred on the developer's real location via the sim "use my location".
const OFFSETS: Array<{ type: Fracture['type']; templateId: string; radiusM: number; dLat: number; dLng: number }> = [
  { type: 'kindness', templateId: 'litter-01', radiusM: 50, dLat: 0.0008, dLng: 0.0004 },
  { type: 'high_tension', templateId: 'breathe-01', radiusM: 60, dLat: -0.0005, dLng: -0.0013 },
  { type: 'coop', templateId: 'coop-01', radiusM: 70, dLat: 0.0013, dLng: 0.0022 },
  { type: 'kindness', templateId: 'greet-01', radiusM: 50, dLat: -0.0013, dLng: 0.0013 },
  { type: 'kindness', templateId: 'echo-01', radiusM: 50, dLat: 0.0019, dLng: -0.0009 },
  { type: 'high_tension', templateId: 'breathe-02', radiusM: 60, dLat: -0.0018, dLng: -0.0003 },
];

/** Build the sample Fracture set around any centre (default: the Tel Aviv area). */
export function makeSampleFractures(centre: LatLng = SIM_CENTRE): Fracture[] {
  return OFFSETS.map((o, i) => {
    const lat = centre.lat + o.dLat;
    const lng = centre.lng + o.dLng;
    return {
      id: `sim-${i + 1}`,
      type: o.type,
      templateId: o.templateId,
      geo: { lat, lng, geohash: geohashFor({ lat, lng }) },
      radiusM: o.radiusM,
      status: 'active',
      neighbourhoodId: 'sim',
      activeHours: { from: 0, to: 24 }, // always visible in dev
    };
  });
}

export const SAMPLE_FRACTURES: Fracture[] = makeSampleFractures();
