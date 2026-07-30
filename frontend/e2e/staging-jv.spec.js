import { test, expect } from '@playwright/test'
import { hasLiveAuthConfig, loginLive } from './helpers/liveAuth.js'

/**
 * Live staging money-path smoke (read-only).
 * Uses operational vouchers (management smoke users can view them).
 * Does not assert + New (create may be read-only for smoke users).
 * Does not POST vouchers.
 */
test.describe('staging live vouchers (read-only)', () => {
  test.beforeEach(() => {
    test.skip(!hasLiveAuthConfig(), 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for staging live login')
  })

  test('ERP vouchers tab loads list shell', async ({ page }) => {
    await loginLive(page)
    await page.goto('/dashboard?tab=erp-vouchers', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=erp-vouchers/)

    await expect(page.getByRole('heading', { name: /— List$/i })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
    await expect(page.getByPlaceholder(/Search voucher no/i)).toBeVisible()
  })
})
