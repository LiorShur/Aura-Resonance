import { initializeApp } from 'firebase-admin/app';
import { onCall } from 'firebase-functions/v2/https';

initializeApp();

/**
 * Function map for the pilot (implemented across M3–M9, see docs/SCHEMA.md):
 *
 *   submitCheckIn          callable            verify GPS within radiusM
 *   submitVerification     callable            heal Fracture, write ledger, cap RP
 *   moderateMedia          Storage onFinalize  Vision SafeSearch + face blur
 *   screenDilemma          Firestore onCreate  crisis classifier, FAIL CLOSED
 *   moderateText           Firestore onCreate  shared text moderation
 *   createEcho             callable            rate-limit + enqueue moderation
 *   joinCoopSession        callable            validate code, verify separation
 *   rateAdvice             callable            record rating, award adviser points
 *   onReport               Firestore onCreate  increment counter, auto-hide at 2
 *   respawnFractures       scheduled hourly    reactivate + night suppression
 *   recomputeMapBrightness scheduled daily     neighbourhood aggregates
 *   truncateOldLocations   scheduled daily     30-day coordinate truncation
 *
 * M0 ships only this health check so the codebase builds and the emulator has a
 * function to serve. Nothing here is authoritative game logic yet.
 */
export const ping = onCall(() => ({ ok: true, service: 'aura-resonance', v: 0 }));

export { createProfile } from './createProfile.js';
export { submitCheckIn, submitVerification } from './quest.js';
export {
  screenDilemma,
  moderateEcho,
  moderateAdvice,
  onReport,
} from './moderation/triggers.js';
export { moderateMedia } from './moderation/media.js';
