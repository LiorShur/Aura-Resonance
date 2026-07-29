# Aura Resonance — v0 Game Design Document

**Status:** v0 pilot scope. Supersedes the original GDD for all build purposes.
**Target:** one neighbourhood, ~25 players, 3–5 weeks solo build.
**Success test:** do players complete a second kindness quest on a *different day*?

---

## 1. What v0 is and is not

v0 exists to answer one question: **does the digital-physical kindness loop feel good enough that people come back?**

Everything that does not serve that question is cut. The full vision in the original GDD is not abandoned — it is deferred until the loop is proven.

### In scope

| Mechanic | v0 implementation |
| :--- | :--- |
| Resonance Map | Mapbox map, Auras and Fractures, foreground GPS only |
| Kindness Quest | Walk to a Fracture, perform a prompted act, verify by photo |
| Emotional Resonance | Paced breathing timer stabilises a puzzle. No heart rate. |
| Empathy Engine | Async text: submit a dilemma, others advise, author rates |
| Echoes | Text-only, geo-anchored, discovered by proximity on the map |
| Co-op Quest | GPS co-location + 4-digit session code |
| Progression | Aura Level, Resonance Points, server-authoritative ledger |

### Explicitly out of scope

Do not build these in v0. If a task seems to require one, stop and re-scope.

- **BLE / Web Bluetooth.** No native Safari support on iOS, and Web Bluetooth cannot do phone-to-phone peer discovery anyway. Replaced by session codes.
- **HealthKit / Health Connect / heart rate.** Gates a core mechanic behind wearable ownership. Replaced by a breathing pacer.
- **Persistent AR anchoring.** Cloud anchors are a project in themselves. Echoes are map-anchored, not surface-anchored.
- **Background location tracking.** Foreground-only check-ins. No geofencing, no background tasks.
- **Native app / app store submission.** PWA, installable, distributed by URL.
- **Photo Echoes.** Text-only in v0. Image UGC doubles the moderation surface.
- **Real-time multiplayer / WebSockets.** Firestore listeners are sufficient at this scale.

---

## 2. Core loop

1. **Prompt.** The map shows Fractures within ~2km. Each carries a kindness prompt.
2. **Travel.** The player walks there. The app does not track them en route — it checks position only when they tap *I'm here*.
3. **Act.** The player performs the prompted act: pick up litter, leave an Echo, greet someone, complete a co-op puzzle with another player.
4. **Verify.** Photo (moderated), session code (co-op), or breathing completion (high-tension).
5. **Reward.** The Fracture heals, Resonance Points are awarded server-side, the map brightens.

A session should take 10–20 minutes end to end. If it takes longer, cut steps.

---

## 3. Mechanic detail

### 3.1 Kindness Quest (photo-verified)

Player taps a Fracture → sees a prompt from `questTemplates` → walks there → taps *I'm here* (server verifies GPS within `radiusM`) → captures a photo → photo runs the moderation pipeline → on pass, Fracture heals and points are awarded.

**Verification is deliberately soft.** The photo is checked for *safety*, not for proof that the act occurred. Do not attempt AI verification that litter was actually collected — it does not work reliably and it makes the game feel like a suspicious auditor. The photo is a commitment device, not evidence.

### 3.2 Emotional Resonance (breathing)

High-Tension Fractures present a fragmented geometric puzzle (see the reference mockup: shattered mandala, "Breathe to Stabilize"). Puzzle pieces are visually unstable and cannot be dragged into place.

A breathing pacer runs a 4-7-8 cycle for 60–90 seconds. Puzzle stability is a function of *elapsed cycles completed*, not of any measurement. As stability rises, pieces snap into place and the puzzle becomes solvable.

There is no sensor here and that is fine. The mechanic teaches regulation by making the player *do* it. Camera PPG is a v1 upgrade, not a v0 requirement.

### 3.3 Empathy Engine

Author submits a dilemma (text, 100–800 chars, category-tagged) → **safety screen runs before the submission is ever visible** → if it passes, it enters a pool → up to 5 other players write advice → advice is moderated → author reads and rates → top-rated advisers receive points.

Anonymity is one-way: the author is anonymous to advisers, advisers are anonymous to the author, and both are known to the system for abuse handling. Never write "anonymous" in a way that implies the system cannot identify the author.

See `SAFETY.md` — this feature does not ship without the gate.

### 3.4 Echoes

Text-only, 140 chars, geo-anchored to the player's position at creation. Visible on the map within 50m. Moderated on write. Expire after 30 days. Rate-limited to 3 per player per day.

### 3.5 Co-op Quest

Player A opens a co-op Fracture and gets a 4-digit code valid for 10 minutes. Player B enters the code. The server verifies both positions are within 30m of each other *and* within the Fracture radius. Both then solve a shared puzzle via Firestore listeners.

This is functionally identical to the original BLE design from the player's point of view, and takes about a day instead of about a month.

---

## 4. Progression

- **Resonance Points (RP)** — awarded only by Cloud Functions, written only to the ledger. The client never writes points.
- **Aura Level** — derived from cumulative RP. Thresholds in `config/progression`.
- **Map brightness** — a neighbourhood-level aggregate of healed Fractures over the last 7 days, recomputed on a schedule.

Daily RP cap per player to blunt farming. Points for advice are awarded on the author's rating, not on submission.

---

## 5. Content seeding

The map must never be empty. Before any player joins:

- 40–60 Fractures placed across the test neighbourhood, hand-curated to real public locations (parks, benches, plazas, transit stops). Never place a Fracture on private property, a road, or anywhere unsafe to stand.
- 20+ quest templates across categories.
- A handful of seed Echoes written by you, clearly authored by the game.

Fractures respawn on a schedule so the map does not deplete.

---

## 6. What gets measured

Instrument from day one. The whole point of v0 is this table.

| Metric | Definition |
| :--- | :--- |
| **D1 / D7 return** | % of players who open the app on a later day |
| **Second-day quest** | % who complete a quest on ≥2 distinct days — *the primary metric* |
| Quest funnel | viewed → travelled → checked in → verified → healed |
| Time to first completion | signup to first healed Fracture |
| Empathy loop close rate | % of submissions receiving ≥1 rated advice within 48h |
| Moderation load | items flagged per 100 submissions, and your time spent per week |

If second-day quest completion is under ~20%, the loop is not working and the answer is not more sensors.

---

## 7. Deferred to v1+

Ordered by how much evidence would be needed to justify them:

1. Camera PPG heart rate (needs: breathing mechanic proven engaging)
2. Photo Echoes (needs: moderation load manageable at v0 volume)
3. Background location + geofenced notifications (needs: retention proven)
4. Native wrapper for app store distribution (needs: retention proven)
5. HealthKit / Health Connect (needs: evidence wearable owners are a meaningful segment)
6. AR anchoring (needs: a reason beyond novelty)
7. BLE proximity (needs: player density that makes 5m encounters plausible — likely never)
