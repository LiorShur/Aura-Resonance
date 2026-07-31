// End-to-end check of the M3 quest loop against the emulator suite.
// Run via: firebase emulators:exec --only auth,firestore,functions \
//   --project demo-aura-resonance "node scripts/e2e-quest.mjs"
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  addDoc,
  collection,
  doc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const PROJECT = 'demo-aura-resonance';
const assert = (cond, msg) => {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓ ' + msg);
};

// --- admin (bypasses rules), for seeding + verification of writes ---
adminInit({ projectId: PROJECT });
const admin = adminGetFirestore();

// --- client SDK against the emulator ---
const app = initializeApp({ apiKey: 'demo', projectId: PROJECT });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
const fns = getFunctions(app);
connectFunctionsEmulator(fns, '127.0.0.1', 5001);

async function main() {
  // Seed content the way the seed scripts / functions would.
  await admin.doc('config/progression').set({ dailyRpCap: 200 });
  await admin.doc('questTemplates/litter-01').set({ type: 'kindness', rpReward: 30 });
  const FGEO = { lat: 32.0853, lng: 34.7818, geohash: 'sv8wsqqqqq' };
  await admin.doc('fractures/F1').set({
    type: 'kindness',
    templateId: 'litter-01',
    geo: FGEO,
    radiusM: 50,
    status: 'active',
    healCount: 0,
    healedBy: [],
    activeHours: { from: 0, to: 24 },
  });

  const cred = await createUserWithEmailAndPassword(auth, `p${Date.now()}@example.com`, 'password123');
  const uid = cred.user.uid;
  await admin.doc(`users/${uid}`).set({
    uid, displayName: 'Tester', avatarSeed: 's', auraLevel: 1, resonancePoints: 0,
    ageConfirmed: true, homeRegion: 'IL', strikes: 0, suspendedUntil: null,
    stats: { questsCompleted: 0, distinctActiveDays: 0, echoesCreated: 0, adviceGiven: 0 },
  });

  // Client creates the attempt in the only allowed state.
  const attemptRef = await addDoc(collection(db, 'questAttempts'), {
    uid, fractureId: 'F1', templateId: 'litter-01', state: 'started',
    checkInGeo: null, checkInDistanceM: null, startedAt: new Date(), completedAt: null,
  });
  const attemptId = attemptRef.id;
  console.log('attempt', attemptId);

  // 1. Out-of-range check-in is rejected with distance remaining.
  const far = await httpsCallable(fns, 'submitCheckIn')({ attemptId, position: { lat: 32.10, lng: 34.79 } });
  assert(far.data.status === 'rejected', 'out-of-range check-in is rejected');
  assert(far.data.remainingM > 0, 'rejection reports distance remaining');

  // 2. In-range check-in advances the attempt.
  const near = await httpsCallable(fns, 'submitCheckIn')({ attemptId, position: { lat: 32.08532, lng: 34.7818 } });
  assert(near.data.status === 'checked_in', 'in-range check-in advances to checked_in');

  // 3. The client CANNOT fake the state transition directly.
  let blocked = false;
  try {
    await updateDoc(doc(db, 'questAttempts', attemptId), { state: 'verified' });
  } catch {
    blocked = true;
  }
  assert(blocked, 'client cannot write questAttempts.state directly');

  // 4. The client CANNOT award itself points directly.
  let pointsBlocked = false;
  try {
    await setDoc(doc(db, 'users', uid), { resonancePoints: 9999 }, { merge: true });
  } catch {
    pointsBlocked = true;
  }
  assert(pointsBlocked, 'client cannot write resonancePoints directly');

  // 5. Verification heals the Fracture, awards RP, writes the ledger.
  const verify = await httpsCallable(fns, 'submitVerification')({ attemptId });
  assert(verify.data.status === 'verified', 'verification completes');
  assert(verify.data.awarded === 30, `awarded 30 RP (got ${verify.data.awarded})`);

  const userAfter = (await admin.doc(`users/${uid}`).get()).data();
  assert(userAfter.resonancePoints === 30, 'user balance is 30');
  assert(userAfter.stats.questsCompleted === 1, 'questsCompleted incremented');

  const ledger = await admin.collection(`users/${uid}/ledger`).get();
  assert(ledger.size === 1, 'exactly one ledger entry written');
  assert(ledger.docs[0].data().delta === 30, 'ledger entry delta is 30');

  const fractureAfter = (await admin.doc('fractures/F1').get()).data();
  assert(fractureAfter.status === 'healed', 'Fracture healed');
  assert(fractureAfter.healCount === 1, 'healCount incremented');

  console.log('\nE2E QUEST: PASS');
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('\nE2E QUEST: FAIL\n', e.message);
    process.exit(1);
  },
);
