import { useEffect, useRef, useState } from 'react';
import { breatheStateAt, REQUIRED_CYCLES, type Phase } from './pacer';
import { Mandala } from './Mandala';

// Vibration cue per phase transition (mobile only; a no-op where unsupported).
const HAPTIC: Record<Phase, number | number[]> = {
  inhale: 18,
  hold: [8, 40, 8],
  exhale: 30,
};

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}

// The pacer circle scales with the breath: growing on the inhale, full on the
// hold, shrinking on the exhale.
function circleScale(phase: Phase, progress: number): number {
  if (phase === 'inhale') return 0.55 + 0.45 * progress;
  if (phase === 'exhale') return 1 - 0.45 * progress;
  return 1; // hold
}

interface BreatheScreenProps {
  onComplete: (cyclesCompleted: number) => void;
  onSkip: () => void;
  busy: boolean;
}

export function BreatheScreen({ onComplete, onSkip, busy }: BreatheScreenProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const prevPhase = useRef<Phase | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      setElapsed((now - startRef.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const state = breatheStateAt(elapsed);

  // Fire a haptic cue exactly when the phase flips.
  useEffect(() => {
    if (prevPhase.current !== state.phase) {
      if (prevPhase.current !== null) vibrate(HAPTIC[state.phase]);
      prevPhase.current = state.phase;
    }
  }, [state.phase]);

  const scale = circleScale(state.phase, state.phaseProgress);

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid place-items-center py-2">
        <Mandala stability={state.stability} />
        {/* Pacer circle overlaid on the mandala core. */}
        <div
          className="pointer-events-none absolute h-24 w-24 rounded-full border-2 border-aura-cyan/70 bg-aura-cyan/10"
          style={{ transform: `scale(${scale})`, transition: 'transform 120ms linear' }}
        />
        <div className="pointer-events-none absolute text-center">
          <p className="font-display text-lg text-slate-100">{state.label}</p>
          <p className="text-3xl font-semibold tabular-nums text-aura-cyan">
            {Math.ceil(state.phaseRemaining)}
          </p>
        </div>
      </div>

      <p className="mt-1 text-xs text-slate-400">
        Cycle {Math.min(state.cyclesCompleted, REQUIRED_CYCLES)} / {REQUIRED_CYCLES}
      </p>

      <button
        type="button"
        disabled={!state.solvable || busy}
        onClick={() => onComplete(state.cyclesCompleted)}
        className="mt-3 w-full rounded-xl border border-aura-green/40 bg-aura-green/10 px-4 py-3 text-sm font-medium text-aura-green transition hover:bg-aura-green/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? 'Stabilising…'
          : state.solvable
            ? 'Stabilise the Fracture'
            : 'Keep breathing…'}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={onSkip}
        className="mt-2 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline disabled:opacity-40"
      >
        Skip breathing this time
      </button>
    </div>
  );
}
