# Aura Resonance — Firestore Schema (v0)

Firestore, not Realtime Database: v0 needs structured documents and geohash range queries more than it needs sub-100ms fanout. Geo queries use `geofire-common` (geohash prefix ranges + client-side distance filter).

**Cardinal rule:** the client never writes points, levels, healing state, or moderation status. Those are Cloud Function territory. Security rules enforce it.

---

## Collections

### `users/{uid}`

```ts
{
  uid: string;
  displayName: string;          // player-chosen, moderated on set
  avatarSeed: string;           // deterministic avatar, no photo uploads
  auraLevel: number;            // derived, function-written
  resonancePoints: number;      // denormalised from ledger, function-written
  ageConfirmed: boolean;
  ageConfirmedAt: Timestamp;
  homeRegion: string;           // ISO country code, for crisis resources
  strikes: number;              // function-written
  suspendedUntil: Timestamp | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  stats: {
    questsCompleted: number;
    distinctActiveDays: number;  // the primary metric lives here
    echoesCreated: number;
    adviceGiven: number;
  };
}
```

Client may write: `displayName`, `avatarSeed`, `lastActiveAt`. Nothing else.

### `users/{uid}/ledger/{entryId}`

Append-only, function-written, client read-only. The audit trail for every point.

```ts
{
  delta: number;
  reason: 'quest_complete' | 'echo_created' | 'advice_rated' | 'coop_complete' | 'daily_cap_adjust';
  refId: string | null;         // quest/echo/advice id
  balanceAfter: number;
  createdAt: Timestamp;
}
```

### `fractures/{fractureId}`

```ts
{
  type: 'kindness' | 'high_tension' | 'coop';
  templateId: string;           // → questTemplates
  geo: { lat: number; lng: number; geohash: string };
  radiusM: number;              // check-in tolerance, 40–80
  status: 'active' | 'healing' | 'healed' | 'suppressed';
  healedBy: string[];           // uids, capped
  healCount: number;
  neighbourhoodId: string;
  activeHours: { from: number; to: number };  // local hours, night suppression
  createdAt: Timestamp;
  respawnAt: Timestamp | null;
}
```

Client read-only. Query by geohash range on `geo.geohash` + `status == 'active'`.

### `questTemplates/{templateId}`

Seeded content, read-only to clients.

```ts
{
  type: 'kindness' | 'high_tension' | 'coop';
  title: string;
  prompt: string;               // what the player actually does
  verification: 'photo' | 'breathing' | 'session_code';
  rpReward: number;
  minAuraLevel: number;
  category: string;
}
```

### `questAttempts/{attemptId}`

The quest funnel lives here. One document per attempt, updated through its lifecycle — this is what feeds the funnel metrics.

```ts
{
  uid: string;
  fractureId: string;
  templateId: string;
  state: 'started' | 'checked_in' | 'submitted' | 'verified' | 'rejected' | 'abandoned';
  checkInGeo: { lat: number; lng: number } | null;   // captured at check-in only
  checkInDistanceM: number | null;                    // function-computed
  mediaId: string | null;
  breathingCyclesCompleted: number | null;
  coopSessionId: string | null;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
}
```

Client writes `state: 'started'` only. All transitions from `checked_in` onward go through `submitCheckIn` / `submitVerification` functions — otherwise players can self-award by writing `verified`.

### `media/{mediaId}`

```ts
{
  uid: string;
  attemptId: string;
  storagePath: string;          // processed image only; original never stored
  moderation: {
    status: 'pending' | 'pass' | 'flag' | 'block';
    labels: string[];
    facesBlurred: number;
    checkedAt: Timestamp | null;
  };
  createdAt: Timestamp;
}
```

Client read-only. Written by the Storage-triggered moderation function.

### `echoes/{echoId}`

```ts
{
  authorUid: string;
  text: string;                 // ≤140 chars
  geo: { lat: number; lng: number; geohash: string };
  moderation: { status: 'pending' | 'pass' | 'flag' | 'block'; labels: string[] };
  reportCount: number;
  hidden: boolean;              // auto-set at reportCount >= 2
  createdAt: Timestamp;
  expiresAt: Timestamp;         // +30d, TTL policy
}
```

Client creates via `createEcho` function only (rate limit: 3/day). Reads filtered to `moderation.status == 'pass' && hidden == false`.

### `empathySubmissions/{submissionId}`

```ts
{
  authorUid: string;            // never exposed to advisers
  bodyText: string;             // 100–800 chars
  category: string;
  safetyScreen: {
    status: 'pending' | 'passed' | 'crisis_routed' | 'blocked';
    flaggedCategories: string[];
    screenedAt: Timestamp | null;
  };
  state: 'pending' | 'open' | 'closed';
  adviceCount: number;          // max 5
  createdAt: Timestamp;
  closedAt: Timestamp | null;
  deleteAt: Timestamp;          // closedAt + 90d, TTL policy
}
```

**A submission is only readable by other players when `safetyScreen.status == 'passed' && state == 'open'`.** Enforce in rules, not just in queries. Created via `submitDilemma` function; enters as `pending` and is never visible until the screen passes.

### `empathyAdvice/{adviceId}`

```ts
{
  submissionId: string;
  authorUid: string;            // never exposed to the submission author
  text: string;
  moderation: { status: 'pending' | 'pass' | 'flag' | 'block'; labels: string[] };
  rating: number | null;        // 1–5, set by submission author
  ratedAt: Timestamp | null;
  createdAt: Timestamp;
}
```

### `coopSessions/{sessionId}`

```ts
{
  code: string;                 // 4 digits, unique among active sessions
  fractureId: string;
  hostUid: string;
  guestUid: string | null;
  state: 'waiting' | 'joined' | 'verified' | 'solving' | 'complete' | 'expired';
  hostGeo: { lat: number; lng: number } | null;
  guestGeo: { lat: number; lng: number } | null;
  separationM: number | null;   // function-computed at join
  puzzleState: object;          // shared, both players write
  createdAt: Timestamp;
  expiresAt: Timestamp;         // +10 min
}
```

Only `puzzleState` is client-writable, and only by the two participants after `state == 'verified'`. Codes are recycled once expired.

### `reports/{reportId}`

```ts
{
  reporterUid: string;
  targetType: 'echo' | 'advice' | 'submission' | 'media' | 'user';
  targetId: string;
  reason: string;
  state: 'open' | 'actioned' | 'dismissed';
  createdAt: Timestamp;
}
```

### `moderationQueue/{itemId}`

Function-written, readable only by admin uids. Denormalised view of everything needing your eyes.

### `config/{docId}`

Read-only to clients. Documents: `progression` (RP→level thresholds, daily cap), `crisisResources` (keyed by ISO country), `neighbourhoods` (test area bounds), `featureFlags`.

### `analytics_events/{eventId}`

Append-only, client-writable, never read by clients. Kept deliberately thin: `{ uid, event, params, ts }`. Everything in the GDD metrics table must be derivable from this plus `users.stats`.

---

## Security rules — the shape

```
// Nobody writes their own points.
match /users/{uid} {
  allow read: if signedIn();
  allow update: if isSelf(uid)
    && onlyChanging(['displayName','avatarSeed','lastActiveAt']);
  match /ledger/{e} { allow read: if isSelf(uid); allow write: if false; }
}

// Submissions invisible until screened.
match /empathySubmissions/{id} {
  allow read: if isAuthor(id) ||
    (resource.data.safetyScreen.status == 'passed'
     && resource.data.state == 'open');
  allow create, update: if false;   // functions only
}

match /fractures/{id}       { allow read: if signedIn(); allow write: if false; }
match /questAttempts/{id}   { allow read: if isOwner(); allow create: if isOwner() && request.resource.data.state == 'started'; allow update: if false; }
match /echoes/{id}          { allow read: if passed() && !hidden(); allow write: if false; }
match /moderationQueue/{id} { allow read: if isAdmin(); allow write: if false; }
```

Write rules tests before rules. An emulator test that asserts a client *cannot* write `resonancePoints` is worth more than the rules themselves.

---

## Cloud Functions

| Function | Trigger | Job |
| :--- | :--- | :--- |
| `submitCheckIn` | callable | Verify GPS within `radiusM`, advance attempt |
| `submitVerification` | callable | Validate proof, heal Fracture, write ledger, apply daily cap |
| `moderateMedia` | Storage onFinalize | Vision SafeSearch + face blur, write `media.moderation` |
| `screenDilemma` | Firestore onCreate | Crisis classifier, fail closed, open or route |
| `moderateText` | Firestore onCreate | Shared text moderation for echoes and advice |
| `createEcho` | callable | Rate limit, create, enqueue moderation |
| `joinCoopSession` | callable | Validate code, compute separation, verify |
| `rateAdvice` | callable | Record rating, award adviser points |
| `onReport` | Firestore onCreate | Increment counter, auto-hide at 2 |
| `respawnFractures` | scheduled hourly | Reactivate, apply night suppression |
| `recomputeMapBrightness` | scheduled daily | Neighbourhood aggregates |
| `truncateOldLocations` | scheduled daily | 30-day coordinate precision reduction |
