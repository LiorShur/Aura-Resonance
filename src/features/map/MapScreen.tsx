import { Suspense, lazy, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { env } from '@/lib/env';
import { firebase } from '@/lib/firebase';
import { distanceM, type LatLng } from '@/lib/geo';
import { getCurrentPosition } from '@/lib/geolocation';
import { useAuthStore } from '@/features/auth/authStore';
import { useSimStore } from '@/sim/simStore';
import { QuestSheet } from '@/features/quest/QuestSheet';
import { EchoPanel } from '@/features/echoes/EchoPanel';
import { SchematicMap } from './SchematicMap';
import { useFractures } from './useFractures';

const MapboxMap = lazy(() =>
  import('./MapboxMap').then((m) => ({ default: m.MapboxMap })),
);

/**
 * v0 Map screen. Fractures load from Firestore via geohash range queries and are
 * distance-filtered client-side. In sim mode the pin is draggable and reads from
 * the sim store; in live mode we take a one-shot position for the initial view
 * (no continuous tracking — that is a hard constraint). Uses Mapbox when a token
 * is configured, else the token-free schematic map.
 */
export function MapScreen() {
  const player = useSimStore((s) => s.player);
  const simCentre = useSimStore((s) => s.simCentre);
  const secondPlayer = useSimStore((s) => s.secondPlayer);
  const setPlayer = useSimStore((s) => s.setPlayer);
  const profile = useAuthStore((s) => s.profile);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [echoesOpen, setEchoesOpen] = useState(false);
  const [brightness, setBrightness] = useState<number | null>(null);
  const [coachDismissed, setCoachDismissed] = useState(false);
  // Explore mode: when the player pans the map well away from their pin, fetch
  // Fractures around where they're looking instead of only around themselves.
  // Cleared (back to following the player) once they pan near the pin again or
  // tap "Recenter". `recentreSignal` is bumped to command the map to ease back.
  const [exploreCentre, setExploreCentre] = useState<LatLng | null>(null);
  const [recentreSignal, setRecentreSignal] = useState(0);
  // First-run guidance: shown until the player heals their first Fracture.
  const showCoach = !coachDismissed && (profile?.stats.questsCompleted ?? 0) === 0;

  // Neighbourhood brightness — the recomputeMapBrightness aggregate (GDD §4).
  useEffect(
    () =>
      onSnapshot(doc(firebase().db, 'config', 'mapBrightness'), (d) =>
        setBrightness(typeof d.data()?.overall === 'number' ? (d.data()!.overall as number) : null),
      ),
    [],
  );

  // Fetch/display around the explore centre when set, else follow the player.
  const viewCentre = exploreCentre ?? player;
  const { visible, loading, usingSample, reload } = useFractures(viewCentre);

  // A pan more than ~400 m from the player enters explore mode; panning back near
  // the pin exits it. The threshold keeps small GPS jitter from latching explore.
  const EXPLORE_THRESHOLD_M = 400;
  const onCentreChange = (c: LatLng) => {
    setExploreCentre(distanceM(c, player) > EXPLORE_THRESHOLD_M ? c : null);
  };
  const recenter = () => {
    setExploreCentre(null);
    setRecentreSignal((n) => n + 1);
  };

  // Live mode: seed the initial position once (foreground, on demand only).
  useEffect(() => {
    if (env.simMode) return;
    getCurrentPosition()
      .then((p) => setPlayer(p.coords))
      .catch(() => undefined);
  }, [setPlayer]);

  const fractures = visible.map((v) => v.fracture);
  const selected = visible.find((v) => v.fracture.id === selectedId) ?? null;
  const hasToken = env.mapboxToken.length > 0;

  return (
    <div className="relative h-full w-full">
      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="glass pointer-events-auto rounded-2xl px-3 py-1.5 text-sm">
          <span className="font-display text-lg tracking-wide text-aura-cyan">Aura</span>
          <span className="ml-2 text-slate-400">Lv {profile?.auraLevel ?? 1}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="glass pointer-events-auto rounded-2xl px-3 py-1.5 text-sm">
            <span className="text-slate-400">RP</span>{' '}
            <span className="font-semibold text-slate-100">{profile?.resonancePoints ?? 0}</span>
          </div>
          {brightness !== null && (
            <div className="glass pointer-events-auto rounded-2xl px-3 py-1 text-xs text-aura-cyan">
              ✧ {Math.round(brightness * 100)}%
            </div>
          )}
        </div>
      </div>

      {usingSample && env.simMode && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center">
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-200">
            sample Fractures — seed the database to use live data
          </span>
        </div>
      )}

      {/* Map */}
      {hasToken ? (
        <Suspense fallback={<MapLoading />}>
          <MapboxMap
            centre={simCentre}
            fractures={fractures}
            player={player}
            secondPlayer={secondPlayer}
            selectedId={selectedId}
            draggable={env.simMode}
            onSelect={setSelectedId}
            onPlayerMove={setPlayer}
            onCentreChange={onCentreChange}
            recentreSignal={recentreSignal}
          />
        </Suspense>
      ) : (
        <div className="grid h-full w-full place-items-center bg-base-900">
          <div className="aspect-square h-full max-h-full w-full max-w-[min(100%,100vh)]">
            <SchematicMap
              centre={simCentre}
              fractures={fractures}
              player={player}
              secondPlayer={secondPlayer}
              selectedId={selectedId}
              draggable={env.simMode}
              onSelect={setSelectedId}
              onPlayerMove={setPlayer}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 text-xs text-slate-500">
          finding Fractures…
        </div>
      )}

      {/* First-run coaching (SAFETY §5: surroundings notice on first launch) */}
      {showCoach && !selected && !echoesOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="glass pointer-events-auto max-w-sm rounded-2xl p-4 text-center">
            <p className="font-display text-lg text-aura-cyan">Welcome, Weaver</p>
            <p className="mt-1 text-sm text-slate-300">
              Tap a glowing Fracture on the map to begin. Walk there, tap <b>I’m here</b>, and
              do one small kindness to heal it.
            </p>
            <p className="mt-2 text-xs text-amber-300/90">
              ⚠ You’ll be out in the real world — stay aware of your surroundings.
            </p>
            <button
              type="button"
              onClick={() => setCoachDismissed(true)}
              className="mt-3 rounded-xl border border-aura-cyan/40 bg-aura-cyan/10 px-4 py-2 text-sm font-medium text-aura-cyan hover:bg-aura-cyan/20"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Explore mode: snap the view back to the player. */}
      {exploreCentre && !selected && !echoesOpen && (
        <button
          type="button"
          onClick={recenter}
          className="glass absolute bottom-24 left-3 z-10 rounded-full px-4 py-2.5 text-sm font-medium text-aura-cyan hover:bg-white/10"
        >
          ◎ Recenter on me
        </button>
      )}

      {/* Echoes: leave / discover within 50m */}
      {!selected && !echoesOpen && (
        <button
          type="button"
          onClick={() => setEchoesOpen(true)}
          className="glass absolute bottom-24 right-3 z-10 rounded-full px-4 py-2.5 text-sm font-medium text-aura-cyan hover:bg-white/10"
        >
          ✧ Echoes
        </button>
      )}
      {echoesOpen && <EchoPanel player={player} onClose={() => setEchoesOpen(false)} />}

      {/* Selected Fracture → quest flow */}
      {selected && (
        <QuestSheet
          key={selected.fracture.id}
          fracture={selected.fracture}
          // Always player-relative: in explore mode the ranked distanceM is
          // measured from the panned view centre, but check-in gates on the
          // player's own distance to the Fracture.
          distanceM={distanceM(player, selected.fracture.geo)}
          player={player}
          isSample={usingSample}
          onClose={() => setSelectedId(null)}
          onHealed={reload}
        />
      )}
    </div>
  );
}

function MapLoading() {
  return (
    <div className="grid h-full w-full place-items-center bg-base-900 text-sm text-slate-500">
      loading map…
    </div>
  );
}
