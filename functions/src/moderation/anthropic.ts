import Anthropic from '@anthropic-ai/sdk';
import { CRISIS_CATEGORIES, TEXT_CATEGORIES } from './types.js';
import type { CrisisClassifier, TextClassifier } from './types.js';

// Classification model per SAFETY.md §2 ("Claude Haiku classification call").
const MODEL = 'claude-haiku-4-5';

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Extract the JSON object from the model's reply. If the reply isn't clean JSON,
 * this throws — and the caller (classify.ts) turns any throw into the fail-closed
 * outcome, so a malformed classification can never be treated as "safe".
 */
function extractJson(message: Anthropic.Message): unknown {
  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('no_text_block');
  const match = block.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no_json');
  return JSON.parse(match[0]);
}

const CRISIS_SYSTEM =
  'You are a safety classifier for a wellbeing app. Classify the user-submitted ' +
  'dilemma into exactly one category. Use a crisis category if the text indicates ' +
  'that situation, even if softly worded; use "ok" only when none apply. ' +
  '"minor" means the author appears to be under 16. Categories: ' +
  CRISIS_CATEGORIES.join(', ') +
  '. Respond with ONLY a JSON object of the form {"category":"<category>"} and nothing else.';

export const crisisClassifier: CrisisClassifier = async (text) => {
  const message = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 64,
    system: CRISIS_SYSTEM,
    messages: [{ role: 'user', content: text }],
  });
  return extractJson(message) as { category: (typeof CRISIS_CATEGORIES)[number] };
};

const TEXT_SYSTEM =
  'You moderate short user-generated text (a public "Echo" or a piece of advice). ' +
  'Decide a verdict: "pass" (safe), "flag" (borderline, needs human review), or ' +
  '"block" (harmful: harassment, hate, sexual content, personal information, spam, ' +
  'or off-platform solicitation). List applicable categories from: ' +
  TEXT_CATEGORIES.join(', ') +
  '. Respond with ONLY a JSON object of the form ' +
  '{"verdict":"pass|flag|block","categories":["..."]} and nothing else.';

export const textClassifier: TextClassifier = async (text) => {
  const message = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 128,
    system: TEXT_SYSTEM,
    messages: [{ role: 'user', content: text }],
  });
  return extractJson(message) as { verdict: 'pass' | 'flag' | 'block'; categories: never[] };
};
