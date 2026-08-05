import { defineConfig } from 'vitest/config';

// Functions source uses NodeNext, so intra-package imports carry a `.js`
// extension. Rewrite those specifiers to `.ts` for Vitest so the pure logic can
// be tested from source without a build step.
export default defineConfig({
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1.ts' }],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
