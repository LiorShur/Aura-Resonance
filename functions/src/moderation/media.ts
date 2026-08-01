import vision from '@google-cloud/vision';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { enqueue, recordStrike } from './actions.js';
import { blurFaces, safeSearchVerdict } from './media-core.js';

/**
 * Storage-triggered media moderation. Vision SafeSearch + face blur; the original
 * is NEVER stored (deleted after processing), only the blurred, processed image.
 * Fails closed: on any Vision/processing error the original is deleted and the
 * media is held as `flag` (invisible) and queued — never passed.
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
    const client = new vision.ImageAnnotatorClient();
    const [safe] = await client.safeSearchDetection({ image: { content: buffer } });
    const [faceRes] = await client.faceDetection({ image: { content: buffer } });

    const verdict = safeSearchVerdict(safe.safeSearchAnnotation as never);
    const faces = faceRes.faceAnnotations ?? [];

    if (verdict.status === 'block') {
      await original.delete().catch(() => undefined);
      await writeMedia('block', verdict.labels, null, 0);
      await recordStrike(uid, 'photo_blocked', mediaRef.id);
      return;
    }

    const processed = await blurFaces(buffer, faces);
    const outPath = `media/${uid}/${mediaRef.id}.jpg`;
    await bucket.file(outPath).save(processed, { contentType: 'image/jpeg' });
    await original.delete().catch(() => undefined); // discard the original

    await writeMedia(verdict.status, verdict.labels, outPath, faces.length);
    if (verdict.status !== 'pass') await enqueue('media', mediaRef.path, verdict.status);
  } catch (err) {
    // Fail closed: never leave an unmoderated original, never pass on error.
    await original.delete().catch(() => undefined);
    await writeMedia('flag', ['moderation_error'], null, 0);
    await enqueue('media', mediaRef.path, 'classifier_failed_closed', { failedClosed: true });
    console.error('moderateMedia failed closed:', err);
  }
});
