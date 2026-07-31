import { useState } from 'react';
import { bearingDeg, compassPoint, formatDistance, type LatLng } from '@/lib/geo';
import { getCurrentPosition } from '@/lib/geolocation';
import { errorMessage } from '@/lib/errors';
import { FRACTURE_STYLE, type Fracture } from '@/features/map/types';
import { useTemplate } from './templates';
import { callCheckIn, callVerify, createAttempt, type VerifyResult } from './questApi';

type Step = 'intro' | 'checking' | 'checked_in' | 'verifying' | 'done';

const VERIFY_HINT: Record<string, string> = {
  photo: 'Photo verification arrives in M5 — completing directly for now.',
  breathing: 'The breathing puzzle arrives in M6 — completing directly for now.',
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

  const [step, setStep] = useState<Step>('intro');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const imHere = async () => {
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

  const complete = async () => {
    if (!attemptId) return;
    setStep('verifying');
    setError(null);
    try {
      setResult(await callVerify(attemptId));
      setStep('done');
      onHealed();
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

        {step !== 'done' && <p className="mb-3 text-sm text-slate-300">{template.prompt}</p>}

        {(step === 'intro' || step === 'checking') && (
          <>
            {remaining !== null && (
              <p className="mb-2 text-xs text-amber-300">
                You’re still {formatDistance(remaining)} away — move closer and try again.
              </p>
            )}
            <button
              type="button"
              disabled={step === 'checking'}
              onClick={() => void imHere()}
              className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-50"
            >
              {step === 'checking' ? 'Checking…' : remaining !== null ? 'Try again' : "I’m here"}
            </button>
          </>
        )}

        {(step === 'checked_in' || step === 'verifying') && (
          <>
            <p className="mb-1 text-sm text-aura-green">You’re here ✓</p>
            <p className="mb-3 text-xs text-slate-500">{VERIFY_HINT[template.verification]}</p>
            <button
              type="button"
              disabled={step === 'verifying'}
              onClick={() => void complete()}
              className="w-full rounded-xl border border-aura-green/40 bg-aura-green/10 px-4 py-3 text-sm font-medium text-aura-green transition hover:bg-aura-green/20 disabled:opacity-50"
            >
              {step === 'verifying' ? 'Healing…' : 'Complete quest'}
            </button>
          </>
        )}

        {step === 'done' && result && (
          <div className="text-center">
            <p className="font-display text-2xl text-aura-cyan">Fracture healed</p>
            <p className="mt-1 text-sm text-slate-200">
              {result.awarded > 0 ? `+${result.awarded} RP` : 'Daily cap reached — no RP this time'}
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

        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>
    </div>
  );
}
