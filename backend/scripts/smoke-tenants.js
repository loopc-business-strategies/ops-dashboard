// Tenant smoke test — runs login + 7 module checks for MG, CG, and LoopC
require('dotenv').config()

const BASE = process.env.SMOKE_API_BASE_URL || 'http://localhost:5000'
const DEFAULT_NAME = process.env.SMOKE_DEFAULT_NAME || 'Nan'
const DEFAULT_PASSWORD = process.env.SMOKE_DEFAULT_PASSWORD

const TENANTS = [
  {
    company: 'mg',
    name: process.env.SMOKE_MG_NAME || DEFAULT_NAME,
    password: process.env.SMOKE_MG_PASSWORD || DEFAULT_PASSWORD,
  },
  {
    company: 'cg',
    name: process.env.SMOKE_CG_NAME || DEFAULT_NAME,
    password: process.env.SMOKE_CG_PASSWORD || DEFAULT_PASSWORD,
  },
  {
    company: 'loopc',
    name: process.env.SMOKE_LOOPC_NAME || DEFAULT_NAME,
    password: process.env.SMOKE_LOOPC_PASSWORD || DEFAULT_PASSWORD,
  },
]

for (const tenant of TENANTS) {
  if (!tenant.password) {
    throw new Error(`Missing smoke password for ${tenant.company}. Set SMOKE_${tenant.company.toUpperCase()}_PASSWORD or SMOKE_DEFAULT_PASSWORD.`)
  }
}

const ENDPOINTS = [
  '/api/auth/me',
  '/api/hr/employees',
  '/api/tasks',
  '/api/attendance/summary',
  '/api/messages/latest?type=all&limit=5',
  '/api/crm/dashboard',
  '/api/erp/inventory',
  '/api/erp-accounting/reports/dashboard?startDate=2026-04-01&endDate=2026-04-30',
]

async function runSmoke () {
  const results = {}

  for (const tenant of TENANTS) {
    results[tenant.company] = {}

    // Login
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant),
    })
    const setCookie = loginRes.headers.get('set-cookie') || ''
    const sessionCookie = setCookie.split(',').find((value) => value.includes('sessionToken=')) || ''
    const loginBody = await loginRes.json()

    results[tenant.company].login = {
      status: loginRes.status,
      role: loginBody?.user?.role,
      company: loginBody?.user?.company,
    }

    if (!sessionCookie) {
      results[tenant.company].error = 'no-session-token'
      continue
    }

    // Module endpoints
    for (const path of ENDPOINTS) {
      const res = await fetch(`${BASE}${path}`, {
        headers: {
          Cookie: sessionCookie,
          'x-tenant': tenant.company,
          'x-company': tenant.company,
        },
      })
      const body = await res.text()
      let preview = body.slice(0, 160)
      try { preview = JSON.stringify(JSON.parse(body), null, 0).slice(0, 160) } catch {}
      results[tenant.company][path] = { status: res.status, preview }
    }
  }

  // Print results
  console.log(`\nSMOKE TARGET: ${BASE}`)
  console.log('Credential env overrides: SMOKE_DEFAULT_NAME, SMOKE_DEFAULT_PASSWORD, SMOKE_MG_NAME, SMOKE_MG_PASSWORD, SMOKE_CG_NAME, SMOKE_CG_PASSWORD, SMOKE_LOOPC_NAME, SMOKE_LOOPC_PASSWORD')
  for (const [company, data] of Object.entries(results)) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`TENANT: ${company.toUpperCase()}`)
    console.log('='.repeat(60))
    for (const [key, val] of Object.entries(data)) {
      const ok = val.status === 200 ? '✅' : '❌'
      if (key === 'login') {
        console.log(`${ok} LOGIN  status=${val.status}  role=${val.role}  company=${val.company}`)
      } else {
        console.log(`${ok} ${val.status}  ${key}`)
        if (val.status !== 200) console.log(`     ${val.preview}`)
      }
    }
  }

  process.exit(0)
}

runSmoke().catch(err => { console.error(err); process.exit(1) })
