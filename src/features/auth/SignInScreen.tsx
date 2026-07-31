import { useEffect, useState } from 'react';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import {
  completeEmailLink,
  isEmailLink,
  sendEmailLink,
  signInWithGoogle,
} from '@/lib/auth';

/**
 * Sign-in: Google popup or passwordless email link. On return via an email link
 * we complete the flow automatically. Against the Auth emulator the "sent" link
 * is printed to the emulator logs rather than emailed — the hint says so in sim.
 */
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEmailLink()) {
      completeEmailLink().catch((e) => setError(errorMessage(e)));
    }
  }, []);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
      <header className="text-center">
        <h1 className="font-display text-5xl tracking-wide text-aura-cyan">Aura</h1>
        <p className="mt-1 text-sm uppercase tracking-[0.3em] text-slate-400">Resonance</p>
        <p className="mt-4 max-w-xs text-sm text-slate-400">
          Heal the fractures in your community, one small kindness at a time.
        </p>
      </header>

      <div className="glass w-full max-w-sm space-y-4 rounded-3xl p-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => withBusy(signInWithGoogle)}
          className="w-full rounded-xl bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
        </div>

        {sent ? (
          <p className="text-center text-sm text-slate-300">
            Check your email for a sign-in link.
            {env.simMode && (
              <span className="mt-1 block text-xs text-amber-300/80">
                Sim mode: the link is printed in the Auth emulator logs (terminal / localhost:4000).
              </span>
            )}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void withBusy(async () => {
                await sendEmailLink(email);
                setSent(true);
              });
            }}
            className="space-y-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50"
            />
            <button
              type="submit"
              disabled={busy || !email}
              className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-50"
            >
              Email me a sign-in link
            </button>
          </form>
        )}

        {error && <p className="text-center text-sm text-rose-300">{error}</p>}
      </div>

      <p className="max-w-xs text-center text-xs text-slate-500">
        You must be 16 or older. By continuing you agree to our community
        guidelines and privacy policy.
      </p>
    </div>
  );
}
