import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  endAt,
  getDocs,
  orderBy,
  query,
  startAt,
} from 'firebase/firestore';
import { firebase } from '@/lib/firebase';
import { env } from '@/lib/env';
import { geohashBounds, type LatLng } from '@/lib/geo';
import { errorMessage } from '@/lib/errors';
import { SAMPLE_FRACTURES } from '@/sim/sampleNeighbourhood';
import { selectVisibleFractures, type RankedFracture } from './selectFractures';
import type { Fracture } from './types';

// Fetch a little wider than we display, so moving within a cell doesn't blank the
// map; the display radius is what the distance filter actually shows.
const FETCH_RADIUS_M = 2500;
const DISPLAY_RADIUS_M = 2000;

function toFracture(id: string, data: Record<string, unknown>): Fracture | null {
  const geo = data.geo as { lat?: number; lng?: number; geohash?: string } | undefined;
  if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') return null;
  return {
    id,
    type: data.type as Fracture['type'],
    templateId: String(data.templateId ?? ''),
    geo: { lat: geo.lat, lng: geo.lng, geohash: String(geo.geohash ?? '') },
    radiusM: Number(data.radiusM ?? 50),
    status: (data.status as Fracture['status']) ?? 'active',
    neighbourhoodId: String(data.neighbourhoodId ?? ''),
    activeHours: (data.activeHours as Fracture['activeHours']) ?? { from: 0, to: 24 },
  };
}

/**
 * Loads Fractures near the player with a geohash range query, refetching only
 * when the player crosses into a new set of geohash cells (Firestore has no
 * radius query — we query prefix ranges and distance-filter on the client). The
 * visible set is recomputed on every move so Fractures enter and leave range as
 * the pin moves. In sim mode with an empty database it falls back to the bundled
 * sample so desk development never faces a blank map.
 */
export function useFractures(player: LatLng): {
  visible: RankedFracture[];
  loading: boolean;
  error: string | null;
  usingSample: boolean;
} {
  const [raw, setRaw] = useState<Fracture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingSample, setUsingSample] = useState(false);
  const lastBoundsKey = useRef<string>('');

  useEffect(() => {
    const bounds = geohashBounds(player, FETCH_RADIUS_M);
    const key = bounds.map((b) => b.join(':')).join('|');
    if (key === lastBoundsKey.current) return; // still inside the fetched cells
    lastBoundsKey.current = key;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const db = firebase().db;
        const col = collection(db, 'fractures');
        const snaps = await Promise.all(
          bounds.map(([s, e]) =>
            getDocs(query(col, orderBy('geo.geohash'), startAt(s), endAt(e))),
          ),
        );
        if (cancelled) return;

        const byId = new Map<string, Fracture>();
        for (const snap of snaps) {
          for (const d of snap.docs) {
            const f = toFracture(d.id, d.data());
            if (f) byId.set(f.id, f);
          }
        }

        if (byId.size === 0 && env.simMode) {
          setRaw(SAMPLE_FRACTURES);
          setUsingSample(true);
        } else {
          setRaw([...byId.values()]);
          setUsingSample(false);
        }
      } catch (e) {
        if (cancelled) return;
        // In sim mode, don't let a query failure blank the desk map.
        if (env.simMode) {
          setRaw(SAMPLE_FRACTURES);
          setUsingSample(true);
        } else {
          setError(errorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player]);

  const visible = useMemo(
    () => selectVisibleFractures(raw, player, DISPLAY_RADIUS_M),
    [raw, player],
  );

  return { visible, loading, error, usingSample };
}
