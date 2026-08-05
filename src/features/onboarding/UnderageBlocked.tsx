import { useAuthStore } from '@/features/auth/authStore';
import { MIN_AGE } from './age';

/**
 * Shown when the age gate blocks account creation. Plain and non-punitive — no
 * "restricted mode", no jargon, no accusation. The account was not created; the
 * server already removed the auth user, so we just sign out cleanly.
 */
export function UnderageBlocked() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-3xl text-slate-100">Not just yet</h1>
      <p className="max-w-xs text-sm text-slate-400">
        Aura Resonance is for people aged {MIN_AGE} and over. Thanks for your
        interest — we hope to see you when you’re a little older.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-200 hover:bg-white/10"
      >
        Close
      </button>
    </div>
  );
}
