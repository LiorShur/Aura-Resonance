// Pure co-op logic, free of firebase-admin so it is unit-testable.

export const COOP_MAX_SEPARATION_M = 30; // GDD 3.5: both players within 30m of each other
export const COOP_CODE_TTL_MS = 10 * 60 * 1000; // 10-minute code expiry
export const COOP_REWARD = 50; // RP each, on a joint heal

/** A 4-digit session code from any number (host supplies randomness). */
export function formatCode(n: number): string {
  return String(Math.abs(Math.trunc(n)) % 10000).padStart(4, '0');
}

export interface JoinCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Whether a guest may join: both players in the Fracture's radius AND within 30m
 * of each other (GDD 3.5). Distances/radius are computed by the caller; this just
 * encodes the policy so it can be tested against known values.
 */
export function checkJoin(params: {
  hostInRadius: boolean;
  guestInRadius: boolean;
  separationM: number;
}): JoinCheck {
  if (!params.hostInRadius) return { ok: false, reason: 'host-out-of-range' };
  if (!params.guestInRadius) return { ok: false, reason: 'guest-out-of-range' };
  if (params.separationM > COOP_MAX_SEPARATION_M) return { ok: false, reason: 'too-far-apart' };
  return { ok: true };
}

/** Both players have signalled ready on the shared puzzle. */
export function bothReady(
  puzzleState: { hostReady?: boolean; guestReady?: boolean } | undefined | null,
): boolean {
  return Boolean(puzzleState?.hostReady && puzzleState?.guestReady);
}

/** Echo body validation (GDD 3.4: text-only, 140 chars). */
export const ECHO_MAX = 140;
export function validateEcho(text: string): { ok: boolean; reason?: string } {
  const len = text.trim().length;
  if (len < 1) return { ok: false, reason: 'empty' };
  if (len > ECHO_MAX) return { ok: false, reason: 'too-long' };
  return { ok: true };
}
