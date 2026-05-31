import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.vitest.json'] })],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.claude/**', 'e2e/**'],
    // jose is ESM-only — Vite must inline it rather than trying to load it as a CJS file
    server: {
      deps: {
        inline: ['jose'],
      },
    },
  },
})
