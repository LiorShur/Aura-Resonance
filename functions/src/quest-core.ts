import { distanceM, type LatLng } from './geo.js';

// Pure quest logic, free of firebase-admin so it is unit-testable. The callables
// in quest.ts wrap these with Firestore reads/writes.

export interface CheckInEval {
  withinRange: boolean;
  distanceM: number;
  /** How much further the player must get to be in range (0 when in range). */
  remainingM: number;
}

export function evaluateCheckIn(
  fractureGeo: LatLng,
  radiusM: number,
  position: LatLng,
): CheckInEval {
  const d = distanceM(fractureGeo, position);
  return {
    withinRange: d <= radiusM,
    distanceM: Math.round(d),
    remainingM: Math.max(0, Math.round(d - radiusM)),
  };
}

export const DEFAULT_DAILY_RP_CAP = 200;

/**
 * Resonance Points to award, after the daily cap. Never negative; awards only up
 * to the remaining room in today's cap (so a big reward can be partially capped).
 */
export function computeAward(reward: number, dailyCap: number, spentToday: number): number {
  const room = Math.max(0, dailyCap - spentToday);
  return Math.max(0, Math.min(reward, room));
}

export const DEFAULT_LEVEL_THRESHOLDS = [0, 100, 250, 500, 850, 1300, 1900, 2600, 3400, 4300];

/** Aura Level from cumulative RP: highest threshold not exceeding `points`. */
export function computeLevel(points: number, thresholds = DEFAULT_LEVEL_THRESHOLDS): number {
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (points >= (thresholds[i] ?? Infinity)) level = i + 1;
  }
  return level;
}

/** UTC day key for daily-cap bookkeeping. */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}
