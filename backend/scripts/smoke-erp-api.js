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

function erpHeaders(sessionCookie) {
  return {
    Cookie: sessionCookie,
    'x-tenant': LOGIN_COMPANY,
    'x-company': LOGIN_COMPANY,
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

async function expectOkJson(url, sessionCookie, label) {
  const response = await fetch(url, {
    method: 'GET',
    headers: erpHeaders(sessionCookie),
  })
  const data = await safeJson(response)
  if (!response.ok) {
    const message = data?.message || `HTTP ${response.status}`
    throw new Error(`${label} failed: ${message}`)
  }
  return data
}

/** Same GETs the MG mobile ERP Reports tab uses (see mobile/src/api/erpReports.ts). */
async function smokeMobileErpReportEndpoints(sessionCookie) {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 3)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const trialQs = new URLSearchParams({
    startDate,
    endDate,
    includeZero: 'false',
    sortBy: 'accountCode',
    sortDir: 'asc',
  })
  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/trial-balance?${trialQs.toString()}`,
    sessionCookie,
    'Report trial-balance',
  )

  const plQs = new URLSearchParams({
    startDate,
    endDate,
    includeZero: 'false',
    comparePrevious: 'true',
  })
  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/profit-loss?${plQs.toString()}`,
    sessionCookie,
    'Report profit-loss',
  )

  const bsQs = new URLSearchParams({ endDate })
  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/balance-sheet?${bsQs.toString()}`,
    sessionCookie,
    'Report balance-sheet',
  )

  const dayQs = new URLSearchParams({ startDate, endDate })
  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/day-book?${dayQs.toString()}`,
    sessionCookie,
    'Report day-book',
  )

  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/customer-outstanding`,
    sessionCookie,
    'Report customer-outstanding',
  )
  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/vendor-outstanding`,
    sessionCookie,
    'Report vendor-outstanding',
  )

  const forexQs = new URLSearchParams({ startDate, endDate })
  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/forex-gain-loss?${forexQs.toString()}`,
    sessionCookie,
    'Report forex-gain-loss',
  )

  const accountsData = await expectOkJson(
    `${BASE_URL}/api/erp-accounting/accounts?page=1&limit=5`,
    sessionCookie,
    'Accounts list (ledger picker)',
  )
  const firstId = accountsData?.accounts?.[0]?._id
  if (!firstId) {
    console.warn('Step: report ledger — SKIP (no accounts in tenant)')
    return
  }
  const ledgerQs = new URLSearchParams({ accountId: String(firstId), startDate, endDate })
  await expectOkJson(
    `${BASE_URL}/api/erp-accounting/reports/ledger?${ledgerQs.toString()}`,
    sessionCookie,
    'Report ledger',
  )
}

async function fetchLedger(sessionCookie) {
  const params = new URLSearchParams({
    department: FILTER_DEPARTMENT,
    referenceType: FILTER_REFERENCE_TYPE,
    limit: String(FILTER_LIMIT),
  })

  return expectOkJson(`${BASE_URL}/api/erp-accounting/ledger?${params.toString()}`, sessionCookie, 'Ledger')
}

function uniqueValues(entries, key) {
  return [...new Set(entries.map((entry) => entry?.[key]).filter(Boolean))]
}

async function run() {
  console.log(`ERP smoke test -> ${BASE_URL}`)
  console.log(`Login tenant/user: ${LOGIN_COMPANY}/${LOGIN_NAME}`)
  console.log(`Ledger filter: department=${FILTER_DEPARTMENT}, referenceType=${FILTER_REFERENCE_TYPE}, limit=${FILTER_LIMIT}`)
  console.log(
    'Optional env overrides: SMOKE_API_BASE_URL, SMOKE_LOGIN_COMPANY (use mg for MG tenant), SMOKE_LOGIN_NAME, SMOKE_LOGIN_PASSWORD, SMOKE_DEFAULT_NAME, SMOKE_DEFAULT_PASSWORD, SMOKE_LEDGER_DEPARTMENT, SMOKE_LEDGER_REFERENCE_TYPE, SMOKE_LEDGER_LIMIT',
  )

  const sessionCookie = await login()
  console.log('Step: session / login — OK')

  await expectOkJson(`${BASE_URL}/api/erp-accounting/accounts?limit=5&page=1`, sessionCookie, 'Accounts list')
  console.log('Step: accounts list — OK')

  const ledger = await fetchLedger(sessionCookie)
  const entries = Array.isArray(ledger.entries) ? ledger.entries : []
  console.log('Step: ledger list — OK')

  await expectOkJson(`${BASE_URL}/api/erp-accounting/transactions?limit=5&page=1`, sessionCookie, 'Transactions list')
  console.log('Step: transactions list — OK')

  await expectOkJson(`${BASE_URL}/api/erp-accounting/reports/dashboard`, sessionCookie, 'Dashboard report')
  console.log('Step: dashboard report — OK')

  await smokeMobileErpReportEndpoints(sessionCookie)
  console.log('Step: mobile ERP Reports tab API surface — OK')

  await expectOkJson(`${BASE_URL}/api/erp-accounting/currencies/metal-rates`, sessionCookie, 'Metal rates')
  console.log('Step: metal rates — OK')

  const departments = uniqueValues(entries, 'department')
  const referenceTypes = uniqueValues(entries, 'referenceType')

  console.log('Result: SUCCESS')
  console.log(`Ledger entries (filtered): ${entries.length}`)
  console.log(`Unique departments: ${departments.join(', ') || '(none)'}`)
  console.log(`Unique reference types: ${referenceTypes.join(', ') || '(none)'}`)
}

run().catch((error) => {
  console.error(`Result: FAILED -> ${error.message}`)
  process.exit(1)
})
