import { test, expect } from '@playwright/test'

test.describe('smoke', () => {
  test('serves the SPA shell', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('#root')).toBeVisible()
  })
})
