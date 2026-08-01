import {
  CrisisResult,
  TextVerdictSchema,
  type CrisisCategory,
  type CrisisClassifier,
  type ModerationStatus,
  type ScreenStatus,
  type TextCategory,
  type TextClassifier,
} from './types.js';
import { crisisKeywordHit, textKeywordHit } from './keywords.js';

const DEFAULT_TIMEOUT_MS = 8000;

/** Reject if the classifier hasn't answered in time (drives fail-closed). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('classifier_timeout')), ms),
    ),
  ]);
}

export interface CrisisScreen {
  status: ScreenStatus;
  category: CrisisCategory | null;
  /** True when the outcome came from the fail-closed path, not a clean result. */
  failedClosed: boolean;
}

/**
 * Crisis screen (SAFETY.md §2). Keyword pre-filter first, then the classifier.
 * On ANY classifier error, timeout, or invalid output the result is `pending`,
 * never `passed` — held for human review. This is the non-negotiable guarantee.
 */
export async function screenCrisis(
  text: string,
  classify: CrisisClassifier,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CrisisScreen> {
  const kw = crisisKeywordHit(text);
  if (kw) return { status: 'crisis_routed', category: kw, failedClosed: false };

  try {
    const raw = await withTimeout(classify(text), timeoutMs);
    const parsed = CrisisResult.parse(raw); // throws on invalid → fail closed
    if (parsed.category === 'ok') {
      return { status: 'passed', category: 'ok', failedClosed: false };
    }
    return { status: 'crisis_routed', category: parsed.category, failedClosed: false };
  } catch {
    // Fail closed: hold as pending, queue for review. Never fail open here.
    return { status: 'pending', category: null, failedClosed: true };
  }
}

export interface TextModeration {
  status: ModerationStatus;
  categories: TextCategory[];
  failedClosed: boolean;
}

/**
 * General text moderation (SAFETY.md §3) for echoes and advice. Content is only
 * ever made visible on an explicit `pass` (the security rules require it), so any
 * non-pass outcome — including the fail-closed `flag` on classifier error — keeps
 * the content invisible and queued.
 */
export async function moderateTextContent(
  text: string,
  classify: TextClassifier,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<TextModeration> {
  const kw = textKeywordHit(text);
  if (kw) return { status: kw.verdict, categories: kw.categories, failedClosed: false };

  try {
    const raw = await withTimeout(classify(text), timeoutMs);
    const parsed = TextVerdictSchema.parse(raw);
    return { status: parsed.verdict, categories: parsed.categories, failedClosed: false };
  } catch {
    // Fail closed: never `pass` on error — flag it, invisible and queued.
    return { status: 'flag', categories: [], failedClosed: true };
  }
}
