# Fracture proposals — player submissions + operator review (v1 design note)

**Status: design only. Not built in v0. Do not implement during the pilot.**

This captures the "players propose Fractures, a review queue vets each one" model
that `SCALING.md` recommends as the *first* scaling step after retention is proven.
It is the Niantic Wayfarer shape (community nomination → weighted review → promotion)
adapted to Aura's hard constraints and one-operator reality. Written now so the schema
and abuse model are recorded while the reasoning is fresh — **not** a signal to build it.

Why not now: at ~25 pilot players there are too few independent reviewers for
community consensus to mean anything (three friends can rubber-stamp each other).
The pilot answers *does the loop retain people* with hand-curated Fractures. A
submission pipeline only earns its complexity once there's a real map to grow and
enough reviewers — or a committed operator — to keep §5 intact.

---

## The one hard prerequisite

**Consensus is only as trustworthy as the number of *independent* reviewers.**
Wayfarer works because millions of reviewers make collusion expensive and its
reliability-weighting statistically meaningful. Copy the mechanism at 25 players and
you copy the shell without the engine. So this design ships in two phases:

- **Phase A — operator review (start here).** Every proposal goes to *you* (or a
  trusted mod). One reliable reviewer beats a gameable crowd. This is buildable the
  day retention is proven and needs no reviewer-trust maths.
- **Phase B — community review (later).** Add peer voting **weighted by a
  per-reviewer reliability score**, with operator sign-off still required to go live,
  only once there are enough unaffiliated reviewers for consensus to be real.

The schema below serves both. Phase A ignores the `votes`/reviewer-trust fields; Phase
B turns them on. Nothing about Phase A needs rework to reach Phase B.

---

## Non-negotiables carried from SAFETY §5

A proposal pipeline changes *who suggests* a location. It changes **nothing** about
the bar to go live. Every rule from `SAFETY.md` §5 and `SCALING.md` still holds:

1. Every live Fracture has passed a **human safety review**. A proposal is a
   candidate, never a Fracture, until an operator promotes it.
2. Never on a roadway, rail, private property, or water.
3. **Sensitive-location blocklist is mandatory and rejects outright** — K-12 schools,
   childcare, care homes, hospitals, shelters, police/fire. These are never generic
   POIs. Real-volunteering venues are **partnerships**, not submissions (safeguarding).
4. Night suppression and the "stay aware of your surroundings" notice are unaffected.
5. Proposals are UGC: **rate-limited, age-gated, and abuse-gated** like echoes/advice,
   and screened for text (title/description) and image (context photo) exactly as
   other UGC is — reusing `moderateText` and `moderateMedia`, fail-closed.

If a proposal cannot clear these, it is rejected. There is no scale argument that
outweighs them.

---

## Collections

### `fractureProposals/{proposalId}`

Client creates only the `submitted` shell (via the callable, never a direct write of
authoritative fields). Everything downstream is function- or operator-written.

```ts
{
  proposerUid: string;
  // Presence proof — captured one-shot at submit, same seam as check-in.
  // NO background location: read only when the player taps "Propose here".
  geo: { lat: number; lng: number; geohash: string };
  proposedType: 'kindness' | 'high_tension' | 'coop';
  title: string;                 // moderated (moderateText)
  description: string;           // moderated (moderateText)
  contextPhotoId: string | null; // → media/{id}, moderated (moderateMedia), face-blurred
  category: string;              // proposer's tag: 'square' | 'landmark' | 'viewpoint' | …

  state:
    | 'submitted'        // created by client, awaiting screening
    | 'screening'        // text/image moderation in flight
    | 'in_review'        // screened clean, on the operator/community queue
    | 'needs_changes'    // sent back to proposer with a reason
    | 'approved'         // operator promoted → a Fracture now exists
    | 'rejected'         // declined; reason recorded
    | 'auto_rejected';   // failed screening or a hard blocklist rule

  screen: {
    text: 'pending' | 'passed' | 'flagged';
    media: 'pending' | 'passed' | 'flagged' | 'n/a';
    blocklistHit: string | null;   // e.g. 'school' — auto_rejected, never queued
  };

  // Phase B only (dormant in Phase A):
  votes: { uid: string; verdict: 'yes' | 'no' | 'duplicate'; weight: number }[];
  reviewScore: number | null;      // weighted consensus, function-computed

  decidedBy: string | null;        // operator uid on approve/reject
  decisionReason: string | null;   // shown to proposer; required on reject/needs_changes
  promotedFractureId: string | null;
  duplicateOfFractureId: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Rate limit + gates (mirrors echoes/empathy)

- **Age-gated:** `users.ageConfirmed` required, same as empathy submission.
- **Rate-limited:** e.g. **3 open proposals** and **5 submissions/day** per uid,
  enforced server-side with a `.count()` query (as `createEcho` does).
- **Reputation-gated (soft):** a proposer with active strikes or `suspendedUntil`
  in the future cannot submit — reuse the moderation strike state.
- **Presence-gated:** the callable recomputes distance between the submitted `geo`
  and the caller's live position and rejects a proposal placed somewhere the player
  isn't. (One-shot, no tracking.)

---

## Cloud Functions

| Function | Trigger | Job |
| :--- | :--- | :--- |
| `submitFractureProposal` | callable | Age/strike/rate/presence gates; **hard blocklist check → `auto_rejected` on hit**; create `submitted` shell; enqueue text (+image) screening |
| `screenProposal` | Firestore onCreate/onUpdate | Run `moderateText` on title/description and `moderateMedia` on the context photo; **fail closed**; on clean → `in_review`, on flag → `flagged`/hold |
| `reviewProposal` | callable (operator/admin only) | `approve` \| `reject` \| `needs_changes` \| `mark_duplicate`; requires a reason on anything but approve |
| `promoteProposal` | called by `reviewProposal` on approve | Create the real `fractures/{id}` (active, correct `templateId`/`radiusM`/`activeHours`), set `promotedFractureId`, close the proposal. **Only path from proposal → Fracture.** |
| `castProposalVote` | callable (**Phase B only**) | Record a weighted peer vote; recompute `reviewScore`; never promotes on its own — operator sign-off still gates live |

Promotion is the single chokepoint. A proposal never becomes a Fracture by any route
except an operator (Phase A) or operator-confirmed consensus (Phase B) calling
`promoteProposal`. The client cannot write `fractures` — unchanged from v0.

---

## Security rules — the shape

```
match /fractureProposals/{id} {
  // Proposer sees their own; operators see the queue. No public browsing —
  // an unscreened proposal (title/photo) is UGC and must not leak.
  allow read: if isAuthor(id) || isAdmin();

  // Client may create ONLY the submitted shell, only as itself, only state
  // 'submitted'. Every authoritative field is function-written thereafter.
  allow create: if isSelf(request.resource.data.proposerUid)
    && request.resource.data.state == 'submitted'
    && !('promotedFractureId' in request.resource.data)
    && !('votes' in request.resource.data);

  allow update, delete: if false;   // functions only
}

// Unchanged, and load-bearing: the client still cannot write Fractures.
match /fractures/{id} { allow read: if signedIn(); allow write: if false; }
```

**Emulator tests before rules** (these are the real spec):

- A client **cannot** create a proposal already in `approved`/`in_review`.
- A client **cannot** create a proposal for another uid.
- A client **cannot** set `promotedFractureId`, `votes`, or `reviewScore`.
- A non-admin **cannot** call `reviewProposal` or `promoteProposal`.
- A proposal whose `geo` is outside check-in distance of the caller is rejected.
- A blocklist-category proposal lands `auto_rejected` and never reaches `in_review`.
- A proposer at their daily/open-proposal cap is refused.

---

## Client surface (sketch, for when it's built)

- **Propose here** entry point on the map — one-shot position, a short form
  (type, title, description, optional context photo), and an explicit
  "this is a public place a stranger can safely stand" confirmation.
- **My proposals** list showing `state` + `decisionReason` (approve / needs_changes /
  rejected), so feedback closes the loop the way Wayfarer notifies nominators.
- **Report / edit** on live Fractures (report → `reports/{id}`, already exists;
  edit → a lightweight proposal) so the map stays mutable and self-heals.
- Sim path (mandatory, per working rules): the whole propose→review→promote loop
  runnable at a desk with a mock position and an admin toggle.

---

## Build order, when the time comes

1. `fractureProposals` schema + rules + emulator tests (rules first, as always).
2. `submitFractureProposal` with all gates + the hard blocklist.
3. `screenProposal` reusing `moderateText`/`moderateMedia`, fail-closed.
4. `reviewProposal` + `promoteProposal` (operator-only) — **Phase A ends here and is
   already useful**: it's a clean submission→operator-review→live pipeline.
5. Client: Propose form, My proposals, report/edit, sim path.
6. **Only after there are enough independent reviewers:** `castProposalVote` +
   reviewer-reliability weighting (Phase B). Operator sign-off stays required.

Do not skip to Phase B. The reviewer count is the prerequisite, not a detail —
that is the single most important lesson from Wayfarer.
