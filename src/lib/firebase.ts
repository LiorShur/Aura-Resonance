import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
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

  const app = initializeApp(env.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);
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
