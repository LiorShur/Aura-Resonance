import { useEffect, useState } from 'react';
import { env } from './lib/env';
import { BottomNav, type TabId } from './components/BottomNav';
import { SimBanner } from './sim/SimBanner';
import { AuthGate } from './features/auth/AuthGate';
import { MapScreen } from './features/map/MapScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { EmpathyScreen } from './features/empathy/EmpathyScreen';
import { ModerationQueueScreen } from './features/moderation/ModerationQueueScreen';
import { MetricsScreen } from './features/metrics/MetricsScreen';
import { PrivacyScreen } from './features/legal/PrivacyScreen';
import { PlaceholderScreen } from './components/PlaceholderScreen';
import { logEvent } from './lib/analytics';

/**
 * v0 app shell: sign-in / onboarding gate wraps a full-bleed screen area with a
 * fixed bottom navigation. Routing is a local tab switch for now — a router
 * arrives with deep-linkable Fractures in a later milestone.
 */
export function App() {
  const route = useHashRoute();

  // The privacy policy is public — reachable before sign-in, outside the gate.
  if (route === 'privacy') {
    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-base-900">
        <PrivacyScreen />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-base-900">
      {env.simMode && <SimBanner />}
      <AuthGate>
        {/* Unlisted protected routes; the isAdmin() rules are the real gate. */}
        {route === 'moderation' ? (
          <ModerationQueueScreen />
        ) : route === 'metrics' ? (
          <MetricsScreen />
        ) : (
          <Shell />
        )}
      </AuthGate>
    </div>
  );
}

type Route = 'moderation' | 'metrics' | 'privacy' | 'app';

/** Minimal hash routing: public privacy page + unlisted admin routes. */
function useHashRoute(): Route {
  const read = (): Route => {
    const h = window.location.hash.replace(/^#\/?/, '');
    return h === 'moderation' || h === 'metrics' || h === 'privacy' ? h : 'app';
  };
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function Shell() {
  const [tab, setTab] = useState<TabId>('map');
  useEffect(() => {
    logEvent('app_open');
  }, []);
  return (
    <>
      <main className="relative min-h-0 flex-1">
        {tab === 'map' && <MapScreen />}
        {tab === 'auras' && <PlaceholderScreen title="Auras" milestone="M9" />}
        {tab === 'resonate' && <EmpathyScreen />}
        {tab === 'inventory' && <PlaceholderScreen title="Inventory" milestone="M9" />}
        {tab === 'profile' && <ProfileScreen />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}
