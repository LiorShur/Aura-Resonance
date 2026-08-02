// Pure 4-7-8 breathing-pacer logic. No timers, no DOM — the screen drives it with
// elapsed seconds so the whole thing is unit-testable against known ground truth.
// Puzzle stability is a function of COMPLETED CYCLES ONLY (GDD 3.2, hard
// constraint: no sensor input of any kind).

export type Phase = 'inhale' | 'hold' | 'exhale';

export interface PhaseSpec {
  phase: Phase;
  seconds: number;
  /** Human cue shown on the pacer. */
  label: string;
}

// 4-7-8: inhale 4s, hold 7s, exhale 8s → a 19-second cycle.
export const PHASES: readonly PhaseSpec[] = [
  { phase: 'inhale', seconds: 4, label: 'Breathe in' },
  { phase: 'hold', seconds: 7, label: 'Hold' },
  { phase: 'exhale', seconds: 8, label: 'Breathe out' },
] as const;

export const CYCLE_SECONDS = PHASES.reduce((s, p) => s + p.seconds, 0); // 19

// Cycles needed to fully stabilise the puzzle: 4 × 19s ≈ 76s, inside the GDD's
// 60–90s window. Below this the puzzle must be genuinely unsolvable.
export const REQUIRED_CYCLES = 4;

export interface BreatheState {
  /** 0-based index of the cycle currently in progress. */
  cycle: number;
  phase: Phase;
  label: string;
  /** Seconds left in the current phase (counts down, e.g. 4→0). */
  phaseRemaining: number;
  /** 0→1 progress through the current phase (drives the expanding circle). */
  phaseProgress: number;
  /** Fully completed cycles so far. */
  cyclesCompleted: number;
  /** 0→1 puzzle stability, from completed cycles only. */
  stability: number;
  /** True once enough cycles are done for the puzzle to be solvable. */
  solvable: boolean;
}

/** Stability from completed cycles — the only input the puzzle is allowed. */
export function stabilityFor(cyclesCompleted: number): number {
  return Math.max(0, Math.min(1, cyclesCompleted / REQUIRED_CYCLES));
}

/** Resolve the pacer state at a given elapsed time (seconds since start). */
export function breatheStateAt(elapsedS: number): BreatheState {
  const t = Math.max(0, elapsedS);
  const cyclesCompleted = Math.floor(t / CYCLE_SECONDS);
  let within = t - cyclesCompleted * CYCLE_SECONDS;

  let spec = PHASES[PHASES.length - 1]!;
  for (const p of PHASES) {
    if (within < p.seconds) {
      spec = p;
      break;
    }
    within -= p.seconds;
  }

  const stability = stabilityFor(cyclesCompleted);
  return {
    cycle: cyclesCompleted,
    phase: spec.phase,
    label: spec.label,
    phaseRemaining: Math.max(0, spec.seconds - within),
    phaseProgress: Math.min(1, within / spec.seconds),
    cyclesCompleted,
    stability,
    solvable: cyclesCompleted >= REQUIRED_CYCLES,
  };
}

/**
 * How "settled" puzzle piece `index` of `total` is, 0→1, given stability. Pieces
 * snap in one after another as stability rises, so the mandala visibly assembles
 * rather than all pieces fading in together.
 */
export function pieceSettle(index: number, total: number, stability: number): number {
  const filled = stability * total;
  return Math.max(0, Math.min(1, filled - index));
}
