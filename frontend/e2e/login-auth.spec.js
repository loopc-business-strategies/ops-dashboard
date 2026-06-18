import { test, expect } from '@playwright/test'

const mockAuthUser = {
  id: '507f1f77bcf86cd799439011',
  name: 'E2E User',
  role: 'super_admin',
  company: 'loopc',
  department: '',
  allowedModules: ['erp', 'operations', 'finance'],
  modulePermissions: { erp: { subTabs: { dashboard: true, accounts: true } } },
}

const mockAuthPayload = {
  success: true,
  csrfToken: 'e2e-csrf-token',
  user: mockAuthUser,
}

async function stubAuthApi(page) {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAuthPayload),
    })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAuthPayload),
    })
  })
}

test.describe('login auth smoke', () => {
  test('mocked login reaches dashboard shell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await stubAuthApi(page)
    await page.goto('/login?company=loopc', { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder('Enter your username').fill('e2e-user')
    await page.getByPlaceholder('Enter your password').fill('ValidPass1!')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.locator('#root')).toBeVisible()
  })

  test('live login when E2E credentials are configured', async ({ page }) => {
    const name = process.env.E2E_AUTH_NAME
    const password = process.env.E2E_AUTH_PASSWORD
    const company = process.env.E2E_AUTH_COMPANY || 'loopc'
    test.skip(!name || !password, 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for live API login')

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/login?company=${company}`, { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder('Enter your username').fill(name)
    await page.getByPlaceholder('Enter your password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
    await expect(page.locator('#root')).toBeVisible()
  })
})
