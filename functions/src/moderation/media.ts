import vision from '@google-cloud/vision';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { enqueue, recordStrike } from './actions.js';
import { finalizeVerifiedAttempt, markAttemptOutcome } from '../award.js';
import {
  attemptOutcomeForVerdict,
  blurFaces,
  safeSearchVerdict,
  simVerdict,
  type MediaVerdict,
} from './media-core.js';

/**
 * Storage-triggered media moderation. Vision SafeSearch + face blur; the original
 * is NEVER stored (deleted after processing), only the blurred, processed image.
 * Fails closed: on any Vision/processing error the original is deleted and the
 * media is held as `flag` (invisible) and queued — never passed.
 *
 * On a verdict it also advances the quest attempt named by the upload path
 * (`uploads/{uid}/{attemptId}`): pass/flag heals the Fracture and awards RP,
 * block rejects and records a strike, a fail-closed error holds for review.
 */
export const moderateMedia = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  if (!filePath || !filePath.startsWith('uploads/')) return; // only raw uploads

  const [, uid = '', attemptId = ''] = filePath.split('/');
  const bucket = getStorage().bucket(event.data.bucket);
  const original = bucket.file(filePath);
  const db = getFirestore();
  const mediaRef = db.collection('media').doc();

  const writeMedia = (status: string, labels: string[], storagePath: string | null, faces: number) =>
    mediaRef.set({
      uid,
      attemptId,
      storagePath,
      moderation: {
        status,
        labels,
        facesBlurred: faces,
        checkedAt: FieldValue.serverTimestamp(),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

  try {
    const [buffer] = await original.download();

    // The functions emulator has no Vision credentials; sim mode must still run
    // end to end at a desk, so the verdict is stubbed there (never in production).
    const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
    let verdict: MediaVerdict;
    let faces: Array<{
      boundingPoly?: { vertices?: Array<{ x?: number | null; y?: number | null }> | null } | null;
    }>;
    if (emulator) {
      verdict = simVerdict(event.data.metadata?.simVerdict);
      faces = [];
    } else {
      const client = new vision.ImageAnnotatorClient();
      const [safe] = await client.safeSearchDetection({ image: { content: buffer } });
      const [faceRes] = await client.faceDetection({ image: { content: buffer } });
      verdict = safeSearchVerdict(safe.safeSearchAnnotation as never);
      faces = faceRes.faceAnnotations ?? [];
    }

    if (verdict.status === 'block') {
      await original.delete().catch(() => undefined);
      await writeMedia('block', verdict.labels, null, 0);
      await recordStrike(uid, 'photo_blocked', mediaRef.id);
      await markAttemptOutcome(db, attemptId, 'reject', mediaRef.id);
      return;
    }

    const processed = await blurFaces(buffer, faces);
    const outPath = `media/${uid}/${mediaRef.id}.jpg`;
    await bucket.file(outPath).save(processed, { contentType: 'image/jpeg' });
    await original.delete().catch(() => undefined); // discard the original

    await writeMedia(verdict.status, verdict.labels, outPath, faces.length);
    if (verdict.status !== 'pass') await enqueue('media', mediaRef.path, verdict.status);

    // pass/flag → heal the Fracture and award RP for this attempt.
    if (attemptOutcomeForVerdict(verdict.status) === 'finalize') {
      await finalizeVerifiedAttempt(db, attemptId, mediaRef.id).catch((err) => {
        // The photo is fine; the attempt just couldn't be finalised (e.g. it was
        // never checked in). Surface it for review rather than losing it.
        console.error('finalizeVerifiedAttempt failed:', err);
        return enqueue('media', mediaRef.path, 'attempt_finalize_failed', { attemptId });
      });
    }
  } catch (err) {
    // Fail closed: never leave an unmoderated original, never pass on error.
    await original.delete().catch(() => undefined);
    await writeMedia('flag', ['moderation_error'], null, 0);
    await enqueue('media', mediaRef.path, 'classifier_failed_closed', { failedClosed: true });
    await markAttemptOutcome(db, attemptId, 'hold', mediaRef.id).catch(() => undefined);
    console.error('moderateMedia failed closed:', err);
  }
});
