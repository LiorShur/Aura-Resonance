# Aura Resonance — Build Order

Sequential. Each milestone is independently demonstrable. Do not start the next until the previous meets its acceptance criteria.

Week estimates assume solo work with Claude Code. Treat them as ordering signals, not commitments.

---

## M0 — Scaffold + sim harness *(~3 days)*

Build the ability to develop without going outside. Everything downstream depends on it.

- [ ] Vite + React + TS + Tailwind, `vite-plugin-pwa` configured, installs on iOS and Android
- [ ] Firebase project; emulator suite running locally (Auth, Firestore, Storage, Functions)
- [ ] `lib/firebase.ts`, `lib/geo.ts` (geohash helpers, haversine), `lib/errors.ts`
- [ ] **`/src/sim`**: mock GPS provider with a draggable pin, a "teleport to Fracture" control, and a fake second player for co-op
- [ ] `scripts/seed-fractures.ts` — plant 40–60 Fractures across the test neighbourhood from a curated GeoJSON
- [ ] `scripts/seed-templates.ts` — 20+ quest templates
- [ ] `scripts/verify-locations.ts` — flag any seed point on a road, private land, or water
- [ ] GitHub Actions: build, test, deploy to Firebase Hosting on merge to `main`

**Done when:** `VITE_SIM_MODE=true` gives a running app with a seeded map and a position you can move by dragging, and CI deploys.

---

## M1 — Auth, profile, age gate *(~3 days)*

- [ ] Firebase Auth (email link + Google)
- [ ] Signup flow with age gate per `SAFETY.md` §1 — under-16 blocked, `ageConfirmed` recorded
- [ ] `users/{uid}` document creation on first sign-in, with `homeRegion` from locale
- [ ] Profile screen: display name (moderated on set), avatar seed, Aura Level, RP
- [ ] Security rules + emulator tests: **client cannot write `resonancePoints`, `auraLevel`, or `strikes`**

**Done when:** the rules test suite fails if you remove the rules.

---

## M2 — Map + geo queries *(~4 days)*

- [ ] Mapbox map, dark style matched to the concept art
- [ ] Geohash range query for Fractures within 2km, plus client-side distance filter
- [ ] Fracture markers by type; player position marker; the aesthetic from the reference mockup
- [ ] Bottom navigation: Map / Auras / Resonate / Inventory / Profile
- [ ] Night suppression: Fractures hidden outside `activeHours`, evaluated in **local** time
- [ ] Distance and bearing readout to selected Fracture

**Done when:** in sim mode you can move the pin and watch Fractures enter and leave range correctly, including across a geohash cell boundary.

---

## M3 — Quest engine (check-in) *(~4 days)*

- [ ] Fracture detail sheet: template prompt, reward, verification type
- [ ] `questAttempts` created client-side as `started`
- [ ] `submitCheckIn` function: read position, verify within `radiusM`, compute `checkInDistanceM`, advance to `checked_in`
- [ ] Rejection UX for out-of-range check-in that shows distance remaining rather than just failing
- [ ] `submitVerification` function skeleton — heals Fracture, writes ledger entry, applies daily RP cap
- [ ] Emulator tests: **client cannot advance `questAttempts.state` past `started`**

**Done when:** a full quest completes end-to-end in sim mode with points landing in the ledger, and the client cannot fake it.

---

## M4 — Moderation service *(~4 days)*

Shared infrastructure. Built standalone against fixtures before any feature depends on it.

- [ ] `tests/fixtures/text/` — 40+ items spanning clean, harassment, hate, PII, spam, solicitation
- [ ] `tests/fixtures/crisis/` — 30+ realistic hard submissions per `SAFETY.md` §2
- [ ] `moderateText` function: Claude classification, Zod-validated structured output, keyword pre-filter
- [ ] `screenDilemma` function: crisis classifier, **fails closed** on error or timeout
- [ ] `moderateMedia` function: Vision SafeSearch + face blur, processed image only, original discarded
- [ ] `config/crisisResources` seeded for Israel and South Africa, plus international fallback — **numbers verified by calling them**
- [ ] `moderationQueue` collection + a protected admin route to work it
- [ ] Strike accumulation and suspension logic

**Done when:** the full fixture suite passes, and a forced classifier timeout results in `pending`, not `passed`.

---

## M5 — Kindness quests with photo verification *(~3 days)*

- [ ] Camera capture, client-side downscale, upload to Storage
- [ ] Storage trigger runs `moderateMedia`; attempt advances on pass
- [ ] Pending state UX — moderation is not instant, and the player should not be left staring at a spinner
- [ ] Blocked-photo UX: plain language, no policy jargon, strike recorded
- [ ] Fracture heals, map brightens locally, RP awarded

**Done when:** a real photo containing a face uploads, is blurred, passes, and heals a Fracture.

---

## M6 — Breathe to stabilize *(~3 days)*

- [ ] Fragmented geometric puzzle matching the reference mockup — shattered mandala, unstable pieces
- [ ] 4-7-8 breathing pacer with visual and haptic cues
- [ ] Stability derived from **completed cycles only**. No sensor input of any kind.
- [ ] Pieces snap into place as stability rises; puzzle solvable at threshold
- [ ] `breathingCyclesCompleted` recorded on the attempt; verification via `submitVerification`
- [ ] A skip path — some players will not want a breathing exercise, and forcing it will cost you retention data

**Done when:** the puzzle is genuinely unsolvable before threshold and satisfying after.

---

## M7 — Empathy Engine *(~5 days)*

Depends on M4. **Do not start the advice pool before the crisis screen is verified.**

- [ ] Submission form, 100–800 chars, category tags
- [ ] Submissions enter `pending`; `screenDilemma` runs before any visibility
- [ ] Crisis-routed path: warm acknowledgement plus region-appropriate resources. Never "rejected".
- [ ] Advice pool: browse open submissions, write advice, capped at 5 per submission
- [ ] Advice moderated on create
- [ ] Author reads advice, rates 1–5; `rateAdvice` awards adviser points
- [ ] Report control on every submission and every piece of advice
- [ ] Rules test: **an unscreened submission is unreadable by another player**

**Done when:** every fixture in `tests/fixtures/crisis/` routes to resources and none reaches the pool.

---

## M8 — Echoes + co-op sessions *(~4 days)*

- [ ] Create Echo: 140 chars, geo-anchored, moderated on write, 3/day rate limit
- [ ] Discover Echoes within 50m on the map; 30-day TTL
- [ ] Co-op: host opens a Fracture, receives a 4-digit code, 10-minute expiry
- [ ] `joinCoopSession`: validate code, verify both within 30m of each other and in Fracture radius
- [ ] Shared puzzle state via Firestore listeners; both complete together
- [ ] Sim mode drives the second player

**Done when:** two browser windows in sim mode complete a co-op quest together.

---

## M9 — Progression + analytics *(~3 days)*

- [ ] RP → Aura Level thresholds from `config/progression`; daily cap enforced
- [ ] Ledger view in profile — every point traceable
- [ ] `recomputeMapBrightness` scheduled function; neighbourhood aggregate rendered on the map
- [ ] `respawnFractures` scheduled hourly
- [ ] `truncateOldLocations` scheduled daily
- [ ] `analytics_events` writes for the full quest funnel
- [ ] `users.stats.distinctActiveDays` maintained — **this is the primary metric**
- [ ] A metrics view you can actually read: funnel, D1/D7, second-day completion

**Done when:** every metric in `GDD_v0.md` §6 is derivable without opening the Firestore console.

---

## M10 — Pilot readiness *(~4 days)*

- [ ] Onboarding: 3 screens, first quest guided, safety notice
- [ ] FCM quest reminders — one per day maximum
- [ ] Account deletion, self-service, verified to actually delete
- [ ] Privacy policy live and linked
- [ ] Offline handling: cached map tiles, queued check-ins, honest failure states
- [ ] Every seed Fracture visually checked against satellite imagery
- [ ] **Full `SAFETY.md` §7 pre-launch checklist signed off**
- [ ] Real-device testing: iOS Safari installed to home screen, Android Chrome

**Done when:** you would let a stranger's teenager use it.

---

## Then stop and look

Run the pilot for three weeks with ~25 players before writing another feature. The whole point of this build order is to reach a decision, not a product.

**The decision:** if second-day quest completion clears ~20%, invest further. If it does not, the problem is the loop, and no deferred feature on the v1 list will fix it.
