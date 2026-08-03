import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Store an FCM token and opt the user in to reminders. */
export const registerPushToken = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');
  const token = String((request.data as { token?: string })?.token ?? '');
  if (!token) throw new HttpsError('invalid-argument', 'missing-token');
  await getFirestore().doc(`users/${uid}`).update({
    fcmTokens: FieldValue.arrayUnion(token),
    notifOptIn: true,
  });
  return { ok: true };
});

/** Toggle reminders without discarding tokens (so re-enabling is instant). */
export const setReminders = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');
  const enabled = Boolean((request.data as { enabled?: boolean })?.enabled);
  await getFirestore().doc(`users/${uid}`).update({ notifOptIn: enabled });
  return { ok: true, enabled };
});

/**
 * Send at most one quest reminder per opted-in user per day (GDD: "one per day
 * maximum"). Prunes tokens the FCM service reports as dead so the list doesn't
 * rot. Exported for the scheduled wrapper and the admin trigger.
 */
export async function sendRemindersCore(db: Firestore): Promise<number> {
  const now = Date.now();
  const users = await db.collection('users').where('notifOptIn', '==', true).limit(5000).get();
  let sent = 0;

  for (const d of users.docs) {
    const u = d.data();
    const tokens: string[] = Array.isArray(u.fcmTokens) ? u.fcmTokens : [];
    if (!tokens.length) continue;
    const last = (u.lastReminderAt as Timestamp | undefined)?.toMillis?.() ?? 0;
    if (now - last < DAY_MS) continue; // one per day maximum

    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: 'A Fracture is waiting nearby',
        body: 'Heal one small thing near you today.',
      },
      data: { type: 'quest_reminder' },
    });

    const dead: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code ?? '';
      if (
        !r.success &&
        (code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered')
      ) {
        dead.push(tokens[i]!);
      }
    });

    const patch: Record<string, unknown> = { lastReminderAt: Timestamp.fromMillis(now) };
    if (dead.length) patch.fcmTokens = FieldValue.arrayRemove(...dead);
    await d.ref.update(patch);
    sent++;
  }
  return sent;
}

export const sendQuestReminders = onSchedule('every 24 hours', async () => {
  await sendRemindersCore(getFirestore());
});
