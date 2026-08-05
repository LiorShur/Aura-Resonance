import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebase } from '@/lib/firebase';
import { AppError } from '@/lib/errors';

export type ScreenStatus = 'pending' | 'passed' | 'crisis_routed' | 'blocked';
export type SubmissionState = 'pending' | 'open' | 'closed';

export interface Submission {
  id: string;
  authorUid: string;
  bodyText: string;
  category: string;
  safetyScreen: { status: ScreenStatus; flaggedCategories: string[] };
  state: SubmissionState;
  adviceCount: number;
  createdAt?: Timestamp;
}

export interface Advice {
  id: string;
  submissionId: string;
  authorUid: string;
  text: string;
  moderation: { status: string };
  rating: number | null;
  createdAt?: Timestamp;
}

export interface CrisisResource {
  name: string;
  phone?: string;
  text?: string;
  url?: string;
  hours?: string;
}

const call = <T, R>(name: string) => httpsCallable<T, R>(firebase().functions, name);

export async function submitDilemma(bodyText: string, category: string): Promise<string> {
  const res = await call<{ bodyText: string; category: string }, { submissionId: string }>(
    'submitDilemma',
  )({ bodyText, category });
  return res.data.submissionId;
}

export async function submitAdvice(submissionId: string, text: string): Promise<string> {
  const res = await call<{ submissionId: string; text: string }, { adviceId: string }>(
    'submitAdvice',
  )({ submissionId, text });
  return res.data.adviceId;
}

export async function rateAdvice(
  adviceId: string,
  rating: number,
): Promise<{ rating: number; awarded: number }> {
  const res = await call<{ adviceId: string; rating: number }, { rating: number; awarded: number }>(
    'rateAdvice',
  )({ adviceId, rating });
  return res.data;
}

export type ReportTarget = 'submission' | 'advice' | 'echo';

/** File a report. The onReport function increments the counter + auto-hides at 2. */
export async function report(
  targetType: ReportTarget,
  targetId: string,
  reason: string,
): Promise<void> {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) throw new AppError('auth/required', 'Sign in first');
  await addDoc(collection(firebase().db, 'reports'), {
    reporterUid: uid,
    targetType,
    targetId,
    reason,
    createdAt: serverTimestamp(),
  });
}

const toSubmission = (id: string, d: Record<string, unknown>): Submission => ({
  id,
  authorUid: String(d.authorUid ?? ''),
  bodyText: String(d.bodyText ?? ''),
  category: String(d.category ?? 'other'),
  safetyScreen: (d.safetyScreen as Submission['safetyScreen']) ?? {
    status: 'pending',
    flaggedCategories: [],
  },
  state: (d.state as SubmissionState) ?? 'pending',
  adviceCount: Number(d.adviceCount ?? 0),
  createdAt: d.createdAt as Timestamp | undefined,
});

const toAdvice = (id: string, d: Record<string, unknown>): Advice => ({
  id,
  submissionId: String(d.submissionId ?? ''),
  authorUid: String(d.authorUid ?? ''),
  text: String(d.text ?? ''),
  moderation: (d.moderation as Advice['moderation']) ?? { status: 'pending' },
  rating: (d.rating as number | null) ?? null,
  createdAt: d.createdAt as Timestamp | undefined,
});

type ErrCb = (message: string) => void;

/** Live-watch a single submission (the author's own, to track screen status). */
export function watchSubmission(
  id: string,
  cb: (s: Submission | null) => void,
  onError?: ErrCb,
): () => void {
  return onSnapshot(
    doc(firebase().db, 'empathySubmissions', id),
    (d) => cb(d.exists() ? toSubmission(d.id, d.data()) : null),
    (e) => onError?.(e.message),
  );
}

/**
 * The advice pool: open, screened submissions, newest first. Both `state==open`
 * AND `safetyScreen.status==passed` are required in the query — not just because
 * the data has both, but because the security rule's read condition names both,
 * and Firestore rejects a query that doesn't constrain every field the rule
 * checks (that rejection is what silently hung the list before).
 */
export function watchOpenPool(cb: (subs: Submission[]) => void, onError?: ErrCb): () => void {
  const q = query(
    collection(firebase().db, 'empathySubmissions'),
    where('safetyScreen.status', '==', 'passed'),
    where('state', '==', 'open'),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toSubmission(d.id, d.data()))),
    (e) => onError?.(e.message),
  );
}

/** The signed-in author's own submissions, newest first. */
export function watchMySubmissions(
  uid: string,
  cb: (subs: Submission[]) => void,
  onError?: ErrCb,
): () => void {
  const q = query(
    collection(firebase().db, 'empathySubmissions'),
    where('authorUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toSubmission(d.id, d.data()))),
    (e) => onError?.(e.message),
  );
}

/** The signed-in user's own advice (any moderation status), newest first. */
export function watchMyAdvice(
  uid: string,
  cb: (advice: Advice[]) => void,
  onError?: ErrCb,
): () => void {
  const q = query(
    collection(firebase().db, 'empathyAdvice'),
    where('authorUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toAdvice(d.id, d.data()))),
    (e) => onError?.(e.message),
  );
}

/** Passed advice for a submission (rules only expose moderation-passed advice). */
export function watchAdvice(
  submissionId: string,
  cb: (advice: Advice[]) => void,
  onError?: ErrCb,
): () => void {
  const q = query(
    collection(firebase().db, 'empathyAdvice'),
    where('submissionId', '==', submissionId),
    where('moderation.status', '==', 'pass'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toAdvice(d.id, d.data()))),
    (e) => onError?.(e.message),
  );
}

interface SeededLine {
  name: string;
  number?: string;
  hours?: string;
  url?: string;
}

/**
 * Region-appropriate crisis resources (SAFETY §2). Reads the shape written by
 * scripts/seed-config.ts ({ regions: { IL: { lines: [...] }, XX: {...} } }) and
 * falls back to the international list when the player's region isn't mapped.
 */
export async function getCrisisResources(region: string): Promise<CrisisResource[]> {
  const snap = await getDoc(doc(firebase().db, 'config', 'crisisResources'));
  const regions =
    (snap.data()?.regions as Record<string, { lines?: SeededLine[] }> | undefined) ?? {};
  const lines = (regions[region] ?? regions.XX)?.lines ?? [];
  return lines.map((l) => ({
    name: l.name,
    phone: l.number || undefined,
    hours: l.hours,
    url: l.url,
  }));
}
