import { defineConfig } from 'vitest/config'

// Root config: global options that apply across all workspace projects
// (the projects themselves live in vitest.workspace.mjs).
export default defineConfig({
  test: {
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/*.config.*',
        '**/.eslintrc.js',
        '**/*.{test,spec}.{js,jsx}',
        'client/test/**',
        'client/src/main.jsx',
      ],
    },
  },
})
