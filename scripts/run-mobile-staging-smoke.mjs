/**
 * Mobile JWT smoke against the staging API (same routes as production mobile smoke).
 *
 * Env (credentials — never commit):
 *   MOBILE_SMOKE_LOGIN_NAME / MOBILE_SMOKE_LOGIN_PASSWORD
 *   or STAGING_SMOKE_AUTH_NAME / STAGING_SMOKE_AUTH_PASSWORD
 *   or per-tenant STAGING_SMOKE_AUTH_NAME_LOOPC + STAGING_SMOKE_AUTH_PASSWORD_LOOPC
 *
 *   MOBILE_SMOKE_API_URL or STAGING_SMOKE_API_BASE (default staging Railway URL)
 *   MOBILE_SMOKE_COMPANY (default loopc)
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_STAGING_API = 'https://ops-dashboard-staging-e6c6.up.railway.app'

const company = String(process.env.MOBILE_SMOKE_COMPANY || 'loopc').trim().toLowerCase()
const tenantKey = company.toUpperCase()

const apiUrl = String(
  process.env.MOBILE_SMOKE_API_URL
  || process.env.STAGING_SMOKE_API_BASE
  || DEFAULT_STAGING_API,
).trim().replace(/\/+$/, '')

const name = String(
  process.env.MOBILE_SMOKE_LOGIN_NAME
  || process.env[`STAGING_SMOKE_AUTH_NAME_${tenantKey}`]
  || process.env.STAGING_SMOKE_AUTH_NAME
  || process.env.SMOKE_AUTH_NAME
  || '',
).trim()

const password = String(
  process.env.MOBILE_SMOKE_LOGIN_PASSWORD
  || process.env[`STAGING_SMOKE_AUTH_PASSWORD_${tenantKey}`]
  || process.env.STAGING_SMOKE_AUTH_PASSWORD
  || process.env.SMOKE_AUTH_PASSWORD
  || '',
).trim()

if (!name || !password) {
  console.error(
    'Missing credentials. Set STAGING_SMOKE_AUTH_NAME and STAGING_SMOKE_AUTH_PASSWORD\n'
    + '(or MOBILE_SMOKE_LOGIN_NAME / MOBILE_SMOKE_LOGIN_PASSWORD).',
  )
  process.exit(1)
}

if (/loopcstrategies\.com/i.test(apiUrl) && !/railway\.app/i.test(apiUrl)) {
  console.error(
    `Refusing mobile staging smoke against production-looking API: ${apiUrl}\n`
    + 'Set STAGING_SMOKE_API_BASE to the staging Railway URL.',
  )
  process.exit(1)
}

console.log(`Mobile staging API smoke -> ${apiUrl} (tenant ${company})`)

const result = spawnSync('npm', ['run', 'smoke:api'], {
  cwd: path.join(ROOT, 'mobile'),
  env: {
    ...process.env,
    MOBILE_SMOKE_API_URL: apiUrl,
    MOBILE_SMOKE_COMPANY: company,
    MOBILE_SMOKE_LOGIN_NAME: name,
    MOBILE_SMOKE_LOGIN_PASSWORD: password,
  },
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status === null ? 1 : result.status)
