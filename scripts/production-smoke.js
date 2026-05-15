/* eslint-disable no-console */
const TENANTS = ['mg', 'cg', 'loopc']

const BASE_DOMAIN = process.env.SMOKE_BASE_DOMAIN || 'loopcstrategies.com'
const API_BASE = (process.env.SMOKE_API_BASE || `https://api.${BASE_DOMAIN}`).replace(/\/$/, '')
const VERCEL_HOSTS = (process.env.SMOKE_VERCEL_HOSTS || TENANTS.map((tenant) => `${tenant}.${BASE_DOMAIN}`).join(','))
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)
const RAILWAY_HEALTH_URL = process.env.SMOKE_RAILWAY_HEALTH_URL || `${API_BASE}/api/health`
const SMOKE_AUTH_TOKEN = String(process.env.SMOKE_AUTH_TOKEN || '').trim()
const SMOKE_SESSION_COOKIE = String(process.env.SMOKE_SESSION_COOKIE || '').trim()
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
  const response = await fetchWithTimeout(url)
  const body = await response.text()
  const hasAppShell = /id="root"/i.test(body) || /<title>\s*Ops Dashboard\s*<\/title>/i.test(body)
  if (!response.ok || !hasAppShell) {
    throw new Error(`${url} returned ${response.status} without app shell`)
  }
  return `${response.status} ${url}`
}

async function verifyRailwayHealth(tenant) {
  const response = await fetchWithTimeout(RAILWAY_HEALTH_URL, {
    headers: {
      'x-tenant': tenant,
      'x-company': tenant,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success !== true) {
    throw new Error(`${RAILWAY_HEALTH_URL} returned ${response.status}`)
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

async function verifyTenantReadOnlyErpPath(tenant) {
  if (!SMOKE_AUTH_TOKEN && !SMOKE_SESSION_COOKIE) {
    return 'skipped; set SMOKE_AUTH_TOKEN or SMOKE_SESSION_COOKIE for authenticated ERP probe'
  }

  const headers = {
    'x-tenant': tenant,
    'x-company': tenant,
  }
  if (SMOKE_AUTH_TOKEN) headers.authorization = `Bearer ${SMOKE_AUTH_TOKEN}`
  if (SMOKE_SESSION_COOKIE) headers.cookie = SMOKE_SESSION_COOKIE

  const response = await fetchWithTimeout(`${API_BASE}/api/erp-accounting/accounts?limit=1`, { headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success !== true) {
    throw new Error(`ERP read-only route returned ${response.status}: ${body.message || 'unexpected response'}`)
  }
  return `${response.status} accounts read-only probe`
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
  console.log('Production smoke report')
  console.log(`API: ${API_BASE}`)
  console.log(`Railway health: ${RAILWAY_HEALTH_URL}`)
  console.log(`Vercel hosts: ${VERCEL_HOSTS.join(', ')}`)

  const checks = []
  for (const host of VERCEL_HOSTS) {
    checks.push(check(`vercel:${host}`, () => verifyPortalHost(host)))
  }
  for (const tenant of TENANTS) {
    checks.push(check(`railway:${tenant}:health`, () => verifyRailwayHealth(tenant)))
    checks.push(check(`railway:${tenant}:auth-routing`, () => verifyTenantAuthPath(tenant)))
    checks.push(check(`railway:${tenant}:csrf-auth-shape`, () => verifyCsrfAuthShape(tenant)))
    checks.push(check(`railway:${tenant}:erp-readonly`, () => verifyTenantReadOnlyErpPath(tenant)))
  }

  const results = await Promise.all(checks)
  for (const result of results) {
    const marker = result.ok ? 'OK ' : 'FAIL'
    const detail = result.ok ? result.detail : result.error
    console.log(`${marker} ${result.name} (${result.ms}ms) ${detail}`)
  }

  const failures = results.filter((result) => !result.ok)
  if (failures.length) {
    console.error(`Production smoke failed: ${failures.length}/${results.length} checks failed.`)
    process.exit(1)
  }

  console.log(`Production smoke passed: ${results.length}/${results.length} checks OK.`)
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
