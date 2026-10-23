import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: 'npx tsx scripts/e2e-server.ts',
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'msedge',
    trace: 'retain-on-failure'
  }
})
