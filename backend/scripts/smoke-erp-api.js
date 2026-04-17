require('dotenv').config()

const BASE_URL = process.env.SMOKE_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5000'
const LOGIN_NAME = process.env.SMOKE_LOGIN_NAME || 'AdminUser'
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || 'admin123'
const FILTER_DEPARTMENT = process.env.SMOKE_LEDGER_DEPARTMENT || 'sales'
const FILTER_REFERENCE_TYPE = process.env.SMOKE_LEDGER_REFERENCE_TYPE || 'invoice'
const FILTER_LIMIT = Number(process.env.SMOKE_LEDGER_LIMIT || 5)

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
    body: JSON.stringify({ name: LOGIN_NAME, password: LOGIN_PASSWORD }),
  })

  const data = await safeJson(response)
  if (!response.ok || !data?.token) {
    const message = data?.message || `HTTP ${response.status}`
    throw new Error(`Login failed: ${message}`)
  }

  return data.token
}

async function fetchLedger(token) {
  const params = new URLSearchParams({
    department: FILTER_DEPARTMENT,
    referenceType: FILTER_REFERENCE_TYPE,
    limit: String(FILTER_LIMIT),
  })

  const response = await fetch(`${BASE_URL}/api/erp-accounting/ledger?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
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
  console.log(`Login user: ${LOGIN_NAME}`)
  console.log(`Ledger filter: department=${FILTER_DEPARTMENT}, referenceType=${FILTER_REFERENCE_TYPE}, limit=${FILTER_LIMIT}`)
  console.log('Optional env overrides: SMOKE_API_BASE_URL, SMOKE_LOGIN_NAME, SMOKE_LOGIN_PASSWORD, SMOKE_LEDGER_DEPARTMENT, SMOKE_LEDGER_REFERENCE_TYPE, SMOKE_LEDGER_LIMIT')

  const token = await login()
  const ledger = await fetchLedger(token)
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
