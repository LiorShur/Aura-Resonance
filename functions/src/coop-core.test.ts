import { describe, expect, it } from 'vitest';
import { bothReady, checkJoin, formatCode, validateEcho } from './coop-core.js';

describe('formatCode', () => {
  it('produces a zero-padded 4-digit code', () => {
    expect(formatCode(7)).toBe('0007');
    expect(formatCode(1234)).toBe('1234');
    expect(formatCode(59999)).toBe('9999');
    expect(formatCode(-42)).toBe('0042');
  });
});

describe('checkJoin', () => {
  const ok = { hostInRadius: true, guestInRadius: true, separationM: 12 };
  it('passes when both are in range and close together', () => {
    expect(checkJoin(ok)).toEqual({ ok: true });
  });
  it('fails on out-of-range host or guest', () => {
    expect(checkJoin({ ...ok, hostInRadius: false }).reason).toBe('host-out-of-range');
    expect(checkJoin({ ...ok, guestInRadius: false }).reason).toBe('guest-out-of-range');
  });
  it('fails when the two players are more than 30m apart', () => {
    expect(checkJoin({ ...ok, separationM: 31 }).reason).toBe('too-far-apart');
    expect(checkJoin({ ...ok, separationM: 30 }).ok).toBe(true); // boundary inclusive
  });
});

describe('bothReady', () => {
  it('is true only when both flags are set', () => {
    expect(bothReady({ hostReady: true, guestReady: true })).toBe(true);
    expect(bothReady({ hostReady: true })).toBe(false);
    expect(bothReady({})).toBe(false);
    expect(bothReady(null)).toBe(false);
  });
});

describe('validateEcho', () => {
  it('accepts 1–140 chars, rejects empty and overly long', () => {
    expect(validateEcho('be kind')).toEqual({ ok: true });
    expect(validateEcho('   ').reason).toBe('empty');
    expect(validateEcho('x'.repeat(141)).reason).toBe('too-long');
  });
});
