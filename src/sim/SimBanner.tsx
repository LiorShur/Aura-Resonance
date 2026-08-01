import { useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { useSimStore } from './simStore';

/**
 * The visible marker that you are in the sim harness, plus the controls that
 * stand in for physically walking: use your real location, teleport onto a
 * Fracture, summon a fake co-op partner, and vary GPS accuracy. Rendered only
 * when VITE_SIM_MODE=true.
 */
export function SimBanner() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teleportTo = useSimStore((s) => s.teleportTo);
  const accuracyM = useSimStore((s) => s.accuracyM);
  const setAccuracy = useSimStore((s) => s.setAccuracy);
  const secondPlayer = useSimStore((s) => s.secondPlayer);
  const toggleSecondPlayer = useSimStore((s) => s.toggleSecondPlayer);
  const sampleFractures = useSimStore((s) => s.sampleFractures);
  const recentreOnMe = useSimStore((s) => s.useMyLocation);
  const locating = useSimStore((s) => s.locating);
  const simCentre = useSimStore((s) => s.simCentre);
  const ignoreNight = useSimStore((s) => s.ignoreNight);
  const toggleIgnoreNight = useSimStore((s) => s.toggleIgnoreNight);

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
          <button
            type="button"
            disabled={locating}
            onClick={() => {
              setError(null);
              recentreOnMe().catch((e) => setError(errorMessage(e)));
            }}
            className="rounded bg-amber-500/25 px-2 py-1 font-medium hover:bg-amber-500/35 disabled:opacity-50"
          >
            {locating ? 'Locating…' : '📍 Use my location (recentre here)'}
          </button>
          <p className="font-mono text-[10px] text-amber-200/60">
            centre {simCentre.lat.toFixed(5)}, {simCentre.lng.toFixed(5)} — pass to
            SEED_AT to seed here
          </p>
          {error && <p className="text-rose-300">{error}</p>}

          <div>
            <p className="mb-1 text-amber-200/70">Teleport to Fracture</p>
            <div className="flex flex-wrap gap-1">
              {sampleFractures.map((f, i) => (
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

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ignoreNight}
              onChange={toggleIgnoreNight}
              className="accent-amber-400"
            />
            <span className="text-amber-200/70">
              Ignore night suppression (show Fractures after 21:00)
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
