import { useEffect, useState } from 'react';
import { getIdTokenResult } from 'firebase/auth';
import { useAuthStore } from '@/features/auth/authStore';

type AdminState = 'checking' | 'admin' | 'denied';

/**
 * Resolve the `admin` custom claim on the current user. This mirrors the security
 * rule (`request.auth.token.admin == true`) that actually gates `moderationQueue`
 * reads — the client check is only for what to render; the rule is the real gate.
 * The claim is set out-of-band (Admin SDK / gcloud), never from the app.
 */
export function useIsAdmin(): AdminState {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<AdminState>('checking');

  useEffect(() => {
    let live = true;
    if (!user) {
      setState('denied');
      return;
    }
    setState('checking');
    // force-refresh so a freshly-granted claim is picked up without re-login
    getIdTokenResult(user, true)
      .then((res) => live && setState(res.claims.admin === true ? 'admin' : 'denied'))
      .catch(() => live && setState('denied'));
    return () => {
      live = false;
    };
  }, [user]);

  return state;
}
