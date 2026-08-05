/**
 * A pragmatic country shortlist for the pilot. `homeRegion` drives which crisis
 * resources a player sees (SAFETY §2), so accuracy matters more than breadth —
 * Israel and South Africa ship first per SAFETY §2, with a broader common set
 * and an international fallback. Expand as the pilot expands.
 */
export interface Region {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

export const REGIONS: ReadonlyArray<Region> = [
  { code: 'IL', name: 'Israel' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IN', name: 'India' },
  { code: 'ZZ', name: 'Elsewhere / prefer not to say' },
];

/** Best-effort region guess from the browser locale, defaulting to the fallback. */
export function guessRegion(): string {
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = locale.region?.toUpperCase();
    if (region && REGIONS.some((r) => r.code === region)) return region;
  } catch {
    /* ignore */
  }
  return 'ZZ';
}
