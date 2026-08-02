import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/features/auth/authStore';
import { CATEGORY_LABEL } from './categories';
import {
  rateAdvice,
  watchAdvice,
  watchMySubmissions,
  type Advice,
  type Submission,
} from './empathyApi';
import { ReportButton } from './ReportButton';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Screening…',
  passed: 'Open for advice',
  crisis_routed: 'We pointed you to support',
  blocked: 'Not shared',
};

export function Inbox() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [subs, setSubs] = useState<Submission[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchMySubmissions(uid, setSubs);
  }, [uid]);

  if (!subs) return <p className="text-sm text-slate-500">Loading…</p>;
  if (subs.length === 0) {
    return <p className="text-sm text-slate-400">Nothing yet. Share something in the Share tab.</p>;
  }

  return (
    <ul className="space-y-3">
      {subs.map((s) => (
        <InboxCard key={s.id} submission={s} />
      ))}
    </ul>
  );
}

function InboxCard({ submission }: { submission: Submission }) {
  const [advice, setAdvice] = useState<Advice[]>([]);
  const open = submission.safetyScreen.status === 'passed';

  useEffect(() => {
    if (!open) return;
    return watchAdvice(submission.id, setAdvice);
  }, [submission.id, open]);

  return (
    <li className="glass rounded-2xl p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {CATEGORY_LABEL[submission.category] ?? submission.category}
        </span>
        <span className="text-[11px] text-slate-500">
          {STATUS_LABEL[submission.safetyScreen.status] ?? submission.safetyScreen.status}
        </span>
      </div>
      <p className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-300">{submission.bodyText}</p>

      {open && (
        <div className="mt-3 space-y-2">
          {advice.length === 0 ? (
            <p className="text-xs text-slate-500">No advice yet — hang tight.</p>
          ) : (
            advice.map((a) => <AdviceRow key={a.id} advice={a} />)
          )}
        </div>
      )}
    </li>
  );
}

function AdviceRow({ advice }: { advice: Advice }) {
  const [rating, setRating] = useState<number | null>(advice.rating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rate = async (n: number) => {
    setBusy(true);
    setError(null);
    const prev = rating;
    setRating(n); // optimistic
    try {
      await rateAdvice(advice.id, n);
    } catch (e) {
      setRating(prev);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="whitespace-pre-wrap text-sm text-slate-200">{advice.text}</p>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => void rate(n)}
              aria-label={`Rate ${n} of 5`}
              className={`text-lg leading-none transition ${
                rating && n <= rating ? 'text-aura-cyan' : 'text-slate-600 hover:text-slate-400'
              } disabled:opacity-50`}
            >
              ★
            </button>
          ))}
        </div>
        <ReportButton target="advice" id={advice.id} />
      </div>
      {error && <p className="mt-1 text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
