import { useState } from 'react';
import { useSimStore } from './simStore';
import { SAMPLE_FRACTURES } from './sampleNeighbourhood';

/**
 * The visible marker that you are in the sim harness, plus the controls that
 * stand in for physically walking: teleport onto a Fracture, summon a fake
 * co-op partner, and vary GPS accuracy. Rendered only when VITE_SIM_MODE=true.
 */
export function SimBanner() {
  const [open, setOpen] = useState(false);
  const teleportTo = useSimStore((s) => s.teleportTo);
  const accuracyM = useSimStore((s) => s.accuracyM);
  const setAccuracy = useSimStore((s) => s.setAccuracy);
  const secondPlayer = useSimStore((s) => s.secondPlayer);
  const toggleSecondPlayer = useSimStore((s) => s.toggleSecondPlayer);

  return (
    <div className="z-30 bg-amber-500/15 text-amber-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1 text-xs font-medium"
      >
        <span>◈ SIM MODE — no real GPS</span>
        <span className="text-amber-200/70">{open ? 'hide' : 'controls'}</span>
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-2 text-xs">
          <div>
            <p className="mb-1 text-amber-200/70">Teleport to Fracture</p>
            <div className="flex flex-wrap gap-1">
              {SAMPLE_FRACTURES.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => teleportTo(f.geo)}
                  className="rounded bg-amber-500/20 px-2 py-0.5 hover:bg-amber-500/30"
                >
                  #{i + 1} {f.type}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <span className="text-amber-200/70">Accuracy</span>
            <input
              type="range"
              min={4}
              max={60}
              value={accuracyM}
              onChange={(e) => setAccuracy(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="w-10 text-right tabular-nums">{accuracyM} m</span>
          </label>

          <button
            type="button"
            onClick={toggleSecondPlayer}
            className="rounded bg-amber-500/20 px-2 py-0.5 hover:bg-amber-500/30"
          >
            {secondPlayer ? 'Remove' : 'Add'} fake co-op partner
          </button>
        </div>
      )}
    </div>
  );
}
