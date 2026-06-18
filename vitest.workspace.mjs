import { defineWorkspace } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Two projects so the React client runs in jsdom and the Express server runs
// in node — each with its own environment and test glob.
export default defineWorkspace([
  {
    plugins: [react()],
    test: {
      name: 'client',
      root: './client',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./test/setup.js'],
      include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
  },
  {
    test: {
      name: 'server',
      root: './server',
      environment: 'node',
      globals: true,
      include: ['**/*.{test,spec}.js'],
      exclude: ['**/node_modules/**', '**/data/**'],
    },
  },
])
