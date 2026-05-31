import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

// When running inside a git worktree, node_modules may not exist at the worktree root.
// Use the parent project's node_modules by walking up.
const mainNodeModules = path.resolve(__dirname, '../../../node_modules')

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.vitest.json'] })],
  resolve: {
    alias: [],
  },
  server: {
    fs: {
      allow: [mainNodeModules, __dirname],
    },
  },
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
    deps: {
      moduleDirectories: ['node_modules', mainNodeModules],
    },
  },
})
