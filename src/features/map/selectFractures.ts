import { distanceM, type LatLng } from '@/lib/geo';
import { isActiveNow, type Fracture } from './types';

export interface RankedFracture {
  fracture: Fracture;
  distanceM: number;
}

/**
 * The display set: Fractures within `radiusM` of the player that are active
 * right now (night suppression applied in LOCAL time via isActiveNow), sorted
 * nearest first. Pure — this is what makes "enter/leave range as the pin moves"
 * testable without a map or a network.
 */
export function selectVisibleFractures(
  all: readonly Fracture[],
  player: LatLng,
  radiusM: number,
  now: Date = new Date(),
  ignoreNight = false,
): RankedFracture[] {
  const out: RankedFracture[] = [];
  for (const f of all) {
    // `ignoreNight` is a sim-only desk override: still respect a healed/inactive
    // Fracture, but skip the 21:00–06:00 suppression so testing works after dark.
    const active = ignoreNight ? f.status === 'active' : isActiveNow(f, now);
    if (!active) continue;
    const d = distanceM(player, f.geo);
    if (d <= radiusM) out.push({ fracture: f, distanceM: d });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out;
}
