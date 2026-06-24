/* eslint-disable no-console */
const TENANTS = ['mg', 'cg', 'loopc']

const BASE_DOMAIN = process.env.SMOKE_BASE_DOMAIN || 'loopcstrategies.com'
const API_BASE = (process.env.SMOKE_API_BASE || `https://api.${BASE_DOMAIN}`).replace(/\/$/, '')
const VERCEL_HOSTS = (process.env.SMOKE_VERCEL_HOSTS || TENANTS.map((tenant) => `${tenant}.${BASE_DOMAIN}`).join(','))
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)
const SMOKE_SKIP_FRONTEND = String(process.env.SMOKE_SKIP_FRONTEND || '').trim().toLowerCase() === 'true'
const SMOKE_ENV_LABEL = process.env.SMOKE_ENV_LABEL || 'Production'
const RAILWAY_READINESS_URL = process.env.SMOKE_RAILWAY_READINESS_URL || process.env.SMOKE_RAILWAY_HEALTH_URL || `${API_BASE}/api/ready`
const SMOKE_AUTH_TOKEN = String(process.env.SMOKE_AUTH_TOKEN || '').trim()
const SMOKE_SESSION_COOKIE = String(process.env.SMOKE_SESSION_COOKIE || '').trim()
const SMOKE_AUTH_NAME = String(process.env.SMOKE_AUTH_NAME || '').trim()
const SMOKE_AUTH_PASSWORD = String(process.env.SMOKE_AUTH_PASSWORD || '').trim()
const SMOKE_VERCEL_PROTECTION_BYPASS = String(
  process.env.SMOKE_VERCEL_PROTECTION_BYPASS || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
).trim()
const smokeAuthExplicit = String(process.env.SMOKE_REQUIRE_AUTH || '').trim().toLowerCase()
const SMOKE_REQUIRE_AUTH = smokeAuthExplicit !== 'false'

function vercelProtectionHeaders() {
  if (!SMOKE_VERCEL_PROTECTION_BYPASS) return {}
  return { 'x-vercel-protection-bypass': SMOKE_VERCEL_PROTECTION_BYPASS }
}

function isVercelPreviewHost(host) {
  return /\.vercel\.app$/i.test(String(host || '').trim())
}

function assertSmokeAuthConfigured() {
  if (!SMOKE_REQUIRE_AUTH) return

  if (SMOKE_AUTH_TOKEN || SMOKE_SESSION_COOKIE) return

  const missingTenants = TENANTS.filter((tenant) => !getTenantSmokeCredentials(tenant))
  if (missingTenants.length) {
    const tenantVars = missingTenants
      .map((tenant) => `SMOKE_AUTH_NAME_${tenant.toUpperCase()} / SMOKE_AUTH_PASSWORD_${tenant.toUpperCase()}`)
      .join(', ')
    throw new Error(
      `SMOKE_REQUIRE_AUTH=true but ERP smoke credentials are missing for: ${missingTenants.join(', ')}. `
      + `Set shared SMOKE_AUTH_NAME/SMOKE_AUTH_PASSWORD or per-tenant vars (${tenantVars}).`
    )
  }
}
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20000)

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function check(name, fn) {
  const started = Date.now()
  try {
    const detail = await fn()
    return { name, ok: true, ms: Date.now() - started, detail }
  } catch (error) {
    return { name, ok: false, ms: Date.now() - started, error: error.message || String(error) }
  }
}

async function verifyPortalHost(host) {
  const url = `https://${host}/login`
  const response = await fetchWithTimeout(url, { headers: vercelProtectionHeaders() })
  const body = await response.text()
  const hasAppShell = /id="root"/i.test(body) || /<title>\s*Ops Dashboard\s*<\/title>/i.test(body)
  if (!response.ok || !hasAppShell) {
    if (response.status === 401 && isVercelPreviewHost(host) && !SMOKE_VERCEL_PROTECTION_BYPASS) {
      throw new Error(
        `${url} returned 401 — Vercel Deployment Protection is enabled for preview deployments. `
        + 'Create a Protection Bypass for Automation secret in Vercel (Project → Settings → Deployment Protection) '
        + 'and set SMOKE_VERCEL_PROTECTION_BYPASS, or disable preview protection for this project.',
      )
    }
    throw new Error(`${url} returned ${response.status} without app shell`)
  }
  return `${response.status} ${url}`
}

async function verifyRailwayReadiness(tenant) {
  const response = await fetchWithTimeout(RAILWAY_READINESS_URL, {
    headers: {
      'x-tenant': tenant,
      'x-company': tenant,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.ready !== true) {
    throw new Error(`${RAILWAY_READINESS_URL} returned ${response.status}`)
  }
  const sha = String(body?.build?.sha || body?.backend?.sha || body?.commit || 'unknown').slice(0, 7)
  return `${response.status} build=${sha}`
}

async function verifyTenantAuthPath(tenant) {
  const response = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant': tenant,
      'x-company': tenant,
    },
    body: JSON.stringify({
      company: tenant,
      name: '__smoke_invalid__',
      password: '__smoke_invalid__',
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (response.status !== 401 || !/invalid credentials/i.test(String(body.message || ''))) {
    throw new Error(`auth route returned ${response.status}: ${body.message || 'unexpected response'}`)
  }
  return `${response.status} invalid-login probe`
}

function tenantEnvName(base, tenant) {
  return `${base}_${tenant.toUpperCase()}`
}

function getTenantSmokeCredentials(tenant) {
  const name = String(process.env[tenantEnvName('SMOKE_AUTH_NAME', tenant)] || SMOKE_AUTH_NAME || '').trim()
  const password = String(process.env[tenantEnvName('SMOKE_AUTH_PASSWORD', tenant)] || SMOKE_AUTH_PASSWORD || '').trim()
  if (!name || !password) return null
  return { name, password }
}

function cookieHeaderFromResponse(response) {
  const rawSetCookie = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)

  return rawSetCookie
    .flatMap((value) => String(value || '').split(/,(?=\s*[^;,=\s]+=[^;,]+)/))
    .map((value) => value.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

async function loginForSmoke(tenant) {
  const credentials = getTenantSmokeCredentials(tenant)
  if (!credentials) return null

  const response = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant': tenant,
      'x-company': tenant,
    },
    body: JSON.stringify({
      company: tenant,
      name: credentials.name,
      password: credentials.password,
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success !== true) {
    throw new Error(`smoke login returned ${response.status}: ${body.message || 'unexpected response'}`)
  }

  const cookie = cookieHeaderFromResponse(response)
  const csrfToken = String(body.csrfToken || response.headers.get('x-csrf-token') || '').trim()
  if (!cookie) throw new Error('smoke login did not return a session cookie')

  return { cookie, csrfToken }
}

async function verifyTenantReadOnlyErpPath(tenant) {
  let smokeSession = null
  if (!SMOKE_AUTH_TOKEN && !SMOKE_SESSION_COOKIE) {
    smokeSession = await loginForSmoke(tenant)
  }

  if (!SMOKE_AUTH_TOKEN && !SMOKE_SESSION_COOKIE && !smokeSession) {
    throw new Error(
      `authenticated ERP probe requires credentials for ${tenant}. `
      + 'Set SMOKE_AUTH_TOKEN, SMOKE_SESSION_COOKIE, or SMOKE_AUTH_NAME/SMOKE_AUTH_PASSWORD '
      + `(or SMOKE_AUTH_NAME_${tenant.toUpperCase()}/SMOKE_AUTH_PASSWORD_${tenant.toUpperCase()}).`
    )
  }

  const headers = {
    'x-tenant': tenant,
    'x-company': tenant,
  }
  if (SMOKE_AUTH_TOKEN) headers.authorization = `Bearer ${SMOKE_AUTH_TOKEN}`
  if (SMOKE_SESSION_COOKIE || smokeSession?.cookie) headers.cookie = SMOKE_SESSION_COOKIE || smokeSession.cookie
  if (smokeSession?.csrfToken) headers['x-csrf-token'] = smokeSession.csrfToken

  const response = await fetchWithTimeout(`${API_BASE}/api/erp-accounting/transactions?limit=1`, { headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success !== true) {
    throw new Error(`ERP read-only route returned ${response.status}: ${body.message || 'unexpected response'}`)
  }
  return `${response.status} transactions read-only probe`
}

async function verifyCsrfAuthShape(tenant) {
  const response = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant': tenant,
      'x-company': tenant,
    },
    body: JSON.stringify({
      company: tenant,
      name: '__smoke_invalid__',
      password: '__smoke_invalid__',
    }),
  })
  const body = await response.json().catch(() => ({}))
  const message = String(body.message || '')
  if (/csrf validation failed/i.test(message)) {
    throw new Error('login path was unexpectedly blocked by CSRF validation')
  }
  if (response.status !== 401) {
    throw new Error(`login shape returned ${response.status}: ${message || 'unexpected response'}`)
  }
  return `${response.status} csrf/auth bypass shape`
}

async function run() {
  console.log(`${SMOKE_ENV_LABEL} smoke report`)
  console.log(`API: ${API_BASE}`)
  console.log(`Railway readiness: ${RAILWAY_READINESS_URL}`)
  console.log(`Vercel hosts: ${SMOKE_SKIP_FRONTEND ? 'skipped' : VERCEL_HOSTS.join(', ')}`)
  if (!SMOKE_SKIP_FRONTEND && VERCEL_HOSTS.some(isVercelPreviewHost)) {
    console.log(`Vercel preview bypass: ${SMOKE_VERCEL_PROTECTION_BYPASS ? 'configured' : 'missing'}`)
  }
  console.log(`ERP auth required: ${SMOKE_REQUIRE_AUTH ? 'yes' : 'no'}`)

  assertSmokeAuthConfigured()

  const checks = []
  if (!SMOKE_SKIP_FRONTEND) {
    for (const host of VERCEL_HOSTS) {
      checks.push(check(`vercel:${host}`, () => verifyPortalHost(host)))
    }
  }
  for (const tenant of TENANTS) {
    checks.push(check(`railway:${tenant}:ready`, () => verifyRailwayReadiness(tenant)))
    checks.push(check(`railway:${tenant}:auth-routing`, () => verifyTenantAuthPath(tenant)))
    checks.push(check(`railway:${tenant}:csrf-auth-shape`, () => verifyCsrfAuthShape(tenant)))
    if (SMOKE_REQUIRE_AUTH) {
      checks.push(check(`railway:${tenant}:erp-readonly`, () => verifyTenantReadOnlyErpPath(tenant)))
    }
  }

  const results = await Promise.all(checks)
  for (const result of results) {
    const marker = result.ok ? 'OK ' : 'FAIL'
    const detail = result.ok ? result.detail : result.error
    console.log(`${marker} ${result.name} (${result.ms}ms) ${detail}`)
  }

  const failures = results.filter((result) => !result.ok)
  if (failures.length) {
    console.error(`${SMOKE_ENV_LABEL} smoke failed: ${failures.length}/${results.length} checks failed.`)
    process.exit(1)
  }

  console.log(`${SMOKE_ENV_LABEL} smoke passed: ${results.length}/${results.length} checks OK.`)
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
