import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';
import { Avatar } from '@/components/Avatar';
import { newAvatarSeed } from '@/lib/avatar';
import { useAuthStore } from '@/features/auth/authStore';
import { REGIONS } from '@/features/onboarding/regions';
import { disableReminders, enableReminders } from '@/lib/notifications';
import { reasonLabel, watchLedger, type LedgerEntry } from './ledger';

/**
 * Profile: the player edits only vanity fields (display name, avatar). Aura Level
 * and Resonance Points are function-written and shown read-only — the client
 * cannot change them, and the security rules enforce that.
 */
export function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const updateVanity = useAuthStore((s) => s.updateVanity);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

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

      <RecentActivity uid={profile.uid} />

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10"
      >
        Sign out
      </button>

      <RemindersToggle optedIn={Boolean(profile.notifOptIn)} />

      <a
        href="#/privacy"
        className="mt-4 block text-center text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
      >
        Privacy policy
      </a>

      <DangerZone onDelete={deleteAccount} />
    </div>
  );
}

function RemindersToggle({ optedIn }: { optedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (optedIn) {
        await disableReminders();
        setNote('Reminders off.');
      } else {
        const r = await enableReminders();
        setNote(
          r === 'enabled'
            ? 'Reminders on — at most one a day.'
            : r === 'denied'
              ? 'Notifications are blocked in your browser settings.'
              : 'Reminders aren’t available on this device yet.',
        );
      }
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-sm text-slate-200">Quest reminders</p>
        <p className="text-[11px] text-slate-500">{note ?? 'A gentle nudge, at most once a day.'}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
          optedIn
            ? 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            : 'border border-aura-cyan/40 bg-aura-cyan/10 text-aura-cyan hover:bg-aura-cyan/20'
        }`}
      >
        {busy ? '…' : optedIn ? 'Turn off' : 'Turn on'}
      </button>
    </div>
  );
}

function DangerZone({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-rose-300/80">Danger zone</p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 text-sm text-rose-300 underline-offset-2 hover:underline"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-slate-300">
            This permanently deletes your account and all your data — quests, advice, Echoes,
            points, and check-in locations. It can’t be undone.
          </p>
          {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                onDelete().catch((e) => {
                  setError(errorMessage(e));
                  setBusy(false);
                });
              }}
              className="flex-1 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete everything'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentActivity({ uid }: { uid: string }) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);

  useEffect(() => watchLedger(uid, setEntries), [uid]);

  if (!entries || entries.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Recent activity
      </h2>
      <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/5">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-slate-300">{reasonLabel(e.reason)}</span>
            <span className="flex items-baseline gap-2">
              <span
                className={`text-sm font-semibold ${e.delta > 0 ? 'text-aura-green' : 'text-slate-400'}`}
              >
                {e.delta > 0 ? `+${e.delta}` : e.delta} RP
              </span>
              <span className="text-[11px] tabular-nums text-slate-600">
                {e.createdAt ? e.createdAt.toDate().toLocaleDateString() : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
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
