import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { formatDistance, type LatLng } from '@/lib/geo';
import { ReportButton } from '@/features/empathy/ReportButton';
import { createEcho, watchEchoesNear, type Echo } from './echoesApi';

const ECHO_MAX = 140;

/**
 * Leave and discover Echoes near the player (GDD 3.4). A left Echo is invisible
 * until it clears moderation, so the list refreshes shortly after posting.
 */
export function EchoPanel({ player, onClose }: { player: LatLng; onClose: () => void }) {
  const [echoes, setEchoes] = useState<Echo[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => watchEchoesNear(player, setEchoes, setError), [player, reload]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await createEcho(text, player);
      setText('');
      setPosted(true);
      // Give moderateEcho a moment, then refresh the nearby list.
      window.setTimeout(() => setReload((n) => n + 1), 1500);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const len = text.trim().length;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3">
      <div className="glass max-h-[70vh] overflow-y-auto rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg text-slate-100">Echoes nearby</h2>
          <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
            Close
          </button>
        </div>

        {echoes === null ? (
          <p className="text-sm text-slate-500">Listening…</p>
        ) : echoes.length === 0 ? (
          <p className="text-sm text-slate-400">No Echoes within 50m. Leave the first one.</p>
        ) : (
          <ul className="space-y-2">
            {echoes.map((e) => (
              <li key={e.id} className="rounded-xl bg-white/5 p-3">
                <p className="text-sm text-slate-200">{e.text}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{formatDistance(e.distanceM)} away</span>
                  <ReportButton target="echo" id={e.id} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-white/10 pt-3">
          {posted && (
            <p className="mb-2 text-xs text-aura-green">
              Left here — it appears once it clears moderation.
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={ECHO_MAX}
            placeholder="Leave an encouraging line for whoever passes here next…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-aura-cyan/50"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{len === 0 ? 'Text only, 140 chars' : 'Anchored to where you are now'}</span>
            <span>
              {len}/{ECHO_MAX}
            </span>
          </div>
          {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
          <button
            type="button"
            disabled={busy || len === 0}
            onClick={() => void send()}
            className="mt-2 w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-2.5 text-sm font-medium text-aura-cyan hover:bg-aura-cyan/20 disabled:opacity-40"
          >
            {busy ? 'Leaving…' : 'Leave an Echo'}
          </button>
        </div>
      </div>
    </div>
  );
}
