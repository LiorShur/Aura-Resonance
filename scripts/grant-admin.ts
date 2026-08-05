import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Grant (or revoke) the `admin` custom claim that gates the moderation queue
 * (SAFETY §4 — the `isAdmin()` security rule reads `request.auth.token.admin`).
 * The claim is only ever set here, never from the app.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     tsx scripts/grant-admin.ts you@example.com
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     tsx scripts/grant-admin.ts you@example.com --revoke
 *
 * The target may be an email or a raw UID. Requires a service-account JSON so it
 * cannot touch a project without explicit credentials.
 */
async function main() {
  const target = process.argv[2];
  const revoke = process.argv.includes('--revoke');
  if (!target || target.startsWith('--')) {
    throw new Error('Usage: tsx scripts/grant-admin.ts <email-or-uid> [--revoke]');
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON for the\n' +
        'target project before running. Aborting so nothing is changed blindly.',
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? 'aura-resonance-dev';
  if (!getApps().length) initializeApp({ projectId });
  const auth = getAuth();

  const user = target.includes('@')
    ? await auth.getUserByEmail(target)
    : await auth.getUser(target);

  const claims = { ...(user.customClaims ?? {}), admin: revoke ? undefined : true };
  await auth.setCustomUserClaims(user.uid, claims);

  console.log(
    `${revoke ? 'Revoked' : 'Granted'} admin for ${user.email ?? user.uid} ` +
      `(project ${projectId}). The user must sign out/in (or the app force-refreshes ` +
      `the token) for the claim to take effect.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
