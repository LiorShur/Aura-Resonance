import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebase } from '@/lib/firebase';
import { useAuthStore } from '@/features/auth/authStore';

// Mirrors DEFAULT_LEVEL_THRESHOLDS in functions/src/quest-core.ts; the live values
// come from config/progression so the ring matches what the server awards.
const DEFAULT_THRESHOLDS = [0, 100, 250, 500, 850, 1300, 1900, 2600, 3400, 4300];

interface LevelProgress {
  level: number;
  floor: number;
  ceil: number | null; // null = max level reached
  toNext: number;
  fraction: number; // 0..1 within the current level
}

function progressFor(rp: number, level: number, thresholds: number[]): LevelProgress {
  const floor = thresholds[level - 1] ?? 0;
  const ceil = thresholds[level] ?? null; // next-level threshold, or none at the top
  if (ceil === null) return { level, floor, ceil, toNext: 0, fraction: 1 };
  const span = Math.max(1, ceil - floor);
  return {
    level,
    floor,
    ceil,
    toNext: Math.max(0, ceil - rp),
    fraction: Math.max(0, Math.min(1, (rp - floor) / span)),
  };
}

export function AurasScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [thresholds, setThresholds] = useState<number[]>(DEFAULT_THRESHOLDS);
  const [glow, setGlow] = useState<number | null>(null);

  useEffect(() => {
    const db = firebase().db;
    const a = onSnapshot(doc(db, 'config', 'progression'), (d) => {
      const levels = d.data()?.levels;
      if (Array.isArray(levels) && levels.length) setThresholds(levels as number[]);
    });
    const b = onSnapshot(doc(db, 'config', 'mapBrightness'), (d) =>
      setGlow(typeof d.data()?.overall === 'number' ? (d.data()!.overall as number) : null),
    );
    return () => {
      a();
      b();
    };
  }, []);

  if (!profile) return null;
  const rp = profile.resonancePoints;
  const p = progressFor(rp, profile.auraLevel, thresholds);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <header className="py-2">
        <h1 className="font-display text-3xl text-slate-100">Your Aura</h1>
        <p className="text-xs text-slate-500">Every small kindness brightens it.</p>
      </header>

      <div className="flex flex-col items-center py-6">
        <Ring fraction={p.fraction} level={p.level} />
        <p className="mt-4 text-sm text-slate-300">
          <b className="text-slate-100 tabular-nums">{rp.toLocaleString()}</b> Resonance Points
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {p.ceil === null
            ? 'Highest aura reached ✦'
            : `${p.toNext.toLocaleString()} RP to Level ${p.level + 1}`}
        </p>
      </div>

      {glow !== null && (
        <div className="glass mb-4 flex items-center justify-between rounded-2xl p-4">
          <div>
            <p className="text-sm text-slate-200">Neighbourhood glow</p>
            <p className="text-[11px] text-slate-500">Healed Fractures light the map for everyone.</p>
          </div>
          <span className="font-display text-2xl text-aura-cyan tabular-nums">
            {Math.round(glow * 100)}%
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Fractures healed" value={profile.stats.questsCompleted} />
        <Stat label="Advice given" value={profile.stats.adviceGiven} />
        <Stat label="Active days" value={profile.stats.distinctActiveDays} />
        <Stat label="Echoes left" value={profile.stats.echoesCreated} />
      </div>
    </div>
  );
}

function Ring({ fraction, level }: { fraction: number; level: number }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const dash = c * fraction;
  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44" role="img" aria-label={`Aura level ${level}`}>
      <defs>
        <linearGradient id="aura-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38e1ff" />
          <stop offset="100%" stopColor="#9b7bff" />
        </linearGradient>
        <radialGradient id="aura-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38e1ff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#9b7bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r={r} fill="url(#aura-core)" />
      <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
      <circle
        cx="80"
        cy="80"
        r={r}
        fill="none"
        stroke="url(#aura-ring)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 80 80)"
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
      <text x="80" y="72" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11, letterSpacing: 2 }}>
        LEVEL
      </text>
      <text x="80" y="102" textAnchor="middle" className="fill-slate-100" style={{ fontSize: 40, fontWeight: 700 }}>
        {level}
      </text>
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-2xl font-semibold text-slate-100 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
