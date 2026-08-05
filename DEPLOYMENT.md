# Going online with Firebase

The v0 pilot develops against the local emulator, but you can point it at a live
Firebase project any time. This is the checklist. **Client config values are not
secret** (they ship in the browser bundle); the only true secrets are the
Functions server keys and the CI service-account JSON — those never go in the
client or in git.

---

## 1. Create the project (console, ~10 min)

1. **New project** at <https://console.firebase.google.com> — e.g. `aura-resonance-dev`.
2. **Upgrade to Blaze** (Usage and billing → Modify plan). Cloud Functions require
   it. Set a **budget alert** (~$5) — a 25-player pilot stays inside the free
   quotas, the alert just catches surprises.
3. **Authentication** → Get started → enable **Google** and **Email/Password →
   Email link (passwordless sign-in)**.
   - Add your dev origin(s) to **Authorized domains**: `localhost` is there by
     default; add your Hosting domain once you have it.
4. **Firestore Database** → Create → **Production mode**. Choose a region close to
   your players (e.g. `europe-west1`). This region is permanent.
5. **Storage** → Get started → **same region** as Firestore.
6. **Project settings → General → Your apps → Web (`</>`)** → register an app.
   Copy the `firebaseConfig` object.

## 2. Wire the client

Put the config from step 6 into `.env.local` (already git-ignored) and switch off
the emulator:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=aura-resonance-dev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=aura-resonance-dev
VITE_FIREBASE_STORAGE_BUCKET=aura-resonance-dev.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_MAPBOX_TOKEN=            # needed from M2
VITE_SIM_MODE=true           # keep sim controls; still no real GPS at your desk
VITE_USE_EMULATOR=false      # <-- talk to live Firebase
```

## 3. Link the CLI and deploy the backend

```bash
firebase login
firebase use --add            # pick aura-resonance-dev, alias it e.g. "dev"

npm run deploy:rules          # Firestore rules + indexes + Storage rules
npm run deploy:functions      # Cloud Functions (needs Blaze)
npm run deploy:hosting        # build the PWA + deploy to Hosting
# or everything at once:
npm run deploy
```

`firebase use` sets the active project for deploys. The emulator scripts still
pin `demo-aura-resonance`, so local emulator work is unaffected.

After this, `npm run dev` (with `.env.local` as above) runs the app at your desk
against **live** Auth/Firestore/Storage/Functions — no emulator, testable from
your phone.

## 4. CI auto-deploy (optional, when you want push-to-deploy)

The CI `deploy` job is gated so it stays dormant until you opt in:

1. **Service account:** Firebase console → Project settings → **Service accounts**
   → Generate new private key (downloads a JSON).
2. In the GitHub repo → **Settings → Secrets and variables → Actions**:
   - **Secret** `FIREBASE_SERVICE_ACCOUNT` = the full JSON contents.
   - **Variable** `FIREBASE_PROJECT_ID` = `aura-resonance-dev`.
   - **Variable** `DEPLOY_ENABLED` = `true`.
3. Merges to `main` now build, run the rules suite, and deploy Hosting.

## 5. Seeding live data (deliberate, not automatic)

The `seed` scripts **refuse to touch anything but the emulator** — they force
`FIRESTORE_EMULATOR_HOST` so a stray run can never write to your live database.
To seed a live project you run it explicitly with admin credentials:

```bash
# from a trusted machine, against the DEV project only
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export SEED_TARGET_PROJECT=aura-resonance-dev   # explicit opt-in
# (a guarded seed:prod path is added when we first need live seed data)
```

Until then, seed the emulator and use the Emulator UI's export/import if you want
a starting dataset.

## 6. Server secrets (from M4)

Moderation keys are **Functions-only** and never reach the client:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set GOOGLE_VISION_KEY
```

## 7. Before real players (M10)

Create a **separate `aura-resonance-prod` project** and repeat steps 1–4 for it,
so pilot participants' data and UGC never mix with your test data. Dev stays your
sandbox; prod is locked down and only deployed from `main`.
