# Aura Resonance — Safety & Moderation Specification

**This document contains hard requirements. Features that depend on it do not ship until it is implemented and tested.**

Three features carry real risk: the Empathy Engine (strangers advising on personal problems), Echoes (anonymous geo-anchored messages), and quest photos (image UGC). Anonymous geo-anchored messaging has been abused in essentially every product that has shipped it. Assume it will be abused here.

---

## 1. Age gate

- Minimum age 16. Self-declared at signup, stored as `ageConfirmed` with a timestamp.
- Under-16 declaration → account creation blocked with a plain explanation. Do not offer a "restricted mode".
- If a user's content reveals they are a minor, suspend the account and remove their UGC.
- The Empathy Engine is never available to accounts without a passing age gate.

---

## 2. The crisis screen (Empathy Engine)

**Runs before a submission is ever stored as visible.** Submissions enter as `pending`; only a passing screen flips them to `open`.

### Categories that never enter the advice pool

- Suicide, self-harm, or intent to die
- Domestic violence, physical abuse, coercive control
- Child abuse or safeguarding concerns
- Sexual assault
- Disordered eating
- Substance dependency in crisis
- Threats of violence toward others
- Anything indicating the author is a minor

### What happens instead

The author sees a warm, non-clinical response acknowledging what they wrote, plus relevant crisis resources for their region. Never route this to strangers. Never tell them their submission was "rejected" or "violated policy" — they came with something hard and got told they broke a rule. Say the game is not the right place for this and point somewhere that is.

Maintain a small region-mapped resource list in `config/crisisResources`, keyed by country. Ship with Israel and South Africa at minimum, plus an international fallback. Verify every number before launch and re-verify quarterly — helplines change and disconnected numbers are worse than none.

### Implementation

Claude Haiku classification call in a Cloud Function, structured JSON output, categories above plus `ok`. On any classifier error, timeout, or ambiguous result, **fail closed**: treat as flagged, hold as `pending`, queue for your review. Never fail open on this path.

A keyword pre-filter runs first as a cheap belt-and-braces layer. Keywords catch the obvious; the classifier catches the rest. Neither alone is sufficient.

---

## 3. General moderation pipeline

Shared service used by Echoes, empathy advice, empathy submissions (after the crisis screen), and quest photos.

**Text:** Claude classification for harassment, hate, sexual content, personal information (phone numbers, addresses, full names), spam, and off-platform solicitation. Returns `pass` / `flag` / `block`.

**Images:** Google Cloud Vision SafeSearch, plus face detection. Any detected face is blurred before storage — port this from AccessibleTrailApp. Photos with `adult`, `violence`, or `racy` at LIKELY or above are blocked. Originals are never stored; only the processed version.

**Outcomes:**
- `pass` → visible immediately
- `flag` → visible, queued for your review within 24h
- `block` → never visible, author notified in plain language, strike recorded

Three strikes in 30 days → 7-day suspension. Five → permanent.

---

## 4. Reporting

Every piece of UGC carries a report control. Reports write to `reports/{id}` and increment a counter on the target. Two independent reports auto-hide the item pending review — hiding is cheap and reversible, leaving harmful content up is neither.

You need a moderation queue. A protected route in the app reading `moderationQueue` is sufficient; do not build an admin panel.

---

## 5. Location safety

- Never place a Fracture on private property, a roadway, a rail line, or anywhere unsafe to stand. Curate seed locations by hand against satellite imagery.
- Fractures are suppressed between 21:00 and 06:00 local time. The game does not send people to unfamiliar places after dark.
- Co-op matching never reveals another player's live position — only that both are within range of the same Fracture.
- No player-to-player free-text messaging in v0. Co-op communication is limited to the shared puzzle state.
- A visible "stay aware of your surroundings" notice on first launch and on each quest start.

---

## 6. Data handling

- Location is stored only at check-in moments. No continuous track, ever.
- Precise coordinates are retained 30 days, then truncated to ~1km precision for aggregate map brightness.
- Empathy submissions and advice are deleted 90 days after the submission closes.
- Account deletion removes all UGC and location records within 30 days, and is self-service — not an email request.
- A privacy policy exists before the first external player joins. It says what is collected and why, in language a person can read.

---

## 7. Pre-launch checklist

Do not invite a single external player until every line is true.

- [ ] Age gate blocks under-16 at signup
- [ ] Crisis screen tested against a fixture set of at least 30 realistic hard submissions
- [ ] Crisis screen fails closed on classifier error — tested by forcing a timeout
- [ ] Crisis resource numbers verified by calling them
- [ ] Moderation pipeline blocks a known-bad text and image fixture set
- [ ] Face blurring verified on real photos containing faces
- [ ] Report → auto-hide at 2 reports verified
- [ ] Moderation queue reachable and working
- [ ] Night suppression verified against local time, not UTC
- [ ] Every seed Fracture visually checked against satellite imagery
- [ ] Account deletion verified to actually delete
- [ ] Privacy policy live and linked
