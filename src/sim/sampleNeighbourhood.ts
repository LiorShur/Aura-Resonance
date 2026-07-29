import type { Fracture } from '@/features/map/types';
import { geohashFor, type LatLng } from '@/lib/geo';

/**
 * A small, self-contained sample so the map is never empty during desk
 * development — even before the emulator is seeded (scripts/seed-fractures.ts).
 * These are illustrative points around a test neighbourhood, NOT the curated
 * pilot set. Real seed locations are hand-checked against satellite imagery per
 * SAFETY.md §5.
 */
export const SIM_CENTRE: LatLng = { lat: 32.0853, lng: 34.7818 };

const raw: Array<Omit<Fracture, 'geo'> & { lat: number; lng: number }> = [
  { id: 'sim-1', type: 'kindness', templateId: 'litter-01', lat: 32.0861, lng: 34.7822, radiusM: 50, status: 'active', neighbourhoodId: 'sim', activeHours: { from: 6, to: 21 } },
  { id: 'sim-2', type: 'high_tension', templateId: 'breathe-01', lat: 32.0848, lng: 34.7805, radiusM: 60, status: 'active', neighbourhoodId: 'sim', activeHours: { from: 6, to: 21 } },
  { id: 'sim-3', type: 'coop', templateId: 'coop-01', lat: 32.0866, lng: 34.7840, radiusM: 70, status: 'active', neighbourhoodId: 'sim', activeHours: { from: 6, to: 21 } },
  { id: 'sim-4', type: 'kindness', templateId: 'greet-01', lat: 32.0840, lng: 34.7831, radiusM: 50, status: 'active', neighbourhoodId: 'sim', activeHours: { from: 6, to: 21 } },
  { id: 'sim-5', type: 'kindness', templateId: 'echo-01', lat: 32.0872, lng: 34.7809, radiusM: 50, status: 'active', neighbourhoodId: 'sim', activeHours: { from: 6, to: 21 } },
  { id: 'sim-6', type: 'high_tension', templateId: 'breathe-02', lat: 32.0835, lng: 34.7815, radiusM: 60, status: 'active', neighbourhoodId: 'sim', activeHours: { from: 6, to: 21 } },
];

export const SAMPLE_FRACTURES: Fracture[] = raw.map(({ lat, lng, ...rest }) => ({
  ...rest,
  geo: { lat, lng, geohash: geohashFor({ lat, lng }) },
}));
