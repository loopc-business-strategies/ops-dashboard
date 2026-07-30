import { test, expect } from '@playwright/test'
import { hasLiveAuthConfig, loginLive } from './helpers/liveAuth.js'

/**
 * Live staging money-path smoke (read-only).
 * Does not POST journal vouchers — asserts ledger JV UI loads against the live API.
 */
test.describe('staging live ledger / JV (read-only)', () => {
  test.beforeEach(() => {
    test.skip(!hasLiveAuthConfig(), 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for staging live login')
  })

  test('ERP ledger shows Journal Voucher shell and New JV control', async ({ page }) => {
    await loginLive(page)
    await page.goto('/dashboard?tab=erp-ledger', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=erp-ledger/)

    await expect(page.getByRole('heading', { name: /Journal Voucher/i })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: /\+ New Journal Voucher/i })).toBeVisible()
  })
})
