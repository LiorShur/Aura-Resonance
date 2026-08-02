import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/features/auth/authStore';
import { CATEGORIES, DILEMMA_MAX, DILEMMA_MIN } from './categories';
import { submitDilemma, watchSubmission, type Submission } from './empathyApi';
import { CrisisCard } from './CrisisCard';

export function ShareDilemma() {
  const profile = useAuthStore((s) => s.profile);
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    return watchSubmission(submissionId, setSubmission);
  }, [submissionId]);

  const len = body.trim().length;
  const valid = len >= DILEMMA_MIN && len <= DILEMMA_MAX;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setSubmissionId(await submitDilemma(body, category));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // After submitting, show the outcome of the safety screen.
  if (submissionId) {
    const status = submission?.safetyScreen.status ?? 'pending';
    if (status === 'crisis_routed') return <CrisisCard region={profile?.homeRegion ?? 'XX'} />;

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        {status === 'pending' && (
          <p className="text-slate-300">
            Thanks — we're just making sure this is a good fit for the pool. One moment…
          </p>
        )}
        {status === 'passed' && (
          <p className="text-aura-green">
            Shared. Up to five people can now offer their perspective — check back in your
            Inbox for replies.
          </p>
        )}
        {status === 'blocked' && (
          <p className="text-slate-300">
            We couldn't share this one with the pool. If you're going through something hard,
            please reach out to someone you trust.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setSubmissionId(null);
            setSubmission(null);
            setBody('');
          }}
          className="mt-3 text-xs text-aura-cyan underline-offset-2 hover:underline"
        >
          Share something else
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-400">
        Share something you're working through. A few others will read it and offer their
        perspective — kindly, and anonymously.
      </p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              category === c.id
                ? 'bg-aura-cyan/20 text-aura-cyan'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        maxLength={DILEMMA_MAX}
        placeholder="What's on your mind?"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{len < DILEMMA_MIN ? `${DILEMMA_MIN - len} more characters to go` : 'Ready'}</span>
        <span>
          {len}/{DILEMMA_MAX}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => void send()}
        className="mt-3 w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-40"
      >
        {busy ? 'Sharing…' : 'Share with the pool'}
      </button>
    </div>
  );
}
