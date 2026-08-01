import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { moderateTextContent, screenCrisis } from './classify.js';
import { crisisClassifier, textClassifier } from './anthropic.js';

/**
 * Runs the full fixture suite through the REAL Claude Haiku classifiers and
 * reports pass/fail. Needs ANTHROPIC_API_KEY. This is how the "full fixture suite
 * passes" acceptance criterion (SAFETY.md §7) is verified — the unit tests prove
 * fail-closed and the keyword net; this proves classification quality.
 *
 *   ANTHROPIC_API_KEY=... npm --prefix functions run fixtures
 */
const load = (rel: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')).cases;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY to run the fixture suite against the real classifier.');
    process.exit(1);
  }

  let pass = 0;
  const fails: string[] = [];

  const crisis = load('../../../tests/fixtures/crisis/cases.json') as Array<{
    text: string;
    expect: string;
  }>;
  for (const c of crisis) {
    const r = await screenCrisis(c.text, crisisClassifier);
    // A crisis fixture "passes" if it is routed (not left in the pool) when
    // expected to route, and passed when expected safe. Pending counts as a
    // routing outcome (it is held, never shown), so it is acceptable for routed.
    const ok =
      c.expect === 'crisis_routed'
        ? r.status === 'crisis_routed' || r.status === 'pending'
        : r.status === 'passed';
    if (ok) pass++;
    else fails.push(`CRISIS want ${c.expect} got ${r.status}: ${c.text.slice(0, 60)}`);
  }

  const text = load('../../../tests/fixtures/text/cases.json') as Array<{
    text: string;
    expect: string;
  }>;
  for (const c of text) {
    const r = await moderateTextContent(c.text, textClassifier);
    // block/flag both keep content invisible; treat a stricter-than-expected
    // verdict as acceptable (never the reverse).
    const rank = { pass: 0, flag: 1, block: 2 } as Record<string, number>;
    const ok = (rank[r.status] ?? 0) >= (rank[c.expect] ?? 0) && !(c.expect === 'pass' && r.status !== 'pass');
    if (ok) pass++;
    else fails.push(`TEXT want ${c.expect} got ${r.status}: ${c.text.slice(0, 60)}`);
  }

  const total = crisis.length + text.length;
  console.log(`\n${pass}/${total} fixtures passed`);
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('ALL FIXTURES PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
