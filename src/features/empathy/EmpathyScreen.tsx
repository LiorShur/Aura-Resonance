import { useState } from 'react';
import { ShareDilemma } from './ShareDilemma';
import { AdvicePool } from './AdvicePool';
import { Inbox } from './Inbox';

type View = 'share' | 'advise' | 'inbox';

const TABS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'share', label: 'Share' },
  { id: 'advise', label: 'Advise' },
  { id: 'inbox', label: 'Inbox' },
];

/**
 * The Empathy Engine (GDD 3.3). Share a dilemma (screened before it's ever
 * visible), advise on others' open submissions, and read + rate the advice you
 * receive. All authoring goes through Cloud Functions; the crisis screen and
 * moderation are unbypassable.
 */
export function EmpathyScreen() {
  const [view, setView] = useState<View>('share');

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <header className="py-2">
        <h1 className="font-display text-3xl text-slate-100">Resonate</h1>
        <p className="text-xs text-slate-500">Share what's hard. Offer what you've learned.</p>
      </header>

      <div className="my-3 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              view === t.id ? 'bg-aura-cyan/20 text-aura-cyan' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {view === 'share' && <ShareDilemma />}
        {view === 'advise' && <AdvicePool />}
        {view === 'inbox' && <Inbox />}
      </div>
    </div>
  );
}
