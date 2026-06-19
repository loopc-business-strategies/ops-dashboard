export const mockAuthUser = {
  id: '507f1f77bcf86cd799439011',
  _id: '507f1f77bcf86cd799439011',
  name: 'E2E User',
  role: 'super_admin',
  company: 'loopc',
  department: '',
  allowedModules: ['erp', 'operations', 'finance', 'sales', 'hr', 'compliance', 'production', 'training', 'chat', 'admin'],
  modulePermissions: {},
}

export const mockAuthPayload = {
  success: true,
  csrfToken: 'e2e-csrf-token',
  user: mockAuthUser,
  token: 'e2e-test-token',
}

export async function stubAuthApi(page) {
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

/** Generic empty JSON for dashboard tab API noise during navigation E2E. */
export async function stubDashboardDataApi(page) {
  const emptyBody = JSON.stringify({
    success: true,
    projects: [],
    transactions: [],
    accounts: [],
    customers: [],
    vendors: [],
    currencies: [],
    products: [],
    movements: [],
    mappings: [],
    settings: {},
    dashboard: {},
    reports: {},
    users: [],
    employees: [],
    messages: [],
    groups: [],
  })

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    if (/\/api\/auth\//.test(url)) {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: emptyBody,
    })
  })
}

export async function loginToDashboard(page, company = 'loopc') {
  await stubAuthApi(page)
  await stubDashboardDataApi(page)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/login?company=${company}`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('Enter your username').fill('e2e-user')
  await page.getByPlaceholder('Enter your password').fill('ValidPass1!')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}
