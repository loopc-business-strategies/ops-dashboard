import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173'
const isRemoteBase = /^https?:\/\//i.test(baseURL)
  && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/i.test(baseURL)

const vercelBypass = String(
  process.env.PLAYWRIGHT_VERCEL_BYPASS
  || process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  || process.env.STAGING_SMOKE_VERCEL_BYPASS
  || '',
).trim()

const extraHTTPHeaders = vercelBypass
  ? { 'x-vercel-protection-bypass': vercelBypass }
  : {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !isRemoteBase,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    extraHTTPHeaders,
    ...devices['Desktop Chrome'],
  },
  ...(isRemoteBase
    ? {}
    : {
        webServer: {
          command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
})
