// Pure metric math for the v0 dashboard (GDD §6). Firestore reads live in
// scheduled.ts; the counting/derivation is here so it can be unit-tested.

/** Healed Fractures in 7 days → 0..1 neighbourhood brightness. */
export const BRIGHTNESS_TARGET_7D = 10;
export function brightnessFor(healed7d: number, target = BRIGHTNESS_TARGET_7D): number {
  return Math.max(0, Math.min(1, healed7d / target));
}

/** UTC day key for grouping activity by date. */
export function dayKeyFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The primary metric (GDD §6): players who completed a quest on ≥2 distinct
 * days. Read straight off users.stats.distinctActiveDays, which the award path
 * maintains.
 */
export function secondDayCompleters(users: Array<{ distinctActiveDays: number }>): number {
  return users.filter((u) => u.distinctActiveDays >= 2).length;
}

/** Quest funnel counts from analytics events. */
export function funnelFromEvents(events: Array<{ event: string }>): {
  viewed: number;
  checkedIn: number;
  verified: number;
} {
  const c = { viewed: 0, checkedIn: 0, verified: 0 };
  for (const e of events) {
    if (e.event === 'quest_view') c.viewed++;
    else if (e.event === 'quest_checkin') c.checkedIn++;
    else if (e.event === 'quest_verified') c.verified++;
  }
  return c;
}

/**
 * Return proxy: how many users opened the app on ≥2 distinct days. Precise D1/D7
 * windows need signup-day joins; this is the honest, directly-countable version.
 */
export function returnedOnMultipleDays(appOpens: Array<{ uid: string; tsMs: number }>): number {
  const daysByUser = new Map<string, Set<string>>();
  for (const o of appOpens) {
    const set = daysByUser.get(o.uid) ?? new Set<string>();
    set.add(dayKeyFromMs(o.tsMs));
    daysByUser.set(o.uid, set);
  }
  let returned = 0;
  for (const set of daysByUser.values()) if (set.size >= 2) returned++;
  return returned;
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}
