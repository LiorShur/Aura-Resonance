// Pure Empathy-Engine logic, free of firebase-admin so it is unit-testable. The
// callables in empathy.ts wrap these with Firestore reads/writes.

export const DILEMMA_MIN = 100;
export const DILEMMA_MAX = 800;
export const ADVICE_MIN = 10;
export const ADVICE_MAX = 600;
export const MAX_ADVICE_PER_SUBMISSION = 5;

export const DILEMMA_CATEGORIES = [
  'relationships',
  'family',
  'work',
  'loneliness',
  'change',
  'health',
  'other',
] as const;
export type DilemmaCategory = (typeof DILEMMA_CATEGORIES)[number];

export interface Validation {
  ok: boolean;
  reason?: string;
}

export function validateDilemma(body: string, category: string): Validation {
  const len = body.trim().length;
  if (len < DILEMMA_MIN) return { ok: false, reason: 'too-short' };
  if (len > DILEMMA_MAX) return { ok: false, reason: 'too-long' };
  if (!DILEMMA_CATEGORIES.includes(category as DilemmaCategory)) {
    return { ok: false, reason: 'bad-category' };
  }
  return { ok: true };
}

export function validateAdvice(text: string): Validation {
  const len = text.trim().length;
  if (len < ADVICE_MIN) return { ok: false, reason: 'too-short' };
  if (len > ADVICE_MAX) return { ok: false, reason: 'too-long' };
  return { ok: true };
}

/**
 * Resonance Points an adviser earns when their advice is rated. Only genuinely
 * helpful advice (3★+) pays, and it scales with the rating so the best advisers
 * earn most — "top-rated advisers receive points" (GDD 3.3). Rating is clamped
 * to 1–5; anything else earns nothing.
 */
const ADVICE_AWARD: Record<number, number> = { 1: 0, 2: 0, 3: 4, 4: 8, 5: 12 };

export function adviserAward(rating: number): number {
  return ADVICE_AWARD[rating] ?? 0;
}
