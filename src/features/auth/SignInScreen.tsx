import { useEffect, useState } from 'react';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import {
  completeEmailLink,
  isEmailLink,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/auth';

type Mode = 'signin' | 'signup';

/**
 * Sign-in: Google popup or email + password. Creating an account drops straight
 * into onboarding (age gate + profile). Email/password is the simplest way to run
 * two accounts side by side against the emulator. A returning email-link URL (the
 * older flow) is still completed automatically if present.
 */
export function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void withBusy(() =>
      mode === 'signup'
        ? signUpWithPassword(email.trim(), password)
        : signInWithPassword(email.trim(), password),
    );
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

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50"
          />
          <button
            type="submit"
            disabled={busy || !email || password.length < 6}
            className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
            setError(null);
          }}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === 'signup'
            ? 'Already have an account? Sign in'
            : 'New here? Create an account'}
        </button>

        {env.simMode && (
          <p className="text-center text-[11px] text-amber-300/80">
            Sim mode: accounts live in the local Auth emulator. Use any email (e.g.
            a@test.com) — no real inbox needed.
          </p>
        )}

        {error && <p className="text-center text-sm text-rose-300">{error}</p>}
      </div>

      <p className="max-w-xs text-center text-xs text-slate-500">
        You must be 16 or older. By continuing you agree to our community
        guidelines and{' '}
        <a href="#/privacy" className="text-aura-cyan underline-offset-2 hover:underline">
          privacy policy
        </a>
        .
      </p>
    </div>
  );
}
