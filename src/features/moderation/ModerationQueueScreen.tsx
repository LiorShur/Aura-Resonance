import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { firebase } from '@/lib/firebase';
import { useIsAdmin } from './useIsAdmin';

interface QueueItem {
  id: string;
  kind: string;
  targetPath: string;
  reason: string;
  state: string;
  createdAt?: Timestamp;
  category?: string;
  failedClosed?: boolean;
  refId?: string;
}

/**
 * Read-only moderation queue (SAFETY.md §4). A protected route reading
 * `moderationQueue` is deliberately all v0 ships — not an admin panel. Resolution
 * happens out-of-band; the security rule (`isAdmin()`) is the real gate, this
 * screen only decides whether to render for a non-admin.
 */
export function ModerationQueueScreen() {
  const admin = useIsAdmin();

  if (admin === 'checking') return <Centered>Checking access…</Centered>;
  if (admin === 'denied') return <Centered>Not authorised.</Centered>;
  return <Queue />;
}

function Queue() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(firebase().db, 'moderationQueue'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QueueItem, 'id'>) }))),
      (err) => setError(err.message),
    );
  }, []);

  if (error) return <Centered>Could not load queue: {error}</Centered>;
  if (!items) return <Centered>Loading queue…</Centered>;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <header className="py-4">
        <h1 className="font-display text-3xl text-slate-100">Moderation queue</h1>
        <p className="text-xs text-slate-500">
          {items.length} item{items.length === 1 ? '' : 's'} · read-only
        </p>
      </header>

      {items.length === 0 && <p className="text-sm text-slate-400">Nothing queued.</p>}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-100">{item.kind}</span>
              <span className="flex items-center gap-2">
                {item.failedClosed && (
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                    failed closed
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{item.state}</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{item.reason}</p>
            {item.category && <p className="text-xs text-slate-400">category: {item.category}</p>}
            <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{item.targetPath}</p>
            <p className="text-[11px] text-slate-600">{formatWhen(item.createdAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatWhen(ts?: Timestamp): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString();
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
