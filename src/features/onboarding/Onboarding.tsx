import { useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { Avatar } from '@/components/Avatar';
import { newAvatarSeed } from '@/lib/avatar';
import { useAuthStore } from '@/features/auth/authStore';
import { meetsMinimumAge, MIN_AGE } from './age';
import { guessRegion, REGIONS } from './regions';
import { UnderageBlocked } from './UnderageBlocked';

/**
 * First-run onboarding: the age gate (SAFETY §1), a country for crisis-resource
 * selection, a display name, and an avatar. Age is checked inline for UX but the
 * createProfile function is the authoritative gate. An under-16 result routes to
 * a plain, non-punitive blocked screen — never a "restricted mode".
 */
export function Onboarding() {
  const createProfile = useAuthStore((s) => s.createProfile);
  const initialSeed = useAuthStore((s) => s.user?.uid ?? 'seed');

  const [birthDate, setBirthDate] = useState('');
  const [region, setRegion] = useState(guessRegion());
  const [displayName, setDisplayName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(initialSeed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  if (blocked) return <UnderageBlocked />;

  const ageOk = birthDate === '' || meetsMinimumAge(birthDate);
  const nameOk = displayName.trim().length >= 2;
  const canSubmit = birthDate !== '' && ageOk && nameOk && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createProfile({ birthDate, homeRegion: region, displayName, avatarSeed });
    } catch (e) {
      const msg = errorMessage(e);
      if (msg.includes('under_minimum_age')) setBlocked(true);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <header className="py-4">
        <h1 className="font-display text-3xl text-slate-100">Welcome, Weaver</h1>
        <p className="mt-1 text-sm text-slate-400">A few details before you begin.</p>
      </header>

      <div className="flex flex-col items-center gap-3 py-4">
        <Avatar seed={avatarSeed} size={88} />
        <button
          type="button"
          onClick={() => setAvatarSeed(newAvatarSeed(avatarSeed))}
          className="text-xs text-aura-cyan hover:underline"
        >
          Shuffle avatar
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void submit();
        }}
        className="space-y-5"
      >
        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            placeholder="How others see you"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Date of birth</span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50 [color-scheme:dark]"
          />
          {!ageOk && (
            <span className="text-xs text-rose-300">
              You must be at least {MIN_AGE} to use Aura Resonance.
            </span>
          )}
          <span className="block text-xs text-slate-500">
            Used once to confirm your age, then discarded — we store only that you
            confirmed it.
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Where are you?</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50 [color-scheme:dark]"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code} className="bg-base-800">
                {r.name}
              </option>
            ))}
          </select>
          <span className="block text-xs text-slate-500">
            So we can point you to the right local support if you ever need it.
          </span>
        </label>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-40"
        >
          {busy ? 'Creating your Aura…' : 'Begin'}
        </button>
      </form>
    </div>
  );
}
