import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { seedDb } from './_admin';

const CRISIS = fileURLToPath(new URL('./data/crisis-resources.json', import.meta.url));

// Default progression config (submitVerification falls back to these if absent).
const PROGRESSION = {
  dailyRpCap: 200,
  levels: [0, 100, 250, 500, 850, 1300, 1900, 2600, 3400, 4300],
};

async function main() {
  const db = seedDb();
  const crisis = JSON.parse(await readFile(CRISIS, 'utf8'));

  await db.doc('config/progression').set(PROGRESSION);
  await db.doc('config/crisisResources').set(crisis);

  console.log('[seed] wrote config/progression and config/crisisResources');
  if (!crisis.verified) {
    console.warn(
      '[seed] ⚠ crisisResources.verified is false — VERIFY every helpline number by\n' +
        '       calling it and set verified:true before inviting any real player (SAFETY §2, §7).',
    );
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
