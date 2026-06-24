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

export async function loginLive(page, config = getLiveAuthConfig()) {
  const { name, password, company } = config
  if (!name || !password) {
    throw new Error('E2E_AUTH_NAME and E2E_AUTH_PASSWORD are required for live login')
  }

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/login?company=${company}`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('Enter your username').fill(name)
  await page.getByPlaceholder('Enter your password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 30_000, waitUntil: 'commit' })
}
