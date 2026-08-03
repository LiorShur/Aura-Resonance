import { useSyncExternalStore } from 'react';

// Connectivity signal for honest offline states. navigator.onLine is a hint (it
// only knows about the network interface, not real reachability), but it's the
// right primitive for "don't let the player tap I'm here into the void".

function subscribe(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true, // assume online during SSR/first paint
  );
}
