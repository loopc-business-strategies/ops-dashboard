import { test, expect } from '@playwright/test'
import { getLiveAuthConfig, hasLiveAuthConfig, loginLive } from './helpers/liveAuth.js'

test.describe('staging authenticated E2E', () => {
  test.beforeEach(() => {
    test.skip(!hasLiveAuthConfig(), 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for staging live login')
  })

  test('live login reaches dashboard on staging preview', async ({ page }) => {
    await loginLive(page)
    await expect(page.locator('#root')).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('authenticated session opens ERP ledger deep link', async ({ page }) => {
    await loginLive(page)
    await page.goto('/dashboard?tab=erp-ledger', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=erp-ledger/)
    await expect(page.locator('#root')).toBeVisible()
  })

  test('authenticated session preserves enquiry tab query params', async ({ page }) => {
    const { company } = getLiveAuthConfig()
    await loginLive(page)
    await page.goto(`/dashboard?tab=erp-enquiry&company=${company}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=erp-enquiry/)
    await expect(page).toHaveURL(new RegExp(`company=${company}`))
    await expect(page.locator('#root')).toBeVisible()
  })
})
