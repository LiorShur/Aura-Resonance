import { describe, expect, it } from 'vitest';
import {
  breatheStateAt,
  CYCLE_SECONDS,
  pieceSettle,
  REQUIRED_CYCLES,
  stabilityFor,
} from './pacer';

describe('breatheStateAt', () => {
  it('starts inhaling', () => {
    const s = breatheStateAt(0);
    expect(s.phase).toBe('inhale');
    expect(s.cyclesCompleted).toBe(0);
    expect(s.solvable).toBe(false);
  });

  it('walks through inhale → hold → exhale within one cycle', () => {
    expect(breatheStateAt(2).phase).toBe('inhale'); // t<4
    expect(breatheStateAt(4).phase).toBe('hold'); // 4..11
    expect(breatheStateAt(10).phase).toBe('hold');
    expect(breatheStateAt(11).phase).toBe('exhale'); // 11..19
    expect(breatheStateAt(18).phase).toBe('exhale');
  });

  it('counts a completed cycle at the 19s boundary', () => {
    expect(breatheStateAt(CYCLE_SECONDS - 0.1).cyclesCompleted).toBe(0);
    expect(breatheStateAt(CYCLE_SECONDS).cyclesCompleted).toBe(1);
  });

  it('phaseRemaining counts down and phaseProgress rises within a phase', () => {
    const s = breatheStateAt(1); // 1s into a 4s inhale
    expect(s.phaseRemaining).toBeCloseTo(3);
    expect(s.phaseProgress).toBeCloseTo(0.25);
  });

  it('becomes solvable only at the required number of cycles', () => {
    expect(breatheStateAt((REQUIRED_CYCLES - 1) * CYCLE_SECONDS).solvable).toBe(false);
    expect(breatheStateAt(REQUIRED_CYCLES * CYCLE_SECONDS).solvable).toBe(true);
  });
});

describe('stabilityFor', () => {
  it('is 0 at start, 1 at the required cycles, and clamps', () => {
    expect(stabilityFor(0)).toBe(0);
    expect(stabilityFor(REQUIRED_CYCLES / 2)).toBeCloseTo(0.5);
    expect(stabilityFor(REQUIRED_CYCLES)).toBe(1);
    expect(stabilityFor(REQUIRED_CYCLES + 5)).toBe(1);
  });
});

describe('pieceSettle', () => {
  it('snaps pieces in one at a time as stability rises', () => {
    // 8 pieces; at 50% stability, 4 pieces are fully settled, the 5th mid-snap.
    expect(pieceSettle(0, 8, 0.5)).toBe(1);
    expect(pieceSettle(3, 8, 0.5)).toBe(1);
    expect(pieceSettle(4, 8, 0.5)).toBe(0);
    expect(pieceSettle(4, 8, 0.5625)).toBeCloseTo(0.5);
    expect(pieceSettle(7, 8, 1)).toBe(1);
  });
});
