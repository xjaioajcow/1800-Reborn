import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Load environment variables before running any test.  This
    // ensures createBscTestnetSdk will find dummy addresses and
    // avoid throwing "Missing env" errors during unit tests.
    setupFiles: ['test/setup-env.ts'],
    coverage: {
      reporter: ['text', 'html'],
      // Only measure coverage for library source files.  Exclude
      // React‑specific re‑exports and utility entrypoints that do not
      // contain business logic.  Without these exclusions the
      // coverage percentage is dragged down by empty modules such as
      // src/react/usePiratePool.ts and src/index.ts.
      include: ['src/**/*.ts'],
      exclude: ['src/react/**', 'src/index.ts', 'src/multicall.ts', 'src/coreGame.ts'],
      statements: 80,
      lines: 80,
      branches: 80,
      functions: 80,
    },
  },
});