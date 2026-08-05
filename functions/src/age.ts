/**
 * Full years elapsed from an ISO `YYYY-MM-DD` birth date to `now`. Returns null
 * for an unparseable or future date. This is the authoritative age check for the
 * gate — the client has an identical copy only for inline UX validation.
 */
export function computeAge(birthDate: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dob = new Date(Date.UTC(y, mo - 1, d));
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== mo - 1 || dob.getUTCDate() !== d) {
    return null; // e.g. 2020-02-31
  }
  if (dob.getTime() > now.getTime()) return null;

  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() < mo - 1 ||
    (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export const MIN_AGE = 16;
