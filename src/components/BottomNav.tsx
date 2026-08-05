export type TabId = 'map' | 'auras' | 'resonate' | 'inventory' | 'profile';

const TABS: ReadonlyArray<{ id: TabId; label: string; glyph: string }> = [
  { id: 'map', label: 'Map', glyph: '✦' },
  { id: 'auras', label: 'Auras', glyph: '❧' },
  { id: 'resonate', label: 'Resonate', glyph: '✧' },
  { id: 'inventory', label: 'Inventory', glyph: '◈' },
  { id: 'profile', label: 'Profile', glyph: '☺' },
];

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="glass z-20 flex items-stretch justify-around px-1 py-1.5">
      {TABS.map((t) => {
        const isActive = t.id === active;
        const isCenter = t.id === 'resonate';
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition-colors',
              isActive ? 'text-aura-cyan' : 'text-slate-400',
            ].join(' ')}
          >
            <span
              className={[
                'grid h-9 w-9 place-items-center rounded-full text-lg',
                isCenter && 'bg-aura-violet/20 ring-1 ring-aura-violet/40',
                isActive && !isCenter && 'bg-white/5',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {t.glyph}
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
