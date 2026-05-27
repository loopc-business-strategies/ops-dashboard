/* eslint-disable no-console */
const TENANTS = ['mg', 'cg', 'loopc']

const BASE_DOMAIN = process.env.SMOKE_BASE_DOMAIN || 'loopcstrategies.com'
const API_BASE = process.env.SMOKE_API_BASE || `https://api.${BASE_DOMAIN}`

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

async function verifyPortal(tenant) {
  const url = `https://${tenant}.${BASE_DOMAIN}/login`
  const response = await fetchWithTimeout(url)
  const body = await response.text()

  if (!response.ok) {
    throw new Error(`${tenant.toUpperCase()} portal responded with ${response.status}`)
  }

  const hasShellMarkup = /<title>\s*Ops Dashboard\s*<\/title>/i.test(body) || /id="root"/i.test(body)
  if (!hasShellMarkup) {
    throw new Error(`${tenant.toUpperCase()} portal did not return expected app shell markup`)
  }

  return { tenant, status: response.status, url }
}

async function verifyReadiness(tenant) {
  const response = await fetchWithTimeout(`${API_BASE}/api/ready`, {
    headers: {
      'x-tenant': tenant,
      'x-company': tenant,
    },
  })
  const body = await response.json().catch(() => ({}))

  if (!response.ok || body.ready !== true) {
    throw new Error(`${tenant.toUpperCase()} readiness check failed (${response.status})`)
  }

  return {
    tenant,
    status: response.status,
    buildSha: String(body?.build?.sha || body?.backend?.sha || '').slice(0, 7) || 'unknown',
  }
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
    throw new Error(`${tenant.toUpperCase()} auth path check returned ${response.status}: ${body.message || 'unexpected response'}`)
  }

  return { tenant, status: response.status }
}

async function run() {
  console.log('Running tenant smoke checks...')
  console.log(`Domain: ${BASE_DOMAIN}`)
  console.log(`API: ${API_BASE}`)

  for (const tenant of TENANTS) {
    const portal = await verifyPortal(tenant)
    console.log(`✔ ${tenant.toUpperCase()} portal OK (${portal.status})`)

    const readiness = await verifyReadiness(tenant)
    console.log(`✔ ${tenant.toUpperCase()} ready (${readiness.status}) build=${readiness.buildSha}`)

    const authPath = await verifyTenantAuthPath(tenant)
    console.log(`✔ ${tenant.toUpperCase()} auth routing OK (${authPath.status})`)
  }

  console.log('Tenant smoke checks passed.')
}

run().catch((err) => {
  console.error('Tenant smoke checks failed:')
  console.error(err.message || err)
  process.exit(1)
})