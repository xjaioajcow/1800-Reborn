import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      // Only measure coverage for plain TypeScript files. Excludes hooks.tsx which
      // relies on React runtime and is tested separately at the application layer.
      include: ['src/**/*.ts'],
      statements: 80,
      lines: 80,
      branches: 80,
      functions: 80,
    },
  },
});