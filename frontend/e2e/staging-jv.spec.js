import { test, expect } from '@playwright/test'
import { hasLiveAuthConfig, loginLive } from './helpers/liveAuth.js'

/**
 * Live staging money-path smoke (read-only).
 * Uses operational vouchers (management smoke users can access them).
 * Ledger/JV requires finance/super_admin — not asserted here.
 * Does not POST vouchers.
 */
test.describe('staging live vouchers (read-only)', () => {
  test.beforeEach(() => {
    test.skip(!hasLiveAuthConfig(), 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for staging live login')
  })

  test('ERP vouchers tab shows list shell and New control', async ({ page }) => {
    await loginLive(page)
    await page.goto('/dashboard?tab=erp-vouchers', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=erp-vouchers/)

    const newControl = page.getByRole('button', { name: /^\+ New/i }).first()
    await expect(newControl).toBeVisible({ timeout: 45_000 })
  })
})
