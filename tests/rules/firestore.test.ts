import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

/**
 * The security-rules specification, executed. Per CLAUDE.md "Emulator tests
 * before rules": these assertions ARE the spec. If a rule is removed, the
 * matching test here must fail.
 */

let testEnv: RulesTestEnvironment;

const ALICE = 'alice';
const BOB = 'bob';

// A complete, valid users/{uid} baseline (as the createProfile function writes).
const baseUser = (uid: string) => ({
  uid,
  displayName: 'Weaver',
  avatarSeed: 'seed-' + uid,
  auraLevel: 1,
  resonancePoints: 0,
  ageConfirmed: true,
  ageConfirmedAt: new Date(),
  homeRegion: 'IL',
  strikes: 0,
  suspendedUntil: null,
  createdAt: new Date(),
  lastActiveAt: new Date(),
  stats: { questsCompleted: 0, distinctActiveDays: 0, echoesCreated: 0, adviceGiven: 0 },
});

/** Seed data bypassing rules, the way Cloud Functions (admin) would write it. */
async function seed(fn: (db: import('firebase/firestore').Firestore) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as import('firebase/firestore').Firestore);
  });
}

beforeAll(async () => {
  const [host, portStr] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-aura-resonance',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host,
      port: Number(portStr),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('users — the cardinal rule', () => {
  it('a client cannot create its own user document', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'users', ALICE), baseUser(ALICE)));
  });

  it('a client cannot raise resonancePoints, auraLevel, or strikes', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', ALICE), baseUser(ALICE));
    });
    const db = testEnv.authenticatedContext(ALICE).firestore();
    // Use values that differ from the baseline — a no-op write to a protected
    // field produces no diff and is (harmlessly) allowed; what must be blocked
    // is actually changing the value.
    await assertFails(updateDoc(doc(db, 'users', ALICE), { resonancePoints: 9999 }));
    await assertFails(updateDoc(doc(db, 'users', ALICE), { auraLevel: 50 }));
    await assertFails(updateDoc(doc(db, 'users', ALICE), { strikes: 5 }));
  });

  it('a client can edit only its vanity fields', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', ALICE), baseUser(ALICE));
    });
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'users', ALICE), {
        displayName: 'New Name',
        avatarSeed: 'fresh',
        lastActiveAt: serverTimestamp(),
      }),
    );
  });

  it('a client cannot edit another user', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', ALICE), baseUser(ALICE));
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, 'users', ALICE), { displayName: 'hacked' }));
  });

  it('a client cannot write to its own ledger', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'users', ALICE, 'ledger', 'e1'), {
        delta: 1000,
        reason: 'quest_complete',
        balanceAfter: 1000,
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('questAttempts — cannot self-award', () => {
  const attempt = (uid: string, state: string) => ({
    uid,
    fractureId: 'f1',
    templateId: 't1',
    state,
    startedAt: serverTimestamp(),
    completedAt: null,
  });

  it('may be created only in the started state', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, 'questAttempts', 'qa1'), attempt(ALICE, 'started')));
  });

  it('cannot be created already verified', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'questAttempts', 'qa2'), attempt(ALICE, 'verified')));
  });

  it('cannot be created for another player', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'questAttempts', 'qa3'), attempt(BOB, 'started')));
  });

  it('cannot be advanced past started by the client', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'questAttempts', 'qa4'), attempt(ALICE, 'started'));
    });
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, 'questAttempts', 'qa4'), { state: 'verified' }));
  });
});

describe('empathySubmissions — invisible until screened', () => {
  const pending = {
    authorUid: ALICE,
    bodyText: 'a'.repeat(120),
    category: 'family',
    safetyScreen: { status: 'pending', flaggedCategories: [], screenedAt: null },
    state: 'pending',
    adviceCount: 0,
    createdAt: new Date(),
    closedAt: null,
    deleteAt: new Date(),
  };

  it('an unscreened submission is unreadable by another player', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'empathySubmissions', 's1'), pending);
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(getDoc(doc(db, 'empathySubmissions', 's1')));
  });

  it('the author can read their own pending submission', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'empathySubmissions', 's1'), pending);
    });
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(db, 'empathySubmissions', 's1')));
  });

  it('a passed + open submission is readable by others', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'empathySubmissions', 's2'), {
        ...pending,
        safetyScreen: { status: 'passed', flaggedCategories: [], screenedAt: new Date() },
        state: 'open',
      });
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, 'empathySubmissions', 's2')));
  });

  it('a client cannot write submissions directly', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'empathySubmissions', 's3'), pending));
  });
});

describe('echoes — visible only when passed and not hidden', () => {
  const echo = (mod: string, hidden: boolean) => ({
    authorUid: ALICE,
    text: 'be kind',
    geo: { lat: 32, lng: 34, geohash: 'sv8' },
    moderation: { status: mod, labels: [] },
    reportCount: 0,
    hidden,
    createdAt: new Date(),
    expiresAt: new Date(),
  });

  it('a pending echo is not readable', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'echoes', 'e1'), echo('pending', false));
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(getDoc(doc(db, 'echoes', 'e1')));
  });

  it('a passed, unhidden echo is readable', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'echoes', 'e2'), echo('pass', false));
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, 'echoes', 'e2')));
  });

  it('an auto-hidden echo is not readable even if passed', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'echoes', 'e3'), echo('pass', true));
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(getDoc(doc(db, 'echoes', 'e3')));
  });
});

describe('content + analytics', () => {
  it('fractures are readable but not client-writable', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'fractures', 'f1'), { type: 'kindness', status: 'active' });
    });
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(db, 'fractures', 'f1')));
    await assertFails(setDoc(doc(db, 'fractures', 'f2'), { type: 'kindness', status: 'active' }));
  });

  it('analytics events can be written but never read by clients', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'analytics_events', 'ev1'), {
        uid: ALICE,
        event: 'quest_view',
        params: {},
        ts: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(db, 'analytics_events', 'ev1')));
  });

  it('an unauthenticated client cannot read users', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', ALICE), baseUser(ALICE));
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users', ALICE)));
  });
});

describe('moderationQueue + reports — admin-gated (SAFETY §4)', () => {
  it('an ordinary player cannot read the moderation queue', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'moderationQueue', 'q1'), {
        kind: 'echo',
        targetPath: 'echoes/e1',
        reason: 'harassment',
        state: 'open',
        createdAt: new Date(),
      });
    });
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(getDoc(doc(db, 'moderationQueue', 'q1')));
  });

  it('an admin can read the moderation queue', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'moderationQueue', 'q2'), {
        kind: 'media',
        targetPath: 'media/m1',
        reason: 'classifier_failed_closed',
        state: 'open',
        createdAt: new Date(),
      });
    });
    const db = testEnv.authenticatedContext('mod', { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'moderationQueue', 'q2')));
  });

  it('not even an admin can write the queue from a client', async () => {
    const db = testEnv.authenticatedContext('mod', { admin: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'moderationQueue', 'q3'), { kind: 'echo', state: 'open' }),
    );
  });

  it('a player can file a report but cannot read reports back', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'reports', 'r1'), {
        reporterUid: ALICE,
        targetPath: 'echoes/e1',
        reason: 'abuse',
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(db, 'reports', 'r1')));
  });
});
