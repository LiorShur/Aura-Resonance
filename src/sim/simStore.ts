import { create } from 'zustand';
import type { LatLng } from '@/lib/geo';
import type { Fracture } from '@/features/map/types';
import { readDeviceGps } from '@/lib/geolocation';
import { SIM_CENTRE, SAMPLE_FRACTURES, makeSampleFractures } from './sampleNeighbourhood';

/**
 * The sim harness. In sim mode this store IS the GPS: `player` is what
 * `getCurrentPosition` returns. `simCentre` is where the map opens and where the
 * bundled sample Fractures cluster; "use my location" recentres both on a
 * one-shot real GPS read (no continuous tracking — hard constraint). A fake
 * second player drives co-op flows from a single device. None of this exists in
 * a production build path.
 */
interface SimState {
  player: LatLng;
  simCentre: LatLng;
  /** Sample Fractures around simCentre, shown when the database is empty. */
  sampleFractures: Fracture[];
  secondPlayer: LatLng | null;
  accuracyM: number;
  locating: boolean;

  setPlayer: (pos: LatLng) => void;
  teleportTo: (pos: LatLng) => void;
  setAccuracy: (m: number) => void;
  toggleSecondPlayer: () => void;
  setSecondPlayer: (pos: LatLng) => void;
  /** One-shot: read real GPS, recentre the sim there, cluster samples around it. */
  useMyLocation: () => Promise<void>;
}

export const useSimStore = create<SimState>((set, get) => ({
  player: SIM_CENTRE,
  simCentre: SIM_CENTRE,
  sampleFractures: SAMPLE_FRACTURES,
  secondPlayer: null,
  accuracyM: 8,
  locating: false,

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
  useMyLocation: async () => {
    set({ locating: true });
    try {
      const { coords } = await readDeviceGps();
      set({
        player: coords,
        simCentre: coords,
        sampleFractures: makeSampleFractures(coords),
      });
    } finally {
      set({ locating: false });
    }
  },
}));

/** Non-reactive snapshot, for the geolocation provider. */
export const simSnapshot = () => useSimStore.getState();
