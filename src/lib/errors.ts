/**
 * Typed application errors. Throw these, never bare strings (CLAUDE.md style).
 * `code` is stable and safe to branch on; `message` is for logs/devs, not users.
 */

export type AppErrorCode =
  | 'sim/not-available'
  | 'geo/out-of-range'
  | 'geo/no-position'
  | 'auth/required'
  | 'quest/invalid-state'
  | 'moderation/held'
  | 'config/missing'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Narrow an unknown thrown value to a human-readable string, safely. */
export function errorMessage(value: unknown): string {
  if (isAppError(value) || value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  return 'An unexpected error occurred';
}
