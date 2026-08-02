import { useEffect, useState } from 'react';
import { getCrisisResources, type CrisisResource } from './empathyApi';

/**
 * Shown when a submission is crisis-routed (SAFETY §2). Warm, non-clinical, never
 * "rejected" or "policy" — the author came with something hard and gets pointed
 * somewhere that can actually help, not told they broke a rule.
 */
export function CrisisCard({ region }: { region: string }) {
  const [resources, setResources] = useState<CrisisResource[] | null>(null);

  useEffect(() => {
    let live = true;
    getCrisisResources(region)
      .then((r) => live && setResources(r))
      .catch(() => live && setResources([]));
    return () => {
      live = false;
    };
  }, [region]);

  return (
    <div className="rounded-2xl border border-aura-cyan/20 bg-aura-cyan/5 p-4">
      <p className="text-sm text-slate-100">
        Thank you for trusting us with this. What you're carrying sounds really heavy — more
        than a game full of strangers is the right place for. You deserve support from someone
        trained to help, and it's here whenever you're ready.
      </p>

      {resources === null ? (
        <p className="mt-3 text-xs text-slate-500">Finding support near you…</p>
      ) : resources.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          If you're in immediate danger, please contact your local emergency number.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {resources.map((r) => (
            <li key={r.name} className="rounded-xl bg-white/5 p-3">
              <p className="text-sm font-medium text-slate-100">{r.name}</p>
              {r.phone && <p className="text-sm text-aura-cyan">{r.phone}</p>}
              {r.text && <p className="text-xs text-slate-300">{r.text}</p>}
              {r.hours && <p className="text-[11px] text-slate-500">{r.hours}</p>}
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-aura-cyan underline-offset-2 hover:underline"
                >
                  {r.url}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
