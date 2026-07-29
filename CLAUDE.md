# CLAUDE.md — Aura Resonance

Context for Claude Code working in this repo. Read this before doing anything.

---

## What this is

A digital-physical kindness game, delivered as an installable PWA. Players walk to map locations ("Fractures"), perform prompted acts of kindness, and verify them. This repo is the **v0 pilot**: one neighbourhood, ~25 players, built to answer whether the core loop retains people.

Companion docs, all authoritative:
- `docs/GDD_v0.md` — scope and mechanics
- `docs/SAFETY.md` — **hard requirements, non-negotiable**
- `docs/SCHEMA.md` — Firestore collections, rules shape, function list
- `docs/TASKS.md` — build order and milestones

Solo project. One developer. There is no team, no QA function, no designer to hand things to.

---

## Hard constraints

These are decisions, not preferences. Do not reverse them, and do not "helpfully" add them back when a task seems to call for them. If a task appears to require one, **stop and ask** rather than implementing it.

- **No Bluetooth / Web Bluetooth / BLE.** Player proximity is done with GPS co-location plus a 4-digit session code. Safari on iOS has no Web Bluetooth support, and Web Bluetooth cannot do phone-to-phone peer discovery in any browser.
- **No HealthKit, Health Connect, heart rate, or PPG.** The Emotional Resonance mechanic uses a paced breathing timer. Puzzle stability is a function of completed breathing cycles, nothing else.
- **No background location.** Location is read only when the player explicitly taps *I'm here*. No watchers, no geofencing, no background tasks, no continuous tracking.
- **No AR, no persistent anchors, no WebXR.** Echoes are map-anchored.
- **No native wrapper, no Capacitor, no React Native, no app store.** PWA only.
- **No image Echoes.** Text only. Quest photos are the only image UGC.
- **No WebSockets or custom real-time server.** Firestore listeners.
- **No localStorage for game state.** Firestore is the source of truth; IndexedDB via the offline cache only.

---

## Stack

| Layer | Choice |
| :--- | :--- |
| Client | React 18 + TypeScript + Vite |
| PWA | `vite-plugin-pwa`, Workbox |
| Map | Mapbox GL JS |
| Geo queries | `geofire-common` (geohash ranges) |
| State | Zustand + Firestore listeners. No Redux. |
| Backend | Firebase: Auth, Firestore, Storage, Cloud Functions (Node 20, TS) |
| Notifications | FCM (v0: quest reminders only) |
| Moderation | Claude API (text/crisis), Google Cloud Vision (images) |
| Hosting | Firebase Hosting, GitHub Actions on merge to `main` |
| Tests | Vitest, Firebase emulator suite |

---

## Layout

```
/src
  /features        # map, quest, breathe, empathy, echoes, coop, profile
  /components      # shared UI
  /lib             # firebase.ts, geo.ts, analytics.ts
  /sim             # dev-only: mock GPS, seeding, fake players
/functions/src     # Cloud Functions, one file per function
/docs              # GDD_v0.md, SAFETY.md, SCHEMA.md, TASKS.md
/scripts           # seed-fractures.ts, seed-templates.ts, verify-locations.ts
/tests/fixtures    # moderation and crisis-screen fixture sets
```

Feature-first, not layer-first. Everything for the breathing puzzle lives in `/src/features/breathe`.

---

## Working rules

**Sim mode is not optional.** `VITE_SIM_MODE=true` must let the entire location loop run at a desk with no GPS, no walking, and no second player. Any location-touching feature ships with its sim path in the same commit. Without this, testing means going outside.

**The client never writes authoritative state.** Points, levels, healing status, moderation status, and quest state transitions past `started` are all Cloud Function territory. If a task tempts you toward a client-side write of any of these, that is the wrong implementation.

**Fail closed on safety.** Classifier error, timeout, or ambiguity on the crisis-screen path means treat as flagged and hold. Never fail open. `SAFETY.md` section 2 governs.

**Emulator tests before rules.** Assert that a client *cannot* write `resonancePoints`, *cannot* advance `questAttempts.state`, and *cannot* read an unscreened `empathySubmission`. These tests are the real specification.

**One milestone per branch.** `M4-moderation-service`. Each milestone in `TASKS.md` must be independently runnable and demonstrable before the next starts.

**Ask before scope.** If a task cannot be completed within the hard constraints, say so and stop. Do not route around them.

---

## Style

- TypeScript strict. No `any` — `unknown` and narrow.
- Named exports. No default exports except route-level components.
- Zod schemas at every trust boundary: function inputs, external API responses.
- Errors: throw typed errors from `lib/errors.ts`; no bare strings.
- No comments restating the code. Comment *why*, particularly around the geo maths and moderation fallbacks.
- Tailwind. Dark theme per the concept art — deep navy base, luminous cyan/violet accents, glassmorphic panels. Reference mockups in `/docs/assets`.

---

## Environment

```
VITE_FIREBASE_*          # client config
VITE_MAPBOX_TOKEN
VITE_SIM_MODE            # 'true' | 'false'
ANTHROPIC_API_KEY        # functions only, never client
GOOGLE_VISION_KEY        # functions only, never client
```

Server keys never reach the client bundle. Moderation always runs in a function.

---

## Definition of done

A milestone is done when: it runs in sim mode, it has emulator tests for its rules, its safety requirements from `SAFETY.md` are met, and it is demonstrable end-to-end without touching another milestone's unfinished work.
