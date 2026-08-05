# Pilot readiness — SAFETY §7 sign-off

**Do not invite a single external player until every line is ✅.** This tracks the
`SAFETY.md` §7 checklist plus the M10 readiness items. Status legend:

- ✅ **done** — implemented and verified
- 🔧 **code done, needs your verification** — built; requires a human check on real data/devices
- ⬜ **not started / your action**

Updated: end of M10 build.

---

## SAFETY §7 — pre-launch checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Age gate blocks under-16 at signup | ✅ | `createProfile` rejects <16 server-side; rules block client-created user docs |
| 2 | Crisis screen tested against 30+ realistic hard submissions | ✅ | 33 crisis fixtures, 76/76 live fixture run passed |
| 3 | Crisis screen fails closed on classifier error (forced timeout) | ✅ | Proven by unit tests (throw/timeout → `pending`, never `passed`) |
| 4 | **Crisis resource numbers verified by calling them** | ⬜ | **Your action.** Call each number in `scripts/data/crisis-resources.json`, then set `verified: true` and re-seed |
| 5 | Moderation blocks a known-bad text + image fixture set | ✅ | Text fixtures pass; image block path tested (SafeSearch mapping unit-tested) |
| 6 | **Face blurring verified on real photos with faces** | 🔧 | Code done + you confirmed one live blur. Verify across a few real faces before launch |
| 7 | Report → auto-hide at 2 reports verified | 🔧 | `onReport` increments + hides at 2; verify end-to-end with two accounts |
| 8 | Moderation queue reachable and working | ✅ | Admin `#moderation` route, `isAdmin()` gated |
| 9 | Night suppression against **local** time, not UTC | ✅ | `isActiveNow` uses device local hours (sim can override for desk testing) |
| 10 | **Every seed Fracture visually checked against satellite imagery** | ⬜ | **Your action.** Open each coord in `fractures.geojson` on satellite; none on roads/rail/private property/water |
| 11 | Account deletion verified to actually delete | 🔧 | `deleteAccount` built (Profile → Danger zone). Verify it removes everything on live |
| 12 | Privacy policy live and linked | ✅ | `#privacy` route, linked from sign-in + profile; `docs/PRIVACY.md` |

---

## M10 readiness items

| Item | Status | Notes |
|------|--------|-------|
| Self-service account deletion | ✅ | See #11 above |
| Privacy policy live and linked | ✅ | See #12 above |
| Onboarding + guided first quest + safety notice | ✅ | Age gate + region onboarding; first-run coach mark on the map until the first heal |
| FCM quest reminders (1/day max) | 🔧 | Built (opt-in toggle + daily sender). **Your action:** set `VITE_FCM_VAPID_KEY`, fill the two TODOs in `public/firebase-messaging-sw.js`, deploy, and test on a real device |
| Offline handling: cached shell, honest failures | ✅ | Firestore persistent cache; check-in disables honestly offline and recovers on reconnect (a GPS-verified check-in can't be truly queued) |
| "Stay aware of surroundings" notice on first launch + each quest start | ✅ | Coach mark on first launch; a notice on every quest's check-in step |
| Real-device test: iOS Safari + Android Chrome, installed to home screen | ⬜ | **Your action** once deployed to the live URL |

---

## Launch runbook (live deploy)

Run once, in order, from the repo root (targets `aura-resonance-dev`):

```bash
firebase use dev

# 1. Secrets + APIs (one-time)
firebase functions:secrets:set ANTHROPIC_API_KEY      # paste your key
# Enable Cloud Vision API + Email/Password auth in the Firebase/GCP console

# 2. Rules + indexes (indexes must exist before the queries run)
npm run deploy:rules

# 3. Functions
npm run deploy:functions

# 4. Seed config, templates, Fractures (curated locations)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed:live

# 5. Build + host the PWA
npm run deploy:hosting        # → https://aura-resonance-dev.web.app

# 6. Grant yourself admin (for #moderation and #metrics)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  npx tsx scripts/grant-admin.ts you@example.com
```

Or everything at once: `npm run deploy` (build + functions + rules + hosting).

**Installing on a phone:** open the live URL in Android Chrome or iOS Safari →
browser menu → **Add to Home Screen**. It installs as a full-screen app with
camera, GPS, and offline support.
