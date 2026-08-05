/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_MAPBOX_TOKEN: string;
  /** 'true' enables the desk-development sim harness (mock GPS, fake players). */
  readonly VITE_SIM_MODE: string;
  /** 'true' points Firebase SDKs at the local emulator suite. */
  readonly VITE_USE_EMULATOR: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
