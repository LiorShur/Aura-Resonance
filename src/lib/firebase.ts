import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions';
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';
import { env } from './env';

// Standard emulator ports (see firebase.json). Kept here so the single place that
// wires the SDKs is the single place that knows the ports.
const EMULATOR_HOST = '127.0.0.1';
const PORTS = { auth: 9099, firestore: 8080, storage: 9199, functions: 5001 } as const;

// The emulator suite runs under this project (see scripts/emulators.mjs and the
// seed scripts). Callable functions and Firestore data are namespaced by project
// ID, so the client MUST use this one in emulator mode — otherwise it calls
// /<live-project>/…/createProfile, which the emulator doesn't serve, and every
// callable returns "internal". This override makes the emulator immune to
// whatever project the live VITE_FIREBASE_* values point at.
const EMULATOR_PROJECT = 'demo-aura-resonance';

let cached: {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
} | null = null;

/**
 * Initialise Firebase once and, in emulator mode, point every SDK at the local
 * suite. In v0 development this is always the emulator — no real project needed.
 */
export function firebase() {
  if (cached) return cached;

  // In emulator mode, pin the project (and bucket) to the emulator's own, so
  // functions routing and Firestore data namespacing line up regardless of the
  // live VITE_FIREBASE_* values in .env.local.
  const config = env.useEmulator
    ? {
        ...env.firebase,
        projectId: EMULATOR_PROJECT,
        storageBucket: `${EMULATOR_PROJECT}.appspot.com`,
      }
    : env.firebase;

  const app = initializeApp(config);
  const auth = getAuth(app);
  // Persistent local cache: the map, profile, and content stay readable offline
  // (M10 offline handling). Multi-tab manager so two windows share one cache.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const storage = getStorage(app);
  const functions = getFunctions(app);

  if (env.useEmulator) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${PORTS.auth}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, EMULATOR_HOST, PORTS.firestore);
    connectStorageEmulator(storage, EMULATOR_HOST, PORTS.storage);
    connectFunctionsEmulator(functions, EMULATOR_HOST, PORTS.functions);
  }

  cached = { app, auth, db, storage, functions };
  return cached;
}
