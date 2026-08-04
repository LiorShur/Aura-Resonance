# Scaling Fractures beyond the pilot

Captured during M10 so the "how do Fractures work at scale?" question is recorded,
not a loose end. **This is v1+ territory — deliberately not built in v0.** The
pilot must first prove the loop retains ~25 people in one neighbourhood; a global
Fracture pipeline is a fast-follow once that's known, per the GDD's deferral logic.

---

## How Fractures work today (v0)

- **Authored by hand.** Coordinates live in `scripts/data/fractures.geojson`,
  pushed by `seed:live`. There is **no generation algorithm** — Fractures do not
  emerge or spawn.
- **They cycle, not grow.** `respawnFractures` reactivates a healed Fracture after
  a cooldown, so a fixed curated set renews.
- **Curation is a safety requirement, not an oversight.** SAFETY §5: every point
  must be a place a person can safely stand and act — never a roadway, rail line,
  private property, or water. A human must have looked at each one.

This is the right tool for a one-neighbourhood pilot. It does **not** scale to a
city, let alone the globe, and is not meant to.

---

## The core tension

Any global model trades off **scale** against the **"safe to stand" guarantee**.
That guarantee is the product's ethical spine — it cannot be dropped to scale.

## Three proven shapes (and the realistic hybrid)

| Model | How | Scales | Safety |
|-------|-----|--------|--------|
| **Curated expansion** | Operator/moderators curate city-by-city as each area launches | Slowly | Highest — how Ingress / Pokémon GO *launched* |
| **Player submissions + review** | Players propose Fractures; a review queue vets each (cf. Niantic Wayfarer) | Yes, with effort | Good — needs a submission + human-review system to preserve §5 |
| **Algorithmic from POI data** | Derive candidates from OpenStreetMap / Google Places — parks, benches, plazas, viewpoints — filtered to safe public categories | Instantly, globally | Weakest alone — only as safe as the data + filters; still wants a review pass |

**Realistic end-state — a hybrid:** algorithmically *propose* candidates from
public-space POI data (never roads/buildings), auto-expire/respawn them, and gate
on **community or operator review** for safety. `scripts/poi-seed.ts` is the first
seed of the "propose from POI data" step — it drafts a `fractures.geojson` from
OpenStreetMap public-space POIs, which a human then trims and satellite-checks.

## What each shape would require to build

- **Submissions + review:** a `fractureProposals` collection, a submit callable
  with rate limits + an age/abuse gate, a review UI (extend the moderation queue),
  and a promotion step that only an operator/mod can trigger.
- **Algorithmic:** a POI ingestion job (Overpass/Places), a category allow-list,
  a de-dup + spacing pass, and a *mandatory* review gate before anything goes live.
- **Geo model:** v0 stores one `neighbourhoodId`; global needs a real regions
  model (bounds, per-region seed jobs, per-region brightness aggregates) and the
  map query already scales (geohash range) so that part is fine.

## Recommendation

Do **not** build this until retention is proven. When it is, start with
**submissions + review** (highest safety, proven by the genre) and layer
**algorithmic proposal** underneath to reduce curation load. `poi-seed.ts` is a
low-risk down-payment usable even for the pilot's next neighbourhood.

## Non-negotiables for any future model

1. Every live Fracture has passed a **human safety review** (§5).
2. No Fracture on a roadway, rail, private property, or water.
3. Night suppression and the "stay aware of surroundings" notice remain.
4. Proposals are rate-limited and abuse-gated like any other UGC.
