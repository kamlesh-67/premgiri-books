import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

// When running inside a git worktree, node_modules may not exist at the worktree root.
// Use the parent project's node_modules by walking up.
const mainNodeModules = path.resolve(__dirname, '../../../node_modules')

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.vitest.json'] })],
  resolve: {
    // Allow Vite to find packages from the main repo node_modules in a worktree context
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
    deps: {
      moduleDirectories: ['node_modules', mainNodeModules],
    },
  },
})
