import type { LatLng } from '@/lib/geo';

export type FractureType = 'kindness' | 'high_tension' | 'coop';
export type FractureStatus = 'active' | 'healing' | 'healed' | 'suppressed';

/**
 * Client-side view of a Fracture. Mirrors the `fractures/{id}` document in
 * docs/SCHEMA.md, minus server-only bookkeeping the map does not need.
 */
export interface Fracture {
  id: string;
  type: FractureType;
  templateId: string;
  geo: LatLng & { geohash: string };
  radiusM: number;
  status: FractureStatus;
  neighbourhoodId: string;
  activeHours: { from: number; to: number };
}

export const FRACTURE_STYLE: Record<
  FractureType,
  { label: string; color: string; glyph: string }
> = {
  kindness: { label: 'Kindness', color: '#5bf0c0', glyph: '❧' },
  high_tension: { label: 'High Tension', color: '#a06bff', glyph: '✦' },
  coop: { label: 'Co-op', color: '#4fd6ff', glyph: '◈' },
};

/**
 * Night suppression (SAFETY.md §5): Fractures are hidden between 21:00 and 06:00
 * *local* time. Evaluated against the device clock, never UTC.
 */
export function isActiveNow(f: Fracture, now: Date = new Date()): boolean {
  if (f.status !== 'active') return false;
  const hour = now.getHours();
  const { from, to } = f.activeHours;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}
