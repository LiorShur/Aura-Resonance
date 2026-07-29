import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'demo-aura-resonance';

/**
 * Admin Firestore handle pointed at the local emulator. Seeding NEVER runs
 * against a real project — it refuses to start unless FIRESTORE_EMULATOR_HOST is
 * set, so a stray run can't write to production.
 */
export function emulatorDb() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    console.warn(
      '[seed] FIRESTORE_EMULATOR_HOST was unset; defaulting to 127.0.0.1:8080.\n' +
        '       Start the emulator first: npm run emulators',
    );
  }
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return getFirestore();
}
