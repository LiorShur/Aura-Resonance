import { useAuthStore } from './authStore';

/**
 * Shown while an account is under an active suspension window (SAFETY §3). Strike
 * accumulation and the durations behind it are implemented in M4; this screen is
 * the player-facing surface for that state.
 */
export function SuspendedScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const until = profile?.suspendedUntil?.toDate();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-3xl text-slate-100">Your Aura is resting</h1>
      <p className="max-w-xs text-sm text-slate-400">
        Your account is paused
        {until ? ` until ${until.toLocaleDateString()}` : ''}. This happens after
        repeated community-guideline issues.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-200 hover:bg-white/10"
      >
        Sign out
      </button>
    </div>
  );
}
