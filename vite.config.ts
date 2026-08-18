import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
  },
  test: {
    environment: 'jsdom',
    pool: 'threads',
    maxWorkers: 1,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/infrastructure/**/*.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
})
