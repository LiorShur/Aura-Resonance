import { Suspense, lazy, useEffect, useState } from 'react';
import { env } from '@/lib/env';
import { bearingDeg, compassPoint, formatDistance } from '@/lib/geo';
import { getCurrentPosition } from '@/lib/geolocation';
import { useAuthStore } from '@/features/auth/authStore';
import { useSimStore } from '@/sim/simStore';
import { SIM_CENTRE } from '@/sim/sampleNeighbourhood';
import { SchematicMap } from './SchematicMap';
import { useFractures } from './useFractures';
import { FRACTURE_STYLE } from './types';

const MapboxMap = lazy(() =>
  import('./MapboxMap').then((m) => ({ default: m.MapboxMap })),
);

/**
 * v0 Map screen. Fractures load from Firestore via geohash range queries and are
 * distance-filtered client-side. In sim mode the pin is draggable and reads from
 * the sim store; in live mode we take a one-shot position for the initial view
 * (no continuous tracking — that is a hard constraint). Uses Mapbox when a token
 * is configured, else the token-free schematic map.
 */
export function MapScreen() {
  const player = useSimStore((s) => s.player);
  const secondPlayer = useSimStore((s) => s.secondPlayer);
  const setPlayer = useSimStore((s) => s.setPlayer);
  const profile = useAuthStore((s) => s.profile);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { visible, loading, usingSample } = useFractures(player);

  // Live mode: seed the initial position once (foreground, on demand only).
  useEffect(() => {
    if (env.simMode) return;
    getCurrentPosition()
      .then((p) => setPlayer(p.coords))
      .catch(() => undefined);
  }, [setPlayer]);

  const fractures = visible.map((v) => v.fracture);
  const selected = visible.find((v) => v.fracture.id === selectedId) ?? null;
  const hasToken = env.mapboxToken.length > 0;

  return (
    <div className="relative h-full w-full">
      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="glass pointer-events-auto rounded-2xl px-3 py-1.5 text-sm">
          <span className="font-display text-lg tracking-wide text-aura-cyan">Aura</span>
          <span className="ml-2 text-slate-400">Lv {profile?.auraLevel ?? 1}</span>
        </div>
        <div className="glass pointer-events-auto rounded-2xl px-3 py-1.5 text-sm">
          <span className="text-slate-400">RP</span>{' '}
          <span className="font-semibold text-slate-100">{profile?.resonancePoints ?? 0}</span>
        </div>
      </div>

      {usingSample && env.simMode && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center">
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-200">
            sample Fractures — seed the database to use live data
          </span>
        </div>
      )}

      {/* Map */}
      {hasToken ? (
        <Suspense fallback={<MapLoading />}>
          <MapboxMap
            centre={SIM_CENTRE}
            fractures={fractures}
            player={player}
            secondPlayer={secondPlayer}
            selectedId={selectedId}
            draggable={env.simMode}
            onSelect={setSelectedId}
            onPlayerMove={setPlayer}
          />
        </Suspense>
      ) : (
        <div className="grid h-full w-full place-items-center bg-base-900">
          <div className="aspect-square h-full max-h-full w-full max-w-[min(100%,100vh)]">
            <SchematicMap
              centre={SIM_CENTRE}
              fractures={fractures}
              player={player}
              secondPlayer={secondPlayer}
              selectedId={selectedId}
              draggable={env.simMode}
              onSelect={setSelectedId}
              onPlayerMove={setPlayer}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 text-xs text-slate-500">
          finding Fractures…
        </div>
      )}

      {/* Selected Fracture readout */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-base"
                style={{ backgroundColor: `${FRACTURE_STYLE[selected.fracture.type].color}22` }}
              >
                {FRACTURE_STYLE[selected.fracture.type].glyph}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-100">
                  {FRACTURE_STYLE[selected.fracture.type].label} Fracture
                </p>
                <p className="text-xs text-slate-400">
                  {(() => {
                    const b = bearingDeg(player, selected.fracture.geo);
                    return `${formatDistance(selected.distanceM)} · ${compassPoint(b)} · check-in ${selected.fracture.radiusM} m`;
                  })()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapLoading() {
  return (
    <div className="grid h-full w-full place-items-center bg-base-900 text-sm text-slate-500">
      loading map…
    </div>
  );
}
