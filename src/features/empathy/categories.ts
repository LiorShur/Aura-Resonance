// Mirrors DILEMMA_CATEGORIES in functions/src/empathy-core.ts. Keep in sync — the
// function rejects any category not on its list.
export const CATEGORIES = [
  { id: 'relationships', label: 'Relationships' },
  { id: 'family', label: 'Family' },
  { id: 'work', label: 'Work & study' },
  { id: 'loneliness', label: 'Loneliness' },
  { id: 'change', label: 'Big change' },
  { id: 'health', label: 'Health' },
  { id: 'other', label: 'Something else' },
] as const;

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);

export const DILEMMA_MIN = 100;
export const DILEMMA_MAX = 800;
export const ADVICE_MIN = 10;
export const ADVICE_MAX = 600;
