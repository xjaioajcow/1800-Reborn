import { defineConfig } from 'tsup';

// See https://tsup.egoist.dev/ for full configuration options.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});