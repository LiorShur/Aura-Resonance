import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/features/auth/authStore';
import { CATEGORY_LABEL, ADVICE_MAX, ADVICE_MIN } from './categories';
import { submitAdvice, watchOpenPool, type Submission } from './empathyApi';
import { ReportButton } from './ReportButton';

export function AdvicePool() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [subs, setSubs] = useState<Submission[] | null>(null);

  useEffect(() => watchOpenPool(setSubs), []);

  if (!subs) return <p className="text-sm text-slate-500">Loading the pool…</p>;
  // Never advise your own submission (also enforced server-side).
  const pool = subs.filter((s) => s.authorUid !== uid);

  if (pool.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No one's waiting for advice right now. Check back soon — or share something yourself.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {pool.map((s) => (
        <PoolCard key={s.id} submission={s} />
      ))}
    </ul>
  );
}

function PoolCard({ submission }: { submission: Submission }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const len = text.trim().length;
  const valid = len >= ADVICE_MIN && len <= ADVICE_MAX;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitAdvice(submission.id, text);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="glass rounded-2xl p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {CATEGORY_LABEL[submission.category] ?? submission.category}
        </span>
        <span className="text-[11px] text-slate-500">{submission.adviceCount}/5 replies</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-200">{submission.bodyText}</p>

      {sent ? (
        <p className="mt-3 text-sm text-aura-green">
          Sent — thank you. It'll appear once it clears moderation.
        </p>
      ) : open ? (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={ADVICE_MAX}
            placeholder="Offer something kind and useful…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-aura-cyan/50"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{len < ADVICE_MIN ? 'A little more…' : 'Ready'}</span>
            <span>
              {len}/{ADVICE_MAX}
            </span>
          </div>
          {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!valid || busy}
              onClick={() => void send()}
              className="flex-1 rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-3 py-2 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send advice'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-3 py-1.5 text-xs font-medium text-aura-cyan transition hover:bg-aura-cyan/20"
          >
            Offer advice
          </button>
          <ReportButton target="submission" id={submission.id} />
        </div>
      )}
    </li>
  );
}
