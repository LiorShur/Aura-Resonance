import { useEffect, useState } from 'react';
import { env } from './lib/env';
import { BottomNav, type TabId } from './components/BottomNav';
import { SimBanner } from './sim/SimBanner';
import { AuthGate } from './features/auth/AuthGate';
import { MapScreen } from './features/map/MapScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { ModerationQueueScreen } from './features/moderation/ModerationQueueScreen';
import { PlaceholderScreen } from './components/PlaceholderScreen';
import { DebugBadge } from './components/DebugBadge';

/**
 * v0 app shell: sign-in / onboarding gate wraps a full-bleed screen area with a
 * fixed bottom navigation. Routing is a local tab switch for now — a router
 * arrives with deep-linkable Fractures in a later milestone.
 */
export function App() {
  const route = useHashRoute();
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-base-900">
      {env.simMode && <SimBanner />}
      <AuthGate>
        {/* Unlisted protected route (SAFETY §4). isAdmin() rule is the real gate. */}
        {route === 'moderation' ? <ModerationQueueScreen /> : <Shell />}
      </AuthGate>
      {import.meta.env.DEV && <DebugBadge />}
    </div>
  );
}

/** Minimal hash routing: only the unlisted `#moderation` review route for now. */
function useHashRoute(): 'moderation' | 'app' {
  const read = () => (window.location.hash.replace(/^#\/?/, '') === 'moderation' ? 'moderation' : 'app');
  const [route, setRoute] = useState<'moderation' | 'app'>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function Shell() {
  const [tab, setTab] = useState<TabId>('map');
  return (
    <>
      <main className="relative min-h-0 flex-1">
        {tab === 'map' && <MapScreen />}
        {tab === 'auras' && <PlaceholderScreen title="Auras" milestone="M9" />}
        {tab === 'resonate' && <PlaceholderScreen title="Resonate" milestone="M3" />}
        {tab === 'inventory' && <PlaceholderScreen title="Inventory" milestone="M9" />}
        {tab === 'profile' && <ProfileScreen />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}
