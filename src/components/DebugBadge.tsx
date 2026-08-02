import { env } from '@/lib/env';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * Dev-only status strip. Surfaces the facts that usually explain "why is the map
 * empty" — which backend, sim vs GPS, signed-in state, and the target project —
 * so misconfiguration is visible instead of guessed at. Rendered only when
 * import.meta.env.DEV (gated at the call site), never in a production build.
 */
export function DebugBadge() {
  const status = useAuthStore((s) => s.status);
  const uid = useAuthStore((s) => s.user?.uid);

  return (
    <div className="pointer-events-none fixed bottom-1 left-1 z-50 rounded bg-black/75 px-2 py-1 font-mono text-[10px] leading-tight text-lime-300">
      {env.useEmulator ? 'EMULATOR' : 'LIVE'} · {env.simMode ? 'SIM' : 'GPS'} · {status}
      {uid ? ` · ${uid.slice(0, 6)}` : ' · (signed out)'}
      <br />
      proj {env.firebase.projectId}
    </div>
  );
}
