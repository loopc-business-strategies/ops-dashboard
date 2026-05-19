/**
 * Run MG vendor registry maintenance against the deployed API.
 *
 * Env:
 *   MG_ADMIN_EMAIL / MG_ADMIN_PASSWORD (MG super_admin)
 *   CLEANUP_CONFIRM_TOKEN (matches Railway)
 *   API_BASE (default https://api.loopcstrategies.com)
 *
 *   node scripts/run-mg-vendor-registry-maintenance.js
 *   node scripts/run-mg-vendor-registry-maintenance.js --apply
 */

const API_BASE = (process.env.API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANT = 'mg'
const apply = process.argv.includes('--apply')

function parseCookies(setCookie = []) {
  const list = Array.isArray(setCookie) ? setCookie : [setCookie]
  return list.map((row) => String(row).split(';')[0]).filter(Boolean).join('; ')
}

async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant': TENANT,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data, cookie: parseCookies(res.headers.getSetCookie?.() || res.headers.raw?.()['set-cookie']) }
}

async function main() {
  const email = process.env.MG_ADMIN_EMAIL || process.env.SMOKE_AUTH_NAME_MG || process.env.SMOKE_AUTH_NAME
  const password = process.env.MG_ADMIN_PASSWORD || process.env.SMOKE_AUTH_PASSWORD_MG || process.env.SMOKE_AUTH_PASSWORD
  const confirmToken = process.env.CLEANUP_CONFIRM_TOKEN || ''

  if (!email || !password) {
    throw new Error('Set MG_ADMIN_EMAIL and MG_ADMIN_PASSWORD (or SMOKE_AUTH_* MG credentials)')
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })

  if (login.status >= 400 || !login.data?.success) {
    throw new Error(`Login failed (${login.status}): ${login.data?.message || 'unknown error'}`)
  }

  const maintenance = await request('/api/admin/maintenance/vendor-registry', {
    method: 'POST',
    cookie: login.cookie,
    headers: confirmToken ? { 'x-cleanup-token': confirmToken } : {},
    body: {
      dryRun: !apply,
      apply,
      purgeDeleted: true,
      removePlaceholders: true,
    },
  })

  console.log(JSON.stringify(maintenance.data, null, 2))
  if (maintenance.status >= 400) {
    process.exitCode = 1
    throw new Error(`Maintenance failed (${maintenance.status})`)
  }

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to execute.')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
