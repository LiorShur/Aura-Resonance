import { create } from 'zustand';
import type { LatLng } from '@/lib/geo';
import { SIM_CENTRE } from './sampleNeighbourhood';

/**
 * The sim harness. In sim mode this store IS the GPS: the player position here
 * is what `getCurrentPosition` returns. A fake second player drives co-op flows
 * from a single device. None of this exists in a production build path — read
 * position only through lib/geolocation so features never touch this directly.
 */
interface SimState {
  /** The player's simulated position. */
  player: LatLng;
  /** Optional fake co-op partner, toggled on for co-op testing. */
  secondPlayer: LatLng | null;
  /** Simulated horizontal accuracy in metres, so range logic can be exercised. */
  accuracyM: number;

  setPlayer: (pos: LatLng) => void;
  teleportTo: (pos: LatLng) => void;
  setAccuracy: (m: number) => void;
  toggleSecondPlayer: () => void;
  setSecondPlayer: (pos: LatLng) => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  player: SIM_CENTRE,
  secondPlayer: null,
  accuracyM: 8,

  setPlayer: (pos) => set({ player: pos }),
  teleportTo: (pos) => set({ player: pos }),
  setAccuracy: (m) => set({ accuracyM: m }),
  toggleSecondPlayer: () =>
    set((s) => ({
      secondPlayer: s.secondPlayer
        ? null
        : { lat: s.player.lat + 0.0002, lng: s.player.lng + 0.0002 },
    })),
  setSecondPlayer: (pos) => {
    if (get().secondPlayer) set({ secondPlayer: pos });
  },
}));

/** Non-reactive snapshot, for the geolocation provider. */
export const simSnapshot = () => useSimStore.getState();
