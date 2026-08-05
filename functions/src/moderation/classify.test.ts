import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { moderateTextContent, screenCrisis } from './classify.js';
import { crisisKeywordHit, textKeywordHit } from './keywords.js';
import type { CrisisClassifier, TextClassifier } from './types.js';

const load = (rel: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const crisisCases = load('../../../tests/fixtures/crisis/cases.json').cases as Array<{
  text: string;
  expect: 'crisis_routed' | 'passed';
}>;
const textCases = load('../../../tests/fixtures/text/cases.json').cases as Array<{
  text: string;
  expect: 'pass' | 'flag' | 'block';
}>;

const never = () => new Promise<never>(() => {});
const okCrisis: CrisisClassifier = async () => ({ category: 'ok' });
const passText: TextClassifier = async () => ({ verdict: 'pass', categories: [] });

describe('fail closed — the non-negotiable guarantee', () => {
  it('crisis screen holds as pending when the classifier throws', async () => {
    const r = await screenCrisis('a neutral dilemma about chores', async () => {
      throw new Error('api down');
    });
    expect(r.status).toBe('pending');
    expect(r.failedClosed).toBe(true);
    expect(r.status).not.toBe('passed');
  });

  it('crisis screen holds as pending on a classifier timeout', async () => {
    const r = await screenCrisis('a neutral dilemma about chores', never, 30);
    expect(r.status).toBe('pending');
  });

  it('crisis screen holds as pending on invalid classifier output', async () => {
    const r = await screenCrisis('a neutral dilemma', async () => ({ category: 'bogus' }) as never);
    expect(r.status).toBe('pending');
  });

  it('text moderation never passes on classifier error — it flags', async () => {
    const r = await moderateTextContent('a neutral echo', async () => {
      throw new Error('api down');
    });
    expect(r.status).toBe('flag');
    expect(r.status).not.toBe('pass');
    expect(r.failedClosed).toBe(true);
  });

  it('text moderation flags (not passes) on timeout', async () => {
    const r = await moderateTextContent('a neutral echo', never, 30);
    expect(r.status).toBe('flag');
  });
});

describe('keyword pre-filter short-circuits before the classifier', () => {
  it('routes an obvious crisis without calling the classifier', async () => {
    const spy = vi.fn(okCrisis);
    const r = await screenCrisis('I just want to die, nothing helps', spy);
    expect(r.status).toBe('crisis_routed');
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks obvious PII without calling the classifier', async () => {
    const spy = vi.fn(passText);
    const r = await moderateTextContent('call me on 072 555 1234', spy);
    expect(r.status).toBe('block');
    expect(r.categories).toContain('pii');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('outcome mapping (classifier decides, no keyword hit)', () => {
  it('ok → passed, crisis category → crisis_routed', async () => {
    expect((await screenCrisis('chores dispute', okCrisis)).status).toBe('passed');
    const routed = await screenCrisis('a vague hard situation', async () => ({
      category: 'domestic_violence',
    }));
    expect(routed.status).toBe('crisis_routed');
  });

  it('maps pass/flag/block verdicts through', async () => {
    expect((await moderateTextContent('hello there', passText)).status).toBe('pass');
    expect(
      (await moderateTextContent('hello there', async () => ({ verdict: 'flag', categories: [] }))).status,
    ).toBe('flag');
    expect(
      (await moderateTextContent('hello there', async () => ({ verdict: 'block', categories: ['hate'] }))).status,
    ).toBe('block');
  });
});

describe('fixture keyword coverage (deterministic subset)', () => {
  it('the keyword net catches a majority of clearly-worded crisis fixtures', () => {
    // Keywords are a belt-and-braces net; soft-worded cases rely on the
    // classifier (validated separately by the real-API fixture runner).
    const routed = crisisCases.filter((c) => c.expect === 'crisis_routed');
    const caught = routed.filter((c) => crisisKeywordHit(c.text) !== null);
    expect(caught.length).toBeGreaterThanOrEqual(Math.ceil(routed.length * 0.5));
  });

  it('no safe crisis fixture trips a crisis keyword (no false positives)', () => {
    for (const c of crisisCases.filter((x) => x.expect === 'passed')) {
      expect(crisisKeywordHit(c.text), c.text).toBeNull();
    }
  });

  it('text fixtures containing contact info or off-platform handles are keyword-blocked', () => {
    const shouldCatch = textCases.filter(
      (c) =>
        c.expect === 'block' &&
        /@|whatsapp|telegram|snapchat|instagram|(?:\d[\s-]?){7,}/i.test(c.text),
    );
    expect(shouldCatch.length).toBeGreaterThanOrEqual(8);
    for (const c of shouldCatch) {
      expect(textKeywordHit(c.text), c.text).not.toBeNull();
    }
  });
});
