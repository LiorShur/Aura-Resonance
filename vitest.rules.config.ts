import { defineConfig } from 'vitest/config';

// Security-rules tests run against the Firestore emulator (launched by
// `npm run test:rules` via `firebase emulators:exec`). Kept separate from the
// default unit-test config so `npm test` never needs the emulator.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Rules evaluation + emulator round-trips are slower than unit tests.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
