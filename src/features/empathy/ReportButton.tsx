import { useState } from 'react';
import { report, type ReportTarget } from './empathyApi';

/**
 * The report control every piece of UGC must carry (SAFETY §4). Two independent
 * reports auto-hide the item (server-side), so this is deliberately low-friction.
 */
export function ReportButton({ target, id }: { target: ReportTarget; id: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');

  if (state === 'done') return <span className="text-[11px] text-slate-500">Reported — thank you</span>;

  return (
    <button
      type="button"
      disabled={state === 'sending'}
      onClick={() => {
        setState('sending');
        report(target, id, 'user_reported')
          .then(() => setState('done'))
          .catch(() => setState('idle'));
      }}
      className="text-[11px] text-slate-500 underline-offset-2 hover:text-rose-300 hover:underline disabled:opacity-50"
    >
      {state === 'sending' ? 'Reporting…' : 'Report'}
    </button>
  );
}
