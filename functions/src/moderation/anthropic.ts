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
  'Pervasive hopelessness, worthlessness, emptiness, or an inability to function ' +
  "(e.g. \"can't get out of bed\", \"no point in anything\") are risk indicators: " +
  'classify them as suicide_self_harm, not ok. When genuinely uncertain between ' +
  '"ok" and a crisis category, choose the crisis category — routing someone to ' +
  'support who did not strictly need it is far less harmful than missing someone. ' +
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
  'You moderate short user-generated text (a public "Echo" or a piece of advice) ' +
  'for a kindness community. Decide a verdict: "pass" (genuinely harmless), ' +
  '"flag" (borderline, needs human review), or "block" (harmful). ' +
  'Block, do not merely flag, when the text: attacks, demeans, or excludes people ' +
  'based on identity, nationality, ethnicity, religion, or origin ("hate", ' +
  'including coded othering like "those people" / "go back where you came from"); ' +
  'tells a person to give up, harm themselves, or that nobody likes them, or ' +
  'otherwise targets and degrades a person ("harassment"); or contains sexual ' +
  'content, personal information, spam, or off-platform solicitation. ' +
  'Flag milder cases such as derogatory generalisations about a group of people ' +
  'that fall short of the above. Reserve "pass" for text that is not derogatory. ' +
  'List applicable categories from: ' +
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
