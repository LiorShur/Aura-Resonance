import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  brightnessFor,
  funnelFromEvents,
  pct,
  returnedOnMultipleDays,
  secondDayCompleters,
} from './metrics-core.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RESPAWN_COOLDOWN_MS = 6 * 60 * 60 * 1000; // healed Fractures reactivate after 6h
const round2 = (x: number) => Math.round(x * 100) / 100; // ~1.1km precision

/** Reactivate Fractures healed more than the cooldown ago. */
async function respawnFracturesCore(db: Firestore): Promise<number> {
  const cutoff = Date.now() - RESPAWN_COOLDOWN_MS;
  const snap = await db.collection('fractures').where('status', '==', 'healed').get();
  const batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    const healedAt = d.data().healedAt as Timestamp | undefined;
    if (!healedAt || healedAt.toMillis() < cutoff) {
      batch.update(d.ref, { status: 'active', respawnAt: null });
      n++;
    }
  }
  if (n) await batch.commit();
  return n;
}

/** Neighbourhood brightness = healed Fractures in the last 7 days (GDD §4). */
async function recomputeBrightnessCore(db: Firestore): Promise<void> {
  const since = Date.now() - 7 * DAY_MS;
  const snap = await db.collection('fractures').get();
  const byHood = new Map<string, { total: number; healed7d: number }>();
  for (const d of snap.docs) {
    const f = d.data();
    const hood = String(f.neighbourhoodId ?? 'sim');
    const agg = byHood.get(hood) ?? { total: 0, healed7d: 0 };
    agg.total++;
    const healedAt = f.healedAt as Timestamp | undefined;
    if (f.status === 'healed' && healedAt && healedAt.toMillis() >= since) agg.healed7d++;
    byHood.set(hood, agg);
  }
  const neighbourhoods: Record<string, { healed7d: number; total: number; brightness: number }> = {};
  let overallHealed = 0;
  for (const [id, v] of byHood) {
    neighbourhoods[id] = { healed7d: v.healed7d, total: v.total, brightness: brightnessFor(v.healed7d) };
    overallHealed += v.healed7d;
  }
  await db.doc('config/mapBrightness').set({
    neighbourhoods,
    overall: brightnessFor(overallHealed),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Truncate check-in coordinates older than 30 days to ~1km (SAFETY §6). */
async function truncateLocationsCore(db: Firestore): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - 30 * DAY_MS);
  const batch = db.batch();
  let n = 0;

  const attempts = await db.collection('questAttempts').where('startedAt', '<', cutoff).get();
  for (const d of attempts.docs) {
    const g = d.data().checkInGeo as { lat?: number; lng?: number } | null | undefined;
    if (g && typeof g.lat === 'number' && typeof g.lng === 'number') {
      batch.update(d.ref, { checkInGeo: { lat: round2(g.lat), lng: round2(g.lng) } });
      n++;
    }
  }

  const coops = await db.collection('coopSessions').where('createdAt', '<', cutoff).get();
  for (const d of coops.docs) {
    const s = d.data();
    const patch: Record<string, unknown> = {};
    for (const key of ['hostGeo', 'guestGeo'] as const) {
      const g = s[key] as { lat?: number; lng?: number } | null | undefined;
      if (g && typeof g.lat === 'number' && typeof g.lng === 'number') {
        patch[key] = { lat: round2(g.lat), lng: round2(g.lng) };
      }
    }
    if (Object.keys(patch).length) {
      batch.update(d.ref, patch);
      n++;
    }
  }

  if (n) await batch.commit();
  return n;
}

/** Aggregate the GDD §6 metrics into metrics/summary (admin-readable). */
async function computeMetricsCore(db: Firestore): Promise<Record<string, unknown>> {
  const [users, events, subs, advice, queue] = await Promise.all([
    db.collection('users').limit(5000).get(),
    db.collection('analytics_events').limit(20000).get(),
    db.collection('empathySubmissions').limit(5000).get(),
    db.collection('empathyAdvice').limit(20000).get(),
    db.collection('moderationQueue').where('state', '==', 'open').limit(5000).get(),
  ]);

  const userLite = users.docs.map((d) => ({
    distinctActiveDays: Number(d.data().stats?.distinctActiveDays ?? 0),
  }));
  const evLite = events.docs.map((d) => {
    const data = d.data();
    return {
      event: String(data.event ?? ''),
      uid: String(data.uid ?? ''),
      tsMs: (data.ts as Timestamp | undefined)?.toMillis?.() ?? 0,
    };
  });
  const appOpens = evLite.filter((e) => e.event === 'app_open').map((e) => ({ uid: e.uid, tsMs: e.tsMs }));

  const ratedSubs = new Set(
    advice.docs.filter((d) => d.data().rating != null).map((d) => String(d.data().submissionId)),
  );
  const closed = subs.docs.filter((d) => ratedSubs.has(d.id)).length;
  const secondDay = secondDayCompleters(userLite);
  const returned = returnedOnMultipleDays(appOpens);

  const summary = {
    players: users.size,
    secondDayCompleters: secondDay,
    secondDayPct: pct(secondDay, users.size),
    returnedMultiDay: returned,
    returnedPct: pct(returned, users.size),
    funnel: funnelFromEvents(evLite),
    empathy: {
      submissions: subs.size,
      closedWithRatedAdvice: closed,
      closeRatePct: pct(closed, subs.size),
    },
    moderation: {
      queueOpen: queue.size,
      flaggedPer100Submissions: subs.size ? Math.round((queue.size / subs.size) * 100) : 0,
    },
    computedAt: FieldValue.serverTimestamp(),
  };
  await db.doc('metrics/summary').set(summary);
  return summary;
}

// --- Scheduled (production) ---
export const respawnFractures = onSchedule('every 60 minutes', async () => {
  await respawnFracturesCore(getFirestore());
});
export const recomputeMapBrightness = onSchedule('every 24 hours', async () => {
  await recomputeBrightnessCore(getFirestore());
});
export const truncateOldLocations = onSchedule('every 24 hours', async () => {
  await truncateLocationsCore(getFirestore());
});
export const dailyMetrics = onSchedule('every 24 hours', async () => {
  await computeMetricsCore(getFirestore());
});

// --- Admin-triggerable (so schedules are demonstrable in the emulator) ---
export const adminRun = onCall(async (request) => {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'admin-only');
  }
  const task = String((request.data as { task?: string })?.task ?? '');
  const db = getFirestore();
  switch (task) {
    case 'respawn':
      return { task, respawned: await respawnFracturesCore(db) };
    case 'brightness':
      await recomputeBrightnessCore(db);
      return { task, ok: true };
    case 'truncate':
      return { task, truncated: await truncateLocationsCore(db) };
    case 'metrics':
      return { task, summary: await computeMetricsCore(db) };
    default:
      throw new HttpsError('invalid-argument', 'unknown-task');
  }
});
