/**
 * Client-side age helper for inline onboarding UX. The AUTHORITATIVE age gate is
 * the `createProfile` Cloud Function (functions/src/age.ts) — this copy only
 * gives the player immediate feedback before the call. Keep the two in sync.
 */

export const MIN_AGE = 16;

export function computeAge(birthDate: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dob = new Date(Date.UTC(y, mo - 1, d));
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== mo - 1 || dob.getUTCDate() !== d) {
    return null;
  }
  if (dob.getTime() > now.getTime()) return null;

  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() < mo - 1 ||
    (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function meetsMinimumAge(birthDate: string, now: Date = new Date()): boolean {
  const age = computeAge(birthDate, now);
  return age !== null && age >= MIN_AGE;
}
