import { useEffect, useRef, useState } from 'react';
import { bearingDeg, compassPoint, formatDistance, type LatLng } from '@/lib/geo';
import { getCurrentPosition } from '@/lib/geolocation';
import { errorMessage } from '@/lib/errors';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/analytics';
import { useOnline } from '@/lib/useOnline';
import { FRACTURE_STYLE, type Fracture } from '@/features/map/types';
import { useTemplate } from './templates';
import { downscaleImage, makeSimPhoto } from './photo';
import { BreatheScreen } from '@/features/breathe/BreatheScreen';
import { CoopFlow } from '@/features/coop/CoopFlow';
import {
  callCheckIn,
  callVerify,
  createAttempt,
  uploadQuestPhoto,
  watchAttempt,
  type VerifyOptions,
} from './questApi';

type Step =
  | 'intro'
  | 'checking'
  | 'checked_in'
  | 'breathing'
  | 'uploading'
  | 'pending'
  | 'verifying'
  | 'done'
  | 'blocked'
  | 'review';

// Session-code (co-op) still completes directly until M8.
const DIRECT_HINT: Record<string, string> = {
  session_code: 'Co-op sessions arrive in M8 — completing directly for now.',
};

interface QuestSheetProps {
  fracture: Fracture;
  distanceM: number;
  player: LatLng;
  /** True when this is a client-only sample (no server document to complete). */
  isSample: boolean;
  onClose: () => void;
  onHealed: () => void;
}

export function QuestSheet({ fracture, distanceM, player, isSample, onClose, onHealed }: QuestSheetProps) {
  const template = useTemplate(fracture.templateId, fracture.type);
  const style = FRACTURE_STYLE[fracture.type];
  const isPhoto = template.verification === 'photo';
  const isBreathing = template.verification === 'breathing';
  const isCoop = template.verification === 'session_code';

  const [step, setStep] = useState<Step>('intro');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ awarded: number; capped: boolean } | null>(null);
  const [pendingLong, setPendingLong] = useState(false);
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);

  // Funnel: the player opened this Fracture (GDD §6).
  useEffect(() => {
    logEvent('quest_view', { fractureId: fracture.id, type: fracture.type });
  }, [fracture.id, fracture.type]);

  // While a photo is in moderation, watch the attempt for its resolution rather
  // than leaving the player on a spinner (the trigger writes the outcome).
  useEffect(() => {
    if (step !== 'pending' || !attemptId) return;
    const unsub = watchAttempt(attemptId, (snap) => {
      if (snap.state === 'verified') {
        setDone({ awarded: snap.awardedRp ?? 0, capped: snap.awardCapped });
        logEvent('quest_verified', { fractureId: fracture.id, type: fracture.type });
        setStep('done');
        onHealed();
      } else if (snap.state === 'rejected') {
        setStep('blocked');
      } else if (snap.state === 'submitted' && snap.heldForReview) {
        setStep('review');
      }
    });
    const timer = window.setTimeout(() => setPendingLong(true), 25000);
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [step, attemptId, onHealed]);

  const imHere = async () => {
    if (isSample) {
      setError(
        'This is a sample Fracture. Seed your database (npm run seed:live, or run the emulator) to complete real quests.',
      );
      return;
    }
    setStep('checking');
    setError(null);
    setRemaining(null);
    try {
      const id = attemptId ?? (await createAttempt(fracture));
      setAttemptId(id);
      const { coords } = await getCurrentPosition();
      const r = await callCheckIn(id, coords);
      if (r.status === 'rejected') {
        setRemaining(r.remainingM);
        setStep('intro');
      } else {
        logEvent('quest_checkin', { fractureId: fracture.id, type: fracture.type });
        setStep('checked_in');
      }
    } catch (e) {
      const msg = errorMessage(e);
      setError(
        isSample || msg.includes('not-found') || msg.includes('fracture')
          ? 'This is a sample Fracture. Seed the database (npm run seed:live, or run the emulator) to complete real quests.'
          : msg,
      );
      setStep('intro');
    }
  };

  // Non-photo completion (breathing self-reports cycles; session_code is trusted
  // until M8). On failure, return to wherever the player was so they can retry.
  const runVerify = async (opts: VerifyOptions = {}, backTo: Step = 'checked_in') => {
    if (!attemptId) return;
    setStep('verifying');
    setError(null);
    try {
      const r = await callVerify(attemptId, opts);
      setDone({ awarded: r.awarded, capped: r.capped });
      logEvent('quest_verified', { fractureId: fracture.id, type: fracture.type });
      setStep('done');
      onHealed();
    } catch (e) {
      setError(errorMessage(e));
      setStep(backTo);
    }
  };

  const submitPhoto = async (file?: File, sim?: 'pass' | 'flag' | 'block') => {
    if (!attemptId) return;
    setError(null);
    setPendingLong(false);
    setStep('uploading');
    try {
      const blob = file ? await downscaleImage(file) : await makeSimPhoto(template.title);
      await uploadQuestPhoto(attemptId, blob, sim);
      setStep('pending');
    } catch (e) {
      setError(errorMessage(e));
      setStep('checked_in');
    }
  };

  const bearing = compassPoint(bearingDeg(player, fracture.geo));

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 p-3">
      <div className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-base"
            style={{ backgroundColor: `${style.color}22` }}
          >
            {style.glyph}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-100">{template.title}</p>
            <p className="text-xs text-slate-400">
              {style.label} · {formatDistance(distanceM)} · {bearing} · +{template.rpReward} RP
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-slate-200">
            Close
          </button>
        </div>

        {step !== 'done' && step !== 'blocked' && step !== 'review' && (
          <p className="mb-3 text-sm text-slate-300">{template.prompt}</p>
        )}

        {(step === 'intro' || step === 'checking') && (
          <>
            <p className="mb-2 text-[11px] text-slate-500">
              ⚠ Stay aware of your surroundings.
            </p>
            {remaining !== null && (
              <p className="mb-2 text-xs text-amber-300">
                You’re still {formatDistance(remaining)} away — move closer and try again.
              </p>
            )}
            {!online && (
              <p className="mb-2 text-xs text-amber-300">
                You’re offline — checking in needs a connection. We’ll enable this the moment
                you’re back.
              </p>
            )}
            <button
              type="button"
              disabled={step === 'checking' || !online}
              onClick={() => void imHere()}
              className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-50"
            >
              {step === 'checking'
                ? 'Checking…'
                : !online
                  ? 'Offline'
                  : remaining !== null
                    ? 'Try again'
                    : "I’m here"}
            </button>
            {/* Walking directions in the OS map app — a plain external link, no
                background location or tracking (hard constraint). */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${fracture.geo.lat},${fracture.geo.lng}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-xs text-slate-300 transition hover:bg-white/10"
            >
              ↗ Directions
            </a>
          </>
        )}

        {step === 'checked_in' && (
          <>
            <p className="mb-1 text-sm text-aura-green">You’re here ✓</p>

            {isPhoto ? (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  Add a photo of your act to heal this Fracture. Any faces are automatically
                  blurred and the original photo is never stored.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void submitPhoto(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-xl border border-aura-green/40 bg-aura-green/10 px-4 py-3 text-sm font-medium text-aura-green transition hover:bg-aura-green/20"
                >
                  Take / choose photo
                </button>
                {env.simMode && (
                  <button
                    type="button"
                    onClick={() => void submitPhoto()}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10"
                  >
                    Use sim photo
                  </button>
                )}
                {env.useEmulator && (
                  <button
                    type="button"
                    onClick={() => void submitPhoto(undefined, 'block')}
                    className="mt-2 w-full rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-xs text-rose-300/80 hover:bg-rose-500/10"
                  >
                    Simulate blocked photo (emulator)
                  </button>
                )}
              </>
            ) : isBreathing ? (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  This Fracture is unstable. Breathe with the pacer to stabilise it — the
                  pieces settle as you complete each cycle.
                </p>
                <button
                  type="button"
                  onClick={() => setStep('breathing')}
                  className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20"
                >
                  Begin breathing
                </button>
              </>
            ) : isCoop ? (
              <CoopFlow fracture={fracture} player={player} onHealed={onHealed} />
            ) : (
              <>
                <p className="mb-3 text-xs text-slate-500">{DIRECT_HINT[template.verification]}</p>
                <button
                  type="button"
                  onClick={() => void runVerify()}
                  className="w-full rounded-xl border border-aura-green/40 bg-aura-green/10 px-4 py-3 text-sm font-medium text-aura-green transition hover:bg-aura-green/20"
                >
                  Complete quest
                </button>
              </>
            )}
          </>
        )}

        {step === 'breathing' && (
          <BreatheScreen
            busy={false}
            onComplete={(cycles) => void runVerify({ breathingCyclesCompleted: cycles }, 'breathing')}
            onSkip={() =>
              void runVerify(
                { breathingCyclesCompleted: 0, breathingSkipped: true },
                'breathing',
              )
            }
          />
        )}

        {(step === 'uploading' || step === 'verifying') && (
          <p className="py-2 text-sm text-slate-300">
            {step === 'uploading' ? 'Preparing your photo…' : 'Healing…'}
          </p>
        )}

        {step === 'pending' && (
          <div className="py-1">
            <p className="text-sm text-aura-cyan">Checking your photo…</p>
            <p className="mt-1 text-xs text-slate-500">
              {pendingLong
                ? 'Still checking — your Fracture will heal once the photo clears. You can close this and check back shortly.'
                : 'This takes a moment — faces are being blurred and the photo screened for safety.'}
            </p>
            {pendingLong && (
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
              >
                Close
              </button>
            )}
          </div>
        )}

        {step === 'done' && done && (
          <div className="text-center">
            <p className="font-display text-2xl text-aura-cyan">Fracture healed</p>
            <p className="mt-1 text-sm text-slate-200">
              {done.awarded > 0 ? `+${done.awarded} RP` : 'Daily cap reached — no RP this time'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
            >
              Done
            </button>
          </div>
        )}

        {step === 'blocked' && (
          <div>
            <p className="text-sm font-medium text-rose-300">This photo can’t be used</p>
            <p className="mt-1 text-xs text-slate-400">
              It didn’t pass our safety check, so no Fracture was healed. Please try a
              different photo of your act. Repeated issues may limit your account.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
            >
              Close
            </button>
          </div>
        )}

        {step === 'review' && (
          <div>
            <p className="text-sm text-aura-cyan">Thanks — your photo needs a quick check</p>
            <p className="mt-1 text-xs text-slate-400">
              We couldn’t auto-clear this one, so a person will take a quick look. If it’s
              fine, the Fracture heals shortly. The original photo is never stored.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
            >
              Close
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>
    </div>
  );
}
