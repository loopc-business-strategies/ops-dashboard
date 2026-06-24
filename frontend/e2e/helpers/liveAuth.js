export function getLiveAuthConfig() {
  return {
    name: String(process.env.E2E_AUTH_NAME || '').trim(),
    password: String(process.env.E2E_AUTH_PASSWORD || '').trim(),
    company: String(process.env.E2E_AUTH_COMPANY || 'loopc').trim().toLowerCase(),
  }
}

export function hasLiveAuthConfig() {
  const { name, password } = getLiveAuthConfig()
  return Boolean(name && password)
}

export function getVercelBypass() {
  return String(
    process.env.PLAYWRIGHT_VERCEL_BYPASS
    || process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    || process.env.STAGING_SMOKE_VERCEL_BYPASS
    || '',
  ).trim()
}

export async function applyVercelBypassRoute(page) {
  const bypass = getVercelBypass()
  if (!bypass) return

  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    if (!/\.vercel\.app/i.test(requestUrl)) {
      await route.continue()
      return
    }

    const headers = {
      ...route.request().headers(),
      'x-vercel-protection-bypass': bypass,
      'x-vercel-set-bypass-cookie': 'true',
    }
    await route.continue({ headers })
  })
}

export async function loginLive(page, config = getLiveAuthConfig()) {
  const { name, password, company } = config
  if (!name || !password) {
    throw new Error('E2E_AUTH_NAME and E2E_AUTH_PASSWORD are required for live login')
  }

  await page.setViewportSize({ width: 1280, height: 720 })
  await applyVercelBypassRoute(page)
  await page.goto(`/login?company=${company}`, { waitUntil: 'domcontentloaded' })

  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
    { timeout: 45_000 },
  )

  await page.getByPlaceholder('Enter your username').fill(name)
  await page.getByPlaceholder('Enter your password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  const loginResponse = await loginResponsePromise
  const loginBody = await loginResponse.json().catch(() => ({}))
  if (!loginResponse.ok() || loginBody.success !== true) {
    const message = loginBody.message || `HTTP ${loginResponse.status()}`
    throw new Error(`Live login failed: ${message}`)
  }

  await page.waitForURL(/\/dashboard/, { timeout: 15_000, waitUntil: 'commit' })
}
