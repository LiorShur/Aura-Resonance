import { useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { Avatar } from '@/components/Avatar';
import { newAvatarSeed } from '@/lib/avatar';
import { useAuthStore } from '@/features/auth/authStore';
import { REGIONS } from '@/features/onboarding/regions';

/**
 * Profile: the player edits only vanity fields (display name, avatar). Aura Level
 * and Resonance Points are function-written and shown read-only — the client
 * cannot change them, and the security rules enforce that.
 */
export function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const updateVanity = useAuthStore((s) => s.updateVanity);
  const signOut = useAuthStore((s) => s.signOut);

  const [name, setName] = useState(profile?.displayName ?? '');
  const [seed, setSeed] = useState(profile?.avatarSeed ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!profile) return null;

  const dirty = name.trim() !== profile.displayName || seed !== profile.avatarSeed;
  const nameOk = name.trim().length >= 2;
  const regionName = REGIONS.find((r) => r.code === profile.homeRegion)?.name ?? profile.homeRegion;

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateVanity({ displayName: name.trim(), avatarSeed: seed });
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <header className="py-4">
        <h1 className="font-display text-3xl text-slate-100">Profile</h1>
      </header>

      <div className="flex flex-col items-center gap-3 py-2">
        <Avatar seed={seed} size={96} />
        <button
          type="button"
          onClick={() => {
            setSeed(newAvatarSeed(seed || profile.uid));
            setSaved(false);
          }}
          className="text-xs text-aura-cyan hover:underline"
        >
          Shuffle avatar
        </button>
      </div>

      {/* Read-only, function-owned stats */}
      <div className="my-4 grid grid-cols-2 gap-3">
        <Stat label="Aura Level" value={profile.auraLevel} />
        <Stat label="Resonance Points" value={profile.resonancePoints} />
        <Stat label="Quests healed" value={profile.stats.questsCompleted} />
        <Stat label="Advice given" value={profile.stats.adviceGiven} />
        <Stat label="Active days" value={profile.stats.distinctActiveDays} />
      </div>

      <label className="block space-y-1 py-2">
        <span className="text-sm text-slate-300">Display name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={40}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-aura-cyan/50"
        />
      </label>

      <p className="py-1 text-xs text-slate-500">Region: {regionName}</p>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {saved && !dirty && <p className="text-sm text-aura-green">Saved.</p>}

      <button
        type="button"
        disabled={!dirty || !nameOk || busy}
        onClick={() => void save()}
        className="mt-3 w-full rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-3 text-sm font-medium text-aura-cyan transition hover:bg-aura-cyan/20 disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Save changes'}
      </button>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10"
      >
        Sign out
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-2xl font-semibold text-slate-100">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
