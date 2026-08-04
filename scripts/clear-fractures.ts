import { seedDb } from './_admin';

/**
 * Delete Fracture documents from Firestore — the companion to the seeder, so
 * experiments don't stack up. Same safety model as seeding:
 *
 *   npm run clear:fractures            → EMULATOR (default)
 *   npm run clear:fractures:live       → LIVE (requires GOOGLE_APPLICATION_CREDENTIALS)
 *
 * Scope (destructive — be deliberate):
 *   ... -- draft            delete only neighbourhoodId == "draft"
 *   ... -- --all            delete EVERY fracture (guard flag required for a full wipe)
 *
 * This only touches `fractures`. It does not delete quest attempts, media, or
 * user data.
 */
async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--live');
  const all = args.includes('--all');
  const neighbourhood = args.find((a) => !a.startsWith('--'));

  if (!all && !neighbourhood) {
    console.error(
      'Refusing to run without a scope. Pass a neighbourhoodId (e.g. "draft") to\n' +
        'delete just that set, or --all to wipe every fracture:\n' +
        '  npm run clear:fractures -- draft\n' +
        '  npm run clear:fractures -- --all',
    );
    process.exit(1);
  }

  const db = seedDb();
  const col = db.collection('fractures');
  const snap = neighbourhood
    ? await col.where('neighbourhoodId', '==', neighbourhood).get()
    : await col.get();

  if (snap.empty) {
    console.log(`[clear] no fractures matched ${neighbourhood ? `"${neighbourhood}"` : 'the whole collection'}.`);
    return;
  }

  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
    deleted += Math.min(400, snap.docs.length - i);
  }
  console.log(
    `[clear] deleted ${deleted} fractures` +
      (neighbourhood ? ` from neighbourhood "${neighbourhood}".` : ' (entire collection).'),
  );
}

main().catch((err) => {
  console.error('[clear] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
