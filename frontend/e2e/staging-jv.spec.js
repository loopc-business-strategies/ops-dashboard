import { test, expect } from '@playwright/test'
import { hasLiveAuthConfig, loginLive } from './helpers/liveAuth.js'

/**
 * Live staging money-path smoke (read-only).
 * Uses ERP Transactions (accessible to management smoke users).
 * Does not POST / create transactions.
 */
test.describe('staging live transactions (read-only)', () => {
  test.beforeEach(() => {
    test.skip(!hasLiveAuthConfig(), 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for staging live login')
  })

  test('ERP transactions tab loads money list shell', async ({ page }) => {
    await loginLive(page)
    await page.goto('/dashboard?tab=erp-transactions', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=erp-transactions/)

    await expect(page.getByRole('heading', { name: /^Transactions$/i })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: /Apply Filters/i })).toBeVisible()
  })
})
