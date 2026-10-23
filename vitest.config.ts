import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const root = process.cwd()

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(root, 'src/shared'),
      '@main': resolve(root, 'src/main')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    sequence: { concurrent: false },
    fileParallelism: false,
    pool: 'forks'
  }
})
