import { env } from './env';
import { AppError } from './errors';
import type { LatLng } from './geo';
import { simSnapshot } from '@/sim/simStore';

export interface Position {
  coords: LatLng;
  accuracyM: number;
}

/**
 * The single seam through which the app reads the device position. Features call
 * this — never navigator.geolocation and never the sim store — so that sim mode
 * and production share one code path (CLAUDE.md: "Sim mode is not optional").
 *
 * Position is read only on explicit user action (the "I'm here" tap). There is
 * no watcher and no background tracking — that is a hard constraint, not a TODO.
 */
export async function getCurrentPosition(): Promise<Position> {
  if (env.simMode) {
    const { player, accuracyM } = simSnapshot();
    return { coords: player, accuracyM };
  }
  return readDeviceGps();
}

/**
 * Always reads the REAL device GPS, bypassing the sim seam. Used by the sim
 * "use my location" control so it recentres on where you actually are even in
 * sim mode. Requires a secure context (HTTPS or localhost).
 */
export async function readDeviceGps(): Promise<Position> {
  if (!('geolocation' in navigator)) {
    throw new AppError('geo/no-position', 'Geolocation is not available on this device');
  }
  return new Promise<Position>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracyM: p.coords.accuracy }),
      (err) => reject(new AppError('geo/no-position', err.message, err)),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
