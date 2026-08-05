import {
  collection,
  endAt,
  getDocs,
  orderBy,
  query,
  startAt,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebase } from '@/lib/firebase';
import { distanceM, geohashBounds, geohashFor, type LatLng } from '@/lib/geo';

// Echoes are geo-anchored messages visible within 50m of where they were left.
const DISCOVER_RADIUS_M = 50;
const FETCH_RADIUS_M = 400; // geohash cells fetched; distance-filtered to 50m

export interface Echo {
  id: string;
  text: string;
  geo: { lat: number; lng: number };
  distanceM: number;
  createdAt?: Timestamp;
}

export async function createEcho(text: string, position: LatLng): Promise<string> {
  const geo = { lat: position.lat, lng: position.lng, geohash: geohashFor(position) };
  const res = await httpsCallable<{ text: string; geo: typeof geo }, { echoId: string }>(
    firebase().functions,
    'createEcho',
  )({ text, geo });
  return res.data.echoId;
}

/**
 * Discover passed, unhidden Echoes within 50m of the player. Firestore has no
 * radius query, so we range over geohash cells (matching the moderation/hidden/
 * geohash index) and distance-filter on the client, exactly like Fractures.
 */
export function watchEchoesNear(
  player: LatLng,
  cb: (echoes: Echo[]) => void,
  onError?: (m: string) => void,
): () => void {
  const bounds = geohashBounds(player, FETCH_RADIUS_M);
  const col = collection(firebase().db, 'echoes');
  let cancelled = false;

  Promise.all(
    bounds.map(([s, e]) =>
      getDocs(
        query(
          col,
          where('moderation.status', '==', 'pass'),
          where('hidden', '==', false),
          orderBy('geo.geohash'),
          startAt(s),
          endAt(e),
        ),
      ),
    ),
  )
    .then((snaps) => {
      if (cancelled) return;
      const seen = new Map<string, Echo>();
      for (const snap of snaps) {
        for (const d of snap.docs) {
          const data = d.data();
          const geo = data.geo as { lat: number; lng: number } | undefined;
          if (!geo) continue;
          const dist = distanceM(player, geo);
          if (dist <= DISCOVER_RADIUS_M) {
            seen.set(d.id, {
              id: d.id,
              text: String(data.text ?? ''),
              geo: { lat: geo.lat, lng: geo.lng },
              distanceM: Math.round(dist),
              createdAt: data.createdAt as Timestamp | undefined,
            });
          }
        }
      }
      cb([...seen.values()].sort((a, b) => a.distanceM - b.distanceM));
    })
    .catch((e) => !cancelled && onError?.(e.message));

  return () => {
    cancelled = true;
  };
}
