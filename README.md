# Aura Resonance — v0 pilot

A digital-physical kindness game, delivered as an installable PWA. This repo is
the **v0 pilot**: one neighbourhood, ~25 players, built to answer a single
question — *does the core loop bring people back?*

Read `CLAUDE.md` and `docs/` before contributing. The hard constraints there are
decisions, not preferences.

## Quick start

```bash
npm install
cp .env.example .env.local        # defaults already target the emulator + sim
npm run dev                        # http://localhost:5173, sim mode on
```

Sim mode (`VITE_SIM_MODE=true`, the default) means the whole location loop runs
at a desk: drag the player pin on the map, teleport onto a Fracture, or summon a
fake co-op partner from the SIM banner at the top. No GPS, no walking, no second
device.

## Firebase emulator

```bash
npm i -g firebase-tools            # one-time
npm run emulators                  # Auth, Firestore, Storage, Functions, UI :4000
npm run seed                       # quest templates + example Fractures (once)
npm run seed:verify                # sanity-check seed locations
```

Development runs entirely against the emulator on the `demo-aura-resonance`
project — no real credentials required.

`npm run emulators` **persists data** to `./emulator-data` (gitignored): it
imports on start and exports on exit, so you seed once and keep your Fractures
across restarts. Quit with Ctrl+C to trigger the export — killing the terminal
skips it. Use `npm run emulators:clean` for a fresh, in-memory slate.

### Demonstrate the quest loop (M5, sim mode)

With `npm run emulators` and `npm run dev` both running, in the app:

1. **Map** → drag your player pin onto a kindness Fracture (sim mode makes the
   pin draggable — no walking).
2. Tap the Fracture → **I’m here** (server verifies you’re in range).
3. **Take / choose photo**, or **Use sim photo** (no camera needed at a desk).
4. The photo uploads to `uploads/{uid}/{attemptId}`; the `moderateMedia` Storage
   trigger screens it, blurs any faces, discards the original, and advances the
   attempt → the Fracture heals and RP lands on your profile.
5. **Simulate blocked photo** (emulator button) exercises the block path — no
   heal, plain-language notice, strike recorded.

The emulator has no Vision credentials, so it stubs the verdict (default pass;
the block button forces a block). Real SafeSearch + face blur run only once
functions are deployed with the Cloud Vision API enabled — that’s where the
"real photo with a face is blurred and passes" acceptance check is confirmed.

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Vite dev server (sim mode) |
| `npm run build` | Typecheck + production PWA build |
| `npm run test` | Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run emulators` | Firebase emulator suite (persists to `./emulator-data`) |
| `npm run emulators:clean` | Emulator suite with a fresh, in-memory slate |
| `npm run seed` | Seed templates + Fractures into the emulator |
| `npm run seed:verify` | Structural check of seed Fracture locations |

## Where things live

- `src/features/*` — feature-first modules (map, quest, breathe, empathy, …)
- `src/lib/*` — `geo`, `errors`, `firebase`, `geolocation` (the position seam)
- `src/sim/*` — the desk-development harness (mock GPS, fake players)
- `functions/*` — Cloud Functions (authoritative game logic)
- `scripts/*` — seed + verify tooling and example data
- `docs/*` — GDD, SAFETY, SCHEMA, TASKS (all authoritative)

## Build order

See `docs/TASKS.md`. This scaffold is **M0**. Each milestone is one branch and
must be independently demonstrable in sim mode before the next begins.
