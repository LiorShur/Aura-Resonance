import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Record a moderation strike (SAFETY.md §3): three in 30 days → 7-day
 * suspension, five → permanent. Strikes and suspension are function-written; the
 * client can never touch them (enforced by the security rules).
 */
export async function recordStrike(
  uid: string,
  reason: string,
  refId: string,
): Promise<void> {
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const data = snap.data()!;

    const history: Timestamp[] = Array.isArray(data.strikeHistory) ? data.strikeHistory : [];
    const recent = history.filter((t) => now - t.toMillis() < 30 * DAY_MS);
    recent.push(Timestamp.fromMillis(now));
    const count = recent.length;

    let suspendedUntil = data.suspendedUntil ?? null;
    if (count >= 5) {
      suspendedUntil = Timestamp.fromMillis(now + 3650 * DAY_MS); // effectively permanent
    } else if (count >= 3) {
      suspendedUntil = Timestamp.fromMillis(now + 7 * DAY_MS);
    }

    tx.update(userRef, { strikes: count, strikeHistory: recent, suspendedUntil });
  });

  await enqueue('strike', `users/${uid}`, reason, { refId });
}

/** Put an item in front of the human reviewer (SAFETY.md §4). */
export async function enqueue(
  kind: string,
  targetPath: string,
  reason: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await getFirestore().collection('moderationQueue').add({
    kind,
    targetPath,
    reason,
    state: 'open',
    createdAt: FieldValue.serverTimestamp(),
    ...extra,
  });
}
