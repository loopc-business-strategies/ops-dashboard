require('dotenv').config()

const BASE_URL = process.env.SMOKE_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5000'
const LOGIN_COMPANY = process.env.SMOKE_LOGIN_COMPANY || process.env.DEFAULT_TENANT || 'loopc'
const LOGIN_NAME = process.env.SMOKE_LOGIN_NAME || process.env.SMOKE_DEFAULT_NAME || 'Nan'
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || process.env.SMOKE_DEFAULT_PASSWORD
const FILTER_DEPARTMENT = process.env.SMOKE_LEDGER_DEPARTMENT || 'sales'
const FILTER_REFERENCE_TYPE = process.env.SMOKE_LEDGER_REFERENCE_TYPE || 'invoice'
const FILTER_LIMIT = Number(process.env.SMOKE_LEDGER_LIMIT || 5)

if (!LOGIN_PASSWORD) {
  throw new Error('SMOKE_LOGIN_PASSWORD or SMOKE_DEFAULT_PASSWORD is required.')
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company: LOGIN_COMPANY, name: LOGIN_NAME, password: LOGIN_PASSWORD }),
  })

  const data = await safeJson(response)
  const setCookie = response.headers.get('set-cookie') || ''
  const sessionCookie = setCookie.split(',').find((value) => value.includes('sessionToken=')) || ''

  if (!response.ok || !sessionCookie) {
    const message = data?.message || `HTTP ${response.status}`
    throw new Error(`Login failed: ${message}`)
  }

  return sessionCookie
}

async function fetchLedger(sessionCookie) {
  const params = new URLSearchParams({
    department: FILTER_DEPARTMENT,
    referenceType: FILTER_REFERENCE_TYPE,
    limit: String(FILTER_LIMIT),
  })

  const response = await fetch(`${BASE_URL}/api/erp-accounting/ledger?${params.toString()}`, {
    method: 'GET',
    headers: {
      Cookie: sessionCookie,
      'x-tenant': LOGIN_COMPANY,
      'x-company': LOGIN_COMPANY,
    },
  })

  const data = await safeJson(response)
  if (!response.ok) {
    const message = data?.message || `HTTP ${response.status}`
    throw new Error(`Ledger request failed: ${message}`)
  }

  return data
}

function uniqueValues(entries, key) {
  return [...new Set(entries.map((entry) => entry?.[key]).filter(Boolean))]
}

async function run() {
  console.log(`ERP smoke test -> ${BASE_URL}`)
  console.log(`Login tenant/user: ${LOGIN_COMPANY}/${LOGIN_NAME}`)
  console.log(`Ledger filter: department=${FILTER_DEPARTMENT}, referenceType=${FILTER_REFERENCE_TYPE}, limit=${FILTER_LIMIT}`)
  console.log('Optional env overrides: SMOKE_API_BASE_URL, SMOKE_LOGIN_COMPANY, SMOKE_LOGIN_NAME, SMOKE_LOGIN_PASSWORD, SMOKE_DEFAULT_NAME, SMOKE_DEFAULT_PASSWORD, SMOKE_LEDGER_DEPARTMENT, SMOKE_LEDGER_REFERENCE_TYPE, SMOKE_LEDGER_LIMIT')

  const sessionCookie = await login()
  const ledger = await fetchLedger(sessionCookie)
  const entries = Array.isArray(ledger.entries) ? ledger.entries : []

  const departments = uniqueValues(entries, 'department')
  const referenceTypes = uniqueValues(entries, 'referenceType')

  console.log('Result: SUCCESS')
  console.log(`Entries: ${entries.length}`)
  console.log(`Unique departments: ${departments.join(', ') || '(none)'}`)
  console.log(`Unique reference types: ${referenceTypes.join(', ') || '(none)'}`)
}

run().catch((error) => {
  console.error(`Result: FAILED -> ${error.message}`)
  process.exit(1)
})
