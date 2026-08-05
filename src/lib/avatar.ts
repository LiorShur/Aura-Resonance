/** Deterministic avatar helpers (no photo uploads — SCHEMA: avatarSeed). */

/** FNV-1a hash → unsigned 32-bit. Stable across runs for a given seed. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A new deterministic seed derived from an existing one (for "shuffle"). */
export function newAvatarSeed(from: string): string {
  return (hashSeed(from + ':' + from.length) >>> 0).toString(36) + from.slice(0, 2);
}
