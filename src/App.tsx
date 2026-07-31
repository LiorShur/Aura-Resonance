import { useState } from 'react';
import { env } from './lib/env';
import { BottomNav, type TabId } from './components/BottomNav';
import { SimBanner } from './sim/SimBanner';
import { AuthGate } from './features/auth/AuthGate';
import { MapScreen } from './features/map/MapScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { PlaceholderScreen } from './components/PlaceholderScreen';

/**
 * v0 app shell: sign-in / onboarding gate wraps a full-bleed screen area with a
 * fixed bottom navigation. Routing is a local tab switch for now — a router
 * arrives with deep-linkable Fractures in a later milestone.
 */
export function App() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-base-900">
      {env.simMode && <SimBanner />}
      <AuthGate>
        <Shell />
      </AuthGate>
    </div>
  );
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
