import { z } from 'zod';

// --- Crisis screen (SAFETY.md §2) ---------------------------------------------

/** Categories that must never enter the advice pool. `ok` is the pass state. */
export const CRISIS_CATEGORIES = [
  'ok',
  'suicide_self_harm',
  'domestic_violence',
  'child_abuse',
  'sexual_assault',
  'disordered_eating',
  'substance_crisis',
  'violence_threat',
  'minor',
] as const;
export type CrisisCategory = (typeof CRISIS_CATEGORIES)[number];

export const CrisisResult = z.object({
  category: z.enum(CRISIS_CATEGORIES),
});
export type CrisisResult = z.infer<typeof CrisisResult>;

/** Screen outcome written to empathySubmissions.safetyScreen.status. */
export type ScreenStatus = 'pending' | 'passed' | 'crisis_routed' | 'blocked';

// --- General text moderation (SAFETY.md §3) -----------------------------------

export const TEXT_CATEGORIES = [
  'ok',
  'harassment',
  'hate',
  'sexual',
  'pii',
  'spam',
  'solicitation',
] as const;
export type TextCategory = (typeof TEXT_CATEGORIES)[number];

export const TextVerdictSchema = z.object({
  verdict: z.enum(['pass', 'flag', 'block']),
  categories: z.array(z.enum(TEXT_CATEGORIES)).default([]),
});
export type TextVerdict = z.infer<typeof TextVerdictSchema>;

/** Moderation status written to media/echoes/advice.moderation.status. */
export type ModerationStatus = 'pending' | 'pass' | 'flag' | 'block';

// --- Injected classifiers (real = Claude Haiku; tests = mocks) ----------------

export type CrisisClassifier = (text: string) => Promise<CrisisResult>;
export type TextClassifier = (text: string) => Promise<TextVerdict>;
