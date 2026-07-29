import { useState } from 'react';
import { env } from '@/lib/env';
import { bearingDeg, compassPoint, distanceM, formatDistance } from '@/lib/geo';
import { useSimStore } from '@/sim/simStore';
import { SIM_CENTRE, SAMPLE_FRACTURES } from '@/sim/sampleNeighbourhood';
import { SchematicMap } from './SchematicMap';
import { FRACTURE_STYLE } from './types';

/**
 * v0 Map screen. In sim mode the pin is draggable and reads from the sim store;
 * seeded Fractures come from the bundled sample so the map is never empty. M2
 * swaps the schematic for Mapbox GL and loads Fractures via geohash range query.
 */
export function MapScreen() {
  const player = useSimStore((s) => s.player);
  const secondPlayer = useSimStore((s) => s.secondPlayer);
  const setPlayer = useSimStore((s) => s.setPlayer);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fractures = SAMPLE_FRACTURES;
  const selected = fractures.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="relative h-full w-full">
      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="glass pointer-events-auto rounded-2xl px-3 py-1.5 text-sm">
          <span className="font-display text-lg tracking-wide text-aura-cyan">Aura</span>
          <span className="ml-2 text-slate-400">Resonance</span>
        </div>
        <div className="glass pointer-events-auto rounded-2xl px-3 py-1.5 text-sm">
          <span className="text-slate-400">RP</span>{' '}
          <span className="font-semibold text-slate-100">0</span>
        </div>
      </div>

      {/* Map */}
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

      {/* Selected Fracture readout */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-base"
                style={{ backgroundColor: `${FRACTURE_STYLE[selected.type].color}22` }}
              >
                {FRACTURE_STYLE[selected.type].glyph}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-100">
                  {FRACTURE_STYLE[selected.type].label} Fracture
                </p>
                <p className="text-xs text-slate-400">
                  {(() => {
                    const d = distanceM(player, selected.geo);
                    const b = bearingDeg(player, selected.geo);
                    return `${formatDistance(d)} · ${compassPoint(b)} · check-in ${selected.radiusM} m`;
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
