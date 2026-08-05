import type { CrisisCategory, TextCategory } from './types.js';

// Cheap pre-filters. Keywords catch the obvious; the classifier catches the rest
// (SAFETY.md §2). Neither alone is sufficient — the pipeline runs both.

const CRISIS_KEYWORDS: Array<{ category: CrisisCategory; patterns: RegExp[] }> = [
  {
    category: 'suicide_self_harm',
    patterns: [
      /\b(kill|hurt|harm)ing?\s+myself\b/i,
      /\b(want|going)\s+to\s+die\b/i,
      /\bend\s+(it|my life|things)\b/i,
      /\bsuicid(e|al)\b/i,
      /\bself[-\s]?harm\b/i,
      /\bcut(ting)?\s+myself\b/i,
      /\b(no|any)\s+reason\s+to\s+live\b/i,
      /\bbetter\s+off\s+without\s+me\b/i,
      // Self-referential hopelessness / anhedonia — a risk class, not a phrase.
      // The crisis screen only runs on personal dilemmas, so "I feel worthless"
      // is self-directed here; over-routing on this path is the safe direction.
      /\bi\s*(?:'?m|\s+am|\s+feel|\s+felt|'?ve\s+felt)\s+(?:so\s+|completely\s+|totally\s+|really\s+|utterly\s+)?(?:worthless|hopeless|empty|numb)\b/i,
      /\bcan'?t\s+get\s+out\s+of\s+bed\b/i,
      /\b(?:no|not\s+much)\s+point\s+(?:in\s+)?(?:anything|going\s+on|it\s+all|living)\b/i,
    ],
  },
  {
    category: 'domestic_violence',
    patterns: [
      /\b(he|she|they|my (partner|husband|wife|boyfriend|girlfriend))\s+(hit|hits|beat|beats|hurt|hurts|chok)/i,
      /\bafraid\s+(of|for).*(partner|husband|wife|home)\b/i,
      /\bwon'?t\s+let\s+me\s+(leave|go|see)\b/i,
    ],
  },
  {
    category: 'child_abuse',
    patterns: [/\b(child|kid|minor)\b.*\b(abus|hurt|touch)/i, /\bbeing\s+abused\b/i],
  },
  {
    category: 'sexual_assault',
    patterns: [/\b(raped?|sexual(ly)?\s+assault)/i, /\bforced\s+me\s+to\b/i],
  },
  {
    category: 'disordered_eating',
    patterns: [/\b(anorexi|bulimi|purg(e|ing)|starv(e|ing)\s+myself)\b/i, /\bmake\s+myself\s+(sick|throw\s+up)\b/i],
  },
  {
    category: 'substance_crisis',
    patterns: [
      /\b(overdos|can'?t\s+stop\s+(drinking|using)|withdrawal)\b/i,
      /\b(too\s+many|handful\s+of)\s+pills\b/i,
      /\btook\s+.*\bpills\b/i,
    ],
  },
  {
    category: 'violence_threat',
    patterns: [/\b(kill|hurt|attack)\s+(him|her|them|everyone|people)\b/i, /\bshoot\s+up\b/i],
  },
  {
    category: 'minor',
    patterns: [/\bi'?m\s+(1[0-5]|[0-9])\s*(years?\s*old|yo)\b/i, /\bin\s+(middle|primary|elementary)\s+school\b/i],
  },
];

/** First crisis category whose keywords match, or null. Order = severity. */
export function crisisKeywordHit(text: string): CrisisCategory | null {
  for (const { category, patterns } of CRISIS_KEYWORDS) {
    if (patterns.some((p) => p.test(text))) return category;
  }
  return null;
}

// General moderation pre-filter: high-signal patterns that force block/flag.
const PHONE = /(?:\+?\d[\s-]?){7,}/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const STREET = /\b\d{1,5}\s+([A-Z][a-z]+\s){1,3}(street|st|road|rd|avenue|ave|lane|ln|drive|dr|blvd)\b/i;
const OFF_PLATFORM = /\b(whatsapp|telegram|snapchat|instagram|dm\s+me|text\s+me\s+at|add\s+me\s+on)\b/i;

export interface KeywordTextHit {
  verdict: 'flag' | 'block';
  categories: TextCategory[];
}

/** Force an outcome for the obvious cases; null lets the classifier decide. */
export function textKeywordHit(text: string): KeywordTextHit | null {
  const cats: TextCategory[] = [];
  if (PHONE.test(text) || EMAIL.test(text) || STREET.test(text)) cats.push('pii');
  if (OFF_PLATFORM.test(text)) cats.push('solicitation');
  if (cats.length) return { verdict: 'block', categories: cats };
  return null;
}
