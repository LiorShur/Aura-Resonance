import sharp from 'sharp';

// Pure media-moderation logic, free of the Storage trigger (which needs runtime
// bucket config), so SafeSearch mapping is unit-testable.

export type Likelihood =
  | 'UNKNOWN'
  | 'VERY_UNLIKELY'
  | 'UNLIKELY'
  | 'POSSIBLE'
  | 'LIKELY'
  | 'VERY_LIKELY';

const BLOCK_AT = new Set<Likelihood>(['LIKELY', 'VERY_LIKELY']);
const FLAG_AT = new Set<Likelihood>(['POSSIBLE']);

export interface MediaVerdict {
  status: 'pass' | 'flag' | 'block';
  labels: string[];
}

/**
 * SafeSearch → verdict. adult / violence / racy at LIKELY or above block
 * (SAFETY.md §3); POSSIBLE flags for review; the rest pass.
 */
export function safeSearchVerdict(
  ss: Partial<Record<'adult' | 'violence' | 'racy', Likelihood | string | null | undefined>> | null | undefined,
): MediaVerdict {
  const labels: string[] = [];
  let status: MediaVerdict['status'] = 'pass';
  for (const cat of ['adult', 'violence', 'racy'] as const) {
    const l = ss?.[cat] as Likelihood | undefined;
    if (l && BLOCK_AT.has(l)) {
      labels.push(cat);
      status = 'block';
    } else if (l && FLAG_AT.has(l) && status === 'pass') {
      labels.push(cat);
      status = 'flag';
    }
  }
  return { status, labels };
}

interface Vertex {
  x?: number | null;
  y?: number | null;
}

/** Blur every detected face before storage (SAFETY.md §3). */
export async function blurFaces(
  buffer: Buffer,
  faces: Array<{ boundingPoly?: { vertices?: Vertex[] | null } | null }>,
): Promise<Buffer> {
  if (!faces.length) return buffer;
  const meta = await sharp(buffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;

  const composites: sharp.OverlayOptions[] = [];
  for (const f of faces) {
    const vs = f.boundingPoly?.vertices ?? [];
    if (vs.length < 2) continue;
    const xs = vs.map((v) => v.x ?? 0);
    const ys = vs.map((v) => v.y ?? 0);
    const left = Math.max(0, Math.min(...xs));
    const top = Math.max(0, Math.min(...ys));
    const width = Math.min(W - left, Math.max(...xs) - left);
    const height = Math.min(H - top, Math.max(...ys) - top);
    if (width <= 0 || height <= 0) continue;
    const region = await sharp(buffer).extract({ left, top, width, height }).blur(25).toBuffer();
    composites.push({ input: region, left, top });
  }
  return composites.length ? sharp(buffer).composite(composites).toBuffer() : buffer;
}
