import type { Timestamp } from 'firebase/firestore';

/**
 * Client view of a `users/{uid}` document (docs/SCHEMA.md). The client may only
 * ever write `displayName`, `avatarSeed`, and `lastActiveAt`; everything else is
 * function-written and enforced by security rules. This type is read-shaped.
 */
export interface UserProfile {
  uid: string;
  displayName: string;
  avatarSeed: string;
  auraLevel: number;
  resonancePoints: number;
  ageConfirmed: boolean;
  ageConfirmedAt: Timestamp | null;
  /** ISO 3166-1 alpha-2 country code, used to pick crisis resources. */
  homeRegion: string;
  strikes: number;
  suspendedUntil: Timestamp | null;
  /** Opted in to daily quest reminders (FCM). */
  notifOptIn?: boolean;
  createdAt: Timestamp | null;
  lastActiveAt: Timestamp | null;
  stats: {
    questsCompleted: number;
    distinctActiveDays: number;
    echoesCreated: number;
    adviceGiven: number;
  };
}

/** True when the account is currently under a suspension window (SAFETY §3). */
export function isSuspended(profile: UserProfile, now: Date = new Date()): boolean {
  return !!profile.suspendedUntil && profile.suspendedUntil.toDate() > now;
}
