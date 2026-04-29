// Tenant smoke test — runs login + 7 module checks for MG, CG, and LoopC
require('dotenv').config()

const TENANTS = [
  { company: 'mg',    name: 'mgadmin',    password: 'MgAdmin@2026!'    },
  { company: 'cg',    name: 'cgadmin',    password: 'CgAdmin@2026!'    },
  { company: 'loopc', name: 'loopcadmin', password: 'LoopcAdmin@2026!' },
]

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

const BASE = 'http://localhost:5000'

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
    const tokenMatch = setCookie.match(/sessionToken=([^;]+)/)
    const token = tokenMatch && tokenMatch[1]
    const loginBody = await loginRes.json()

    results[tenant.company].login = {
      status: loginRes.status,
      role: loginBody?.user?.role,
      company: loginBody?.user?.company,
    }

    if (!token) {
      results[tenant.company].error = 'no-session-token'
      continue
    }

    // Module endpoints
    for (const path of ENDPOINTS) {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.text()
      let preview = body.slice(0, 160)
      try { preview = JSON.stringify(JSON.parse(body), null, 0).slice(0, 160) } catch {}
      results[tenant.company][path] = { status: res.status, preview }
    }
  }

  // Print results
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
