import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { logEvent } from '@/lib/analytics';
import type { LatLng } from '@/lib/geo';
import { useAuthStore } from '@/features/auth/authStore';
import type { Fracture } from '@/features/map/types';
import {
  completeCoop,
  joinCoop,
  openCoop,
  setReady,
  watchSession,
  type CoopSession,
} from './coopApi';

type Step = 'choose' | 'hosting' | 'joining' | 'active' | 'done';

/**
 * Co-op quest flow (GDD 3.5). One player hosts (gets a code), the other joins
 * with it; the server verifies both are in range and near each other, then a
 * shared ready-check heals the Fracture for both. Two sim windows drive the two
 * players. Rendered inside the quest sheet for session_code Fractures.
 */
export function CoopFlow({
  fracture,
  player,
  onHealed,
}: {
  fracture: Fracture;
  player: LatLng;
  onHealed: () => void;
}) {
  const uid = useAuthStore((s) => s.user?.uid);
  const [step, setStep] = useState<Step>('choose');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<CoopSession | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    return watchSession(sessionId, setSession);
  }, [sessionId]);

  // React to server-driven state changes on the shared session.
  useEffect(() => {
    if (!session) return;
    if (session.state === 'verified' || session.state === 'solving') {
      setStep((s) => (s === 'hosting' || s === 'joining' ? 'active' : s));
    } else if (session.state === 'complete') {
      logEvent('coop_complete', { fractureId: fracture.id });
      setStep('done');
      onHealed();
    }
  }, [session, onHealed, fracture.id]);

  const run = async (fn: () => Promise<void>) => {
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

  const role: 'host' | 'guest' = session && uid === session.hostUid ? 'host' : 'guest';
  const myReady = session?.puzzleState?.[`${role}Ready`] ?? false;
  const partnerReady = session?.puzzleState?.[role === 'host' ? 'guestReady' : 'hostReady'] ?? false;
  const bothReady = Boolean(session?.puzzleState?.hostReady && session?.puzzleState?.guestReady);

  if (step === 'choose') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-500">
          This Fracture needs two Weavers. One of you opens a code; the other joins with it.
          You must both be here together.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await openCoop(fracture.id, player);
              setSessionId(r.sessionId);
              setStep('hosting');
            })
          }
          className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan hover:bg-aura-cyan/20 disabled:opacity-50"
        >
          Open a co-op code
        </button>
        <button
          type="button"
          onClick={() => setStep('joining')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10"
        >
          Join with a code
        </button>
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </div>
    );
  }

  if (step === 'hosting') {
    return (
      <div className="text-center">
        <p className="text-xs text-slate-500">Share this code with your partner:</p>
        <p className="my-2 font-display text-4xl tracking-[0.4em] text-aura-cyan">
          {session?.code ?? '····'}
        </p>
        <p className="text-xs text-slate-400">Waiting for them to join…</p>
        <p className="mt-1 text-[11px] text-slate-600">Code expires in 10 minutes.</p>
      </div>
    );
  }

  if (step === 'joining') {
    return (
      <div className="space-y-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="4-digit code"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-display text-2xl tracking-[0.4em] outline-none focus:border-aura-cyan/50"
        />
        <button
          type="button"
          disabled={busy || code.length !== 4}
          onClick={() =>
            run(async () => {
              const r = await joinCoop(code, player);
              setSessionId(r.sessionId);
              setStep('active');
            })
          }
          className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan hover:bg-aura-cyan/20 disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </div>
    );
  }

  if (step === 'active') {
    return (
      <div className="text-center">
        <p className="mb-1 text-sm text-aura-green">You're paired ✓</p>
        <p className="mb-3 text-xs text-slate-500">
          You: {myReady ? 'ready' : 'not ready'} · Partner: {partnerReady ? 'ready' : 'not ready'}
        </p>
        {!bothReady ? (
          <button
            type="button"
            disabled={busy || myReady}
            onClick={() => sessionId && run(() => setReady(sessionId, role))}
            className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan hover:bg-aura-cyan/20 disabled:opacity-50"
          >
            {myReady ? 'Waiting for your partner…' : "I'm ready"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => sessionId && run(() => completeCoop(sessionId).then(() => undefined))}
            className="w-full rounded-xl border border-aura-green/40 bg-aura-green/10 px-4 py-3 text-sm font-medium text-aura-green hover:bg-aura-green/20 disabled:opacity-50"
          >
            {busy ? 'Mending…' : 'Stabilise together'}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-display text-2xl text-aura-cyan">Mended together</p>
      <p className="mt-1 text-sm text-slate-200">+50 RP each</p>
    </div>
  );
}
