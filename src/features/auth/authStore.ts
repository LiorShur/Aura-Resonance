import { create } from 'zustand';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import { firebase } from '@/lib/firebase';
import { watchAuth, signOut as fbSignOut } from '@/lib/auth';
import { isSuspended, type UserProfile } from '@/lib/models';

export type AuthStatus =
  | 'loading' // resolving initial auth state
  | 'signed_out' // no Firebase user
  | 'onboarding' // signed in, no profile document yet (age gate not passed)
  | 'suspended' // profile exists but under an active suspension
  | 'ready';

export interface CreateProfileInput {
  /** YYYY-MM-DD. Used to compute age server-side; the date itself is discarded. */
  birthDate: string;
  /** ISO 3166-1 alpha-2, drives crisis-resource selection. */
  homeRegion: string;
  displayName: string;
  avatarSeed: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  status: AuthStatus;
  error: string | null;

  init: () => () => void;
  createProfile: (input: CreateProfileInput) => Promise<void>;
  /** The only client-writable profile fields (SCHEMA: displayName, avatarSeed). */
  updateVanity: (patch: { displayName?: string; avatarSeed?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

function statusFor(user: User | null, profile: UserProfile | null): AuthStatus {
  if (!user) return 'signed_out';
  if (!profile) return 'onboarding';
  if (isSuspended(profile)) return 'suspended';
  return 'ready';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  status: 'loading',
  error: null,

  /** Call once at app mount. Wires auth → profile snapshot → status. */
  init: () => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = watchAuth((user) => {
      unsubProfile?.();
      unsubProfile = null;

      if (!user) {
        set({ user: null, profile: null, status: 'signed_out' });
        return;
      }

      set({ user });
      const ref = doc(firebase().db, 'users', user.uid);
      unsubProfile = onSnapshot(
        ref,
        (snap) => {
          const profile = snap.exists() ? (snap.data() as UserProfile) : null;
          set({ profile, status: statusFor(get().user, profile) });
        },
        (err) => set({ error: err.message }),
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  },

  createProfile: async (input) => {
    set({ error: null });
    const fn = httpsCallable<CreateProfileInput, { ok: boolean }>(
      firebase().functions,
      'createProfile',
    );
    await fn(input);
    // The users/{uid} snapshot listener flips status to 'ready' once written.
  },

  updateVanity: async (patch) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateDoc(doc(firebase().db, 'users', uid), {
      ...patch,
      lastActiveAt: serverTimestamp(),
    });
  },

  signOut: async () => {
    await fbSignOut();
  },
}));
