/**
 * Typed, centralised access to build-time environment. Never read import.meta.env
 * directly elsewhere — go through here so the flags have one definition.
 */

const flag = (value: string | undefined): boolean => value === 'true';

export const env = {
  /**
   * Sim mode: the entire location loop must run at a desk with no GPS, no
   * walking, and no second device. See CLAUDE.md "Sim mode is not optional".
   */
  simMode: flag(import.meta.env.VITE_SIM_MODE),

  /** Route Firebase SDKs to the local emulator suite. */
  useEmulator: flag(import.meta.env.VITE_USE_EMULATOR),

  mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN ?? '',

  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-key',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-aura-resonance.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-aura-resonance',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-aura-resonance.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '0',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
  },
} as const;
