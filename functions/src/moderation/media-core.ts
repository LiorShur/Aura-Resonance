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

/**
 * How a media verdict advances the quest attempt (SAFETY §3 outcomes):
 *   pass/flag → the act is accepted, the Fracture heals (flag is still visible,
 *               just queued for review); block → rejected + strike; anything else
 *               (a fail-closed error) → held for human review, never healed.
 */
export function attemptOutcomeForVerdict(
  status: MediaVerdict['status'] | 'error',
): 'finalize' | 'reject' | 'hold' {
  if (status === 'pass' || status === 'flag') return 'finalize';
  if (status === 'block') return 'reject';
  return 'hold';
}

/**
 * Emulator/dev verdict: the functions emulator has no Vision credentials, so the
 * loop must run without them (sim mode is non-negotiable). Defaults to a clean
 * pass; an upload may carry `simVerdict` metadata to exercise the flag/block
 * paths. NEVER used in production — the real Vision call runs there.
 */
export function simVerdict(forced: string | undefined): MediaVerdict {
  if (forced === 'block') return { status: 'block', labels: ['sim'] };
  if (forced === 'flag') return { status: 'flag', labels: ['sim'] };
  return { status: 'pass', labels: [] };
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
