import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { firebase } from './firebase';
import { AppError } from './errors';

const EMAIL_KEY = 'aura:emailForSignIn';

/** Subscribe to auth state. Returns an unsubscribe function. */
export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebase().auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(firebase().auth, provider);
}

/**
 * Send a passwordless sign-in link. The email is remembered locally so the
 * return visit can complete without re-typing it. In the Auth emulator the link
 * is printed to the emulator logs / UI rather than actually emailed.
 */
export async function sendEmailLink(email: string): Promise<void> {
  const url = `${window.location.origin}${window.location.pathname}`;
  await sendSignInLinkToEmail(firebase().auth, email, {
    url,
    handleCodeInApp: true,
  });
  window.localStorage.setItem(EMAIL_KEY, email);
}

/** True if the current URL is a completed email sign-in link. */
export function isEmailLink(url: string = window.location.href): boolean {
  return isSignInWithEmailLink(firebase().auth, url);
}

/** Complete the email-link flow after the user returns via the link. */
export async function completeEmailLink(
  url: string = window.location.href,
  email = window.localStorage.getItem(EMAIL_KEY) ?? '',
): Promise<void> {
  if (!email) {
    throw new AppError('auth/required', 'Enter the email you used to request the link');
  }
  await signInWithEmailLink(firebase().auth, email, url);
  window.localStorage.removeItem(EMAIL_KEY);
}

export async function signOut(): Promise<void> {
  await fbSignOut(firebase().auth);
}
