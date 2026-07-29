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
npm run seed                       # quest templates + example Fractures
npm run seed:verify                # sanity-check seed locations
```

Development runs entirely against the emulator on the `demo-aura-resonance`
project — no real credentials required.

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Vite dev server (sim mode) |
| `npm run build` | Typecheck + production PWA build |
| `npm run test` | Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run emulators` | Firebase emulator suite |
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
