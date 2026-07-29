import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { emulatorDb } from './_admin';

interface Template {
  id: string;
  type: string;
  title: string;
  prompt: string;
  verification: 'photo' | 'breathing' | 'session_code';
  rpReward: number;
  minAuraLevel: number;
  category: string;
}

const DATA = fileURLToPath(new URL('./data/quest-templates.json', import.meta.url));

async function main() {
  const templates: Template[] = JSON.parse(await readFile(DATA, 'utf8'));
  const db = emulatorDb();

  const batch = db.batch();
  for (const { id, ...rest } of templates) {
    batch.set(db.collection('questTemplates').doc(id), rest);
  }
  await batch.commit();

  console.log(`[seed] wrote ${templates.length} quest templates`);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
