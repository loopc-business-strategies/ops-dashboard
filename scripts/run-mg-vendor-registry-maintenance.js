/**
 * Run MG vendor registry maintenance against the deployed API.
 *
 * Env:
 *   MG_ADMIN_NAME / MG_ADMIN_PASSWORD (or SMOKE_AUTH_NAME_MG / SMOKE_AUTH_PASSWORD_MG)
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
  const setCookie = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : []
  return {
    status: res.status,
    data,
    cookie: parseCookies(setCookie),
    csrf: res.headers.get('x-csrf-token') || data?.csrfToken || '',
  }
}

async function main() {
  const name = process.env.MG_ADMIN_NAME || process.env.MG_ADMIN_EMAIL || process.env.SMOKE_AUTH_NAME_MG || process.env.SMOKE_AUTH_NAME
  const password = process.env.MG_ADMIN_PASSWORD || process.env.SMOKE_AUTH_PASSWORD_MG || process.env.SMOKE_AUTH_PASSWORD

  if (!name || !password) {
    throw new Error('Set MG_ADMIN_NAME and MG_ADMIN_PASSWORD (or SMOKE_AUTH_* MG credentials)')
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { name, password, company: TENANT },
  })

  if (login.status >= 400 || !login.data?.success) {
    throw new Error(`Login failed (${login.status}): ${login.data?.message || 'unknown error'}`)
  }

  const sessionCookie = login.cookie
  const csrfToken = login.data?.csrfToken || login.csrf

  const maintenance = await request('/api/erp-accounting/vendors/registry-maintenance', {
    method: 'POST',
    cookie: sessionCookie,
    headers: { 'X-CSRF-Token': csrfToken },
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
  } else {
    console.log('\nApplied on production MG.')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
