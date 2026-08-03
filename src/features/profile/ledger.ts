import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { firebase } from '@/lib/firebase';

// The RP audit trail (users/{uid}/ledger): append-only, function-written, and
// readable only by its owner. Displaying it makes progression legible — "where
// did my points come from?".

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt?: Timestamp;
}

const REASON_LABEL: Record<string, string> = {
  quest_complete: 'Fracture healed',
  advice_rated: 'Advice rated',
};

export function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason.replace(/_/g, ' ');
}

export function watchLedger(
  uid: string,
  cb: (entries: LedgerEntry[]) => void,
  onError?: (message: string) => void,
): () => void {
  const q = query(
    collection(firebase().db, 'users', uid, 'ledger'),
    orderBy('createdAt', 'desc'),
    limit(12),
  );
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            delta: Number(data.delta ?? 0),
            reason: String(data.reason ?? ''),
            balanceAfter: Number(data.balanceAfter ?? 0),
            createdAt: data.createdAt as Timestamp | undefined,
          };
        }),
      ),
    (e) => onError?.(e.message),
  );
}
