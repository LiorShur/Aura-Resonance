import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { moderateTextContent, screenCrisis } from './classify.js';
import { crisisClassifier, textClassifier } from './anthropic.js';
import { enqueue, recordStrike } from './actions.js';

// Anthropic key is a Functions secret — never in the client bundle (CLAUDE.md).
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/**
 * Crisis screen (SAFETY.md §2). Runs BEFORE a submission is ever visible:
 * submissions enter as `pending`, and only a passing screen flips them to
 * `open`. A crisis routes to resources; a fail-closed result stays `pending`
 * and is queued — never shown to strangers.
 */
export const screenDilemma = onDocumentCreated(
  { document: 'empathySubmissions/{id}', secrets: [ANTHROPIC_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();

    const screen = await screenCrisis(String(data.bodyText ?? ''), crisisClassifier);

    const update: Record<string, unknown> = {
      'safetyScreen.status': screen.status,
      'safetyScreen.flaggedCategories': screen.category ? [screen.category] : [],
      'safetyScreen.screenedAt': FieldValue.serverTimestamp(),
    };
    if (screen.status === 'passed') update.state = 'open';
    await snap.ref.update(update);

    if (screen.status !== 'passed') {
      await enqueue(
        'empathy_submission',
        snap.ref.path,
        screen.status === 'pending' ? 'classifier_failed_closed' : 'crisis_routed',
        { failedClosed: screen.failedClosed },
      );
    }
  },
);

async function moderateBody(
  ref: FirebaseFirestore.DocumentReference,
  text: string,
  authorUid: string,
  kind: 'echo' | 'advice',
) {
  const res = await moderateTextContent(text, textClassifier);
  await ref.update({ 'moderation.status': res.status, 'moderation.labels': res.categories });
  if (res.status === 'block') {
    await recordStrike(authorUid, `${kind}_blocked`, ref.id);
  } else if (res.status !== 'pass') {
    await enqueue(kind, ref.path, res.status, { failedClosed: res.failedClosed });
  }
}

/** Shared text moderation for Echoes (SAFETY.md §3). */
export const moderateEcho = onDocumentCreated(
  { document: 'echoes/{id}', secrets: [ANTHROPIC_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const d = snap.data();
    await moderateBody(snap.ref, String(d.text ?? ''), String(d.authorUid ?? ''), 'echo');
  },
);

/** Shared text moderation for empathy advice. */
export const moderateAdvice = onDocumentCreated(
  { document: 'empathyAdvice/{id}', secrets: [ANTHROPIC_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const d = snap.data();
    await moderateBody(snap.ref, String(d.text ?? ''), String(d.authorUid ?? ''), 'advice');
  },
);

const TARGET_COLLECTIONS: Record<string, string> = {
  echo: 'echoes',
  advice: 'empathyAdvice',
  submission: 'empathySubmissions',
  media: 'media',
  user: 'users',
};

/**
 * Reporting (SAFETY.md §4): increment the target's report counter and auto-hide
 * at two independent reports — hiding is cheap and reversible; leaving harmful
 * content up is neither.
 */
export const onReport = onDocumentCreated('reports/{id}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const r = snap.data();
  const coll = TARGET_COLLECTIONS[String(r.targetType)];
  if (!coll) return;

  const db = getFirestore();
  const targetRef = db.doc(`${coll}/${String(r.targetId)}`);
  await db.runTransaction(async (tx) => {
    const t = await tx.get(targetRef);
    if (!t.exists) return;
    const count = Number(t.data()?.reportCount ?? 0) + 1;
    const patch: Record<string, unknown> = { reportCount: count };
    if (count >= 2) patch.hidden = true; // auto-hide pending review
    tx.update(targetRef, patch);
  });

  await enqueue('report', targetRef.path, String(r.reason ?? 'reported'));
});
