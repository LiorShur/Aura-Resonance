// Client-side image prep for quest verification. Photos are downscaled before
// upload so we send ~200 KB, not a 5 MB phone capture — the original never
// leaves in full resolution, and the Storage size cap (8 MB) is never a factor.

const MAX_DIM = 1280;
const JPEG_QUALITY = 0.8;

/**
 * Downscale an image File/Blob to at most MAX_DIM on its longest edge and
 * re-encode as JPEG. Returns the processed Blob (always image/jpeg).
 */
export async function downscaleImage(input: Blob): Promise<Blob> {
  const bitmap = await loadBitmap(input);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-2d-context');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await canvasToJpeg(canvas);
  } finally {
    bitmap.close?.();
  }
}

/**
 * A synthetic photo for sim mode, so the whole verification loop runs at a desk
 * with no camera (CLAUDE.md: "Sim mode is not optional"). Draws a labelled
 * gradient tile — enough for a real upload → moderation → heal round-trip.
 */
export async function makeSimPhoto(label: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  const g = ctx.createLinearGradient(0, 0, 640, 640);
  g.addColorStop(0, '#0b1220');
  g.addColorStop(0.5, '#0e7490');
  g.addColorStop(1, '#6d28d9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 640);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('sim photo', 320, 300);
  ctx.font = '400 22px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(label.slice(0, 40), 320, 344);
  return canvasToJpeg(canvas);
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode-failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

async function loadBitmap(input: Blob): Promise<ImageBitmap> {
  // createImageBitmap handles EXIF orientation on modern engines and avoids the
  // <img> onload dance; it is available in every browser we target.
  return createImageBitmap(input);
}
