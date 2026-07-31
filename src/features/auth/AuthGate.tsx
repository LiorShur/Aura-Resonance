import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from './authStore';
import { SignInScreen } from './SignInScreen';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { SuspendedScreen } from './SuspendedScreen';

/**
 * Decides what the player sees based on auth + profile state. The joint game is
 * gated behind a completed, age-passed profile — nothing downstream renders
 * until `ready`.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  useEffect(() => init(), [init]);

  switch (status) {
    case 'loading':
      return <Splash />;
    case 'signed_out':
      return <SignInScreen />;
    case 'onboarding':
      return <Onboarding />;
    case 'suspended':
      return <SuspendedScreen />;
    case 'ready':
      return <>{children}</>;
  }
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="animate-pulse font-display text-4xl tracking-wide text-aura-cyan/70">
        Aura
      </span>
    </div>
  );
}
