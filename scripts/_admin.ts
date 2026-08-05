import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EMULATOR_PROJECT = 'demo-aura-resonance';

/**
 * Firestore handle for seeding. Two explicit modes, and it is impossible to hit
 * a live project by accident:
 *
 *   default            → forces the local emulator (FIRESTORE_EMULATOR_HOST).
 *   `--live` argv      → writes to a REAL project, and ONLY if
 *                        GOOGLE_APPLICATION_CREDENTIALS is set. Requires an
 *                        explicit flag every time.
 */
export function seedDb() {
  const live = process.argv.includes('--live');

  if (live) {
    const projectId = process.env.FIREBASE_PROJECT_ID ?? 'aura-resonance-dev';
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error(
        '[seed] --live requires GOOGLE_APPLICATION_CREDENTIALS pointing at a\n' +
          '       service-account JSON for the target project. Aborting so nothing\n' +
          '       is written without credentials.',
      );
    }
    // Guard against a stray emulator host redirecting the live write.
    delete process.env.FIRESTORE_EMULATOR_HOST;
    console.warn(`[seed] LIVE MODE — writing to project "${projectId}".`);
    if (!getApps().length) initializeApp({ projectId });
    return getFirestore();
  }

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    console.warn(
      '[seed] FIRESTORE_EMULATOR_HOST was unset; defaulting to 127.0.0.1:8080.\n' +
        '       Start the emulator first: npm run emulators (or use --live).',
    );
  }
  if (!getApps().length) initializeApp({ projectId: EMULATOR_PROJECT });
  return getFirestore();
}
