import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebase } from '@/lib/firebase';
import { errorMessage } from '@/lib/errors';
import { useIsAdmin } from '@/features/moderation/useIsAdmin';

interface Summary {
  players?: number;
  secondDayCompleters?: number;
  secondDayPct?: number;
  returnedMultiDay?: number;
  returnedPct?: number;
  funnel?: { viewed: number; checkedIn: number; verified: number };
  empathy?: { submissions: number; closedWithRatedAdvice: number; closeRatePct: number };
  moderation?: { queueOpen: number; flaggedPer100Submissions: number };
}

/**
 * Admin dashboard for the GDD §6 metrics — the whole point of v0 is being able to
 * read these without opening the Firestore console. Unlisted #metrics route; the
 * metrics/{id} read rule (isAdmin) is the real gate.
 */
export function MetricsScreen() {
  const admin = useIsAdmin();
  if (admin === 'checking') return <Centered>Checking access…</Centered>;
  if (admin === 'denied') return <Centered>Not authorised.</Centered>;
  return <Dashboard />;
}

function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(firebase().db, 'metrics', 'summary'),
        (d) => setSummary(d.exists() ? (d.data() as Summary) : {}),
        (e) => setError(e.message),
      ),
    [],
  );

  const run = async (task: string) => {
    setBusy(task);
    setError(null);
    try {
      await httpsCallable(firebase().functions, 'adminRun')({ task });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const f = summary?.funnel;
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <header className="py-2">
        <h1 className="font-display text-3xl text-slate-100">Metrics</h1>
        <p className="text-xs text-slate-500">GDD §6 · the whole point of v0</p>
      </header>

      {error && <p className="my-2 text-sm text-rose-300">{error}</p>}
      {summary === null && <p className="text-sm text-slate-500">Loading…</p>}

      {summary && (
        <div className="space-y-4">
          <Metric
            label="Second-day quest completion — the primary metric"
            value={`${summary.secondDayPct ?? 0}%`}
            sub={`${summary.secondDayCompleters ?? 0} of ${summary.players ?? 0} players`}
            warn={(summary.secondDayPct ?? 0) < 20}
          />
          <Metric
            label="Returned (opened on 2+ days)"
            value={`${summary.returnedPct ?? 0}%`}
            sub={`${summary.returnedMultiDay ?? 0} of ${summary.players ?? 0}`}
          />

          <section className="glass rounded-2xl p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Quest funnel</p>
            <div className="flex items-end justify-between gap-2 text-center">
              <Funnel n={f?.viewed} label="viewed" />
              <Funnel n={f?.checkedIn} label="checked in" />
              <Funnel n={f?.verified} label="verified" />
            </div>
          </section>

          <section className="glass rounded-2xl p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Empathy loop</p>
            <p className="text-sm text-slate-200">
              {summary.empathy?.closeRatePct ?? 0}% of submissions have rated advice
            </p>
            <p className="text-[11px] text-slate-500">
              {summary.empathy?.closedWithRatedAdvice ?? 0} of {summary.empathy?.submissions ?? 0}
            </p>
          </section>

          <section className="glass rounded-2xl p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Moderation load</p>
            <p className="text-sm text-slate-200">
              {summary.moderation?.queueOpen ?? 0} open ·{' '}
              {summary.moderation?.flaggedPer100Submissions ?? 0} per 100 submissions
            </p>
          </section>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run('metrics')}
          className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan hover:bg-aura-cyan/20 disabled:opacity-50"
        >
          {busy === 'metrics' ? 'Recomputing…' : 'Recompute metrics'}
        </button>
        <div className="grid grid-cols-3 gap-2">
          {(['respawn', 'brightness', 'truncate'] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy !== null}
              onClick={() => void run(t)}
              className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
            >
              {busy === t ? '…' : t}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-600">
          These run on a schedule in production; the buttons trigger them here for testing.
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${warn ? 'text-amber-300' : 'text-aura-cyan'}`}>
        {value}
      </p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function Funnel({ n, label }: { n?: number; label: string }) {
  return (
    <div className="flex-1">
      <p className="text-2xl font-semibold text-slate-100">{n ?? 0}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
