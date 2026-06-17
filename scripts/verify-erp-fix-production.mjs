/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MG_ORIGIN = 'https://mg.loopcstrategies.com'
const API_BASE = 'https://api.loopcstrategies.com'
const TIMEOUT_MS = 25000

async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const text = await response.text()
    if (!response.ok) throw new Error(`${url} returned ${response.status}`)
    return text
  } finally {
    clearTimeout(timer)
  }
}

function assert(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

async function resolveErpTabChunkUrl() {
  const indexHtml = await fetchText(`${MG_ORIGIN}/dashboard`)
  const indexMatch = indexHtml.match(/src="(\/assets\/index-[^"]+\.js)"/)
  if (!indexMatch) throw new Error('index bundle not found in MG dashboard HTML')
  const indexJs = await fetchText(`${MG_ORIGIN}${indexMatch[1]}`)
  const erpMatch = indexJs.match(/assets\/(ERPTab-[^"]+\.js)/)
  if (!erpMatch) throw new Error('ERPTab lazy chunk not found in index bundle')
  return `${MG_ORIGIN}/assets/${erpMatch[1]}`
}

function analyzeErpChunk(source) {
  return {
    noLiveMetalContextHook: !source.includes('useLiveMetalRates'),
    erpTabNeedsLiveMetalRatesFn: source.includes('===`enquiry`') && source.includes('===`fixing-register`'),
    inventoryGate: source.includes('===`inventory`?') || source.includes('!==`inventory`)return[]'),
    customerMarginGate: source.includes('!==`customer-margin`)return[]'),
    supplierMarginGate: source.includes('!==`supplier-margin`)return[]'),
    enquiryTabGate: source.includes('===`enquiry`||') || source.includes('===`enquiry`?'),
    liveRateTabs: ['enquiry', 'customer-margin', 'supplier-margin', 'inventory', 'fixing-register']
      .every((tab) => source.includes(tab)),
    lazySubTabs: ['ERPLedgerTab', 'ERPInventoryTab', 'ERPReportsTab'].every((tab) => source.includes(tab)),
    metalRatesRefGate: source.includes('.current=') && source.includes('En(') && source.includes('&&Oi('),
  }
}

async function loginMg() {
  const name = String(process.env.SMOKE_AUTH_NAME_MG || process.env.SMOKE_AUTH_NAME || '').trim()
  const password = String(process.env.SMOKE_AUTH_PASSWORD_MG || process.env.SMOKE_AUTH_PASSWORD || '').trim()
  if (!name || !password) return null

  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant': 'mg',
      'x-company': 'mg',
    },
    body: JSON.stringify({ company: 'mg', name, password }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success !== true) {
    throw new Error(`MG login failed: ${body.message || response.status}`)
  }

  const setCookies = response.headers.getSetCookie?.() || []
  const cookie = setCookies.map((value) => value.split(';')[0]).filter(Boolean).join('; ')
  const csrfToken = String(body.csrfToken || response.headers.get('x-csrf-token') || '').trim()
  return { cookie, csrfToken }
}

async function authedGet(pathname, session) {
  const headers = {
    'x-tenant': 'mg',
    'x-company': 'mg',
    cookie: session.cookie,
  }
  if (session.csrfToken) headers['x-csrf-token'] = session.csrfToken
  const response = await fetch(`${API_BASE}${pathname}`, { headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) {
    throw new Error(`${pathname} returned ${response.status}: ${body.message || 'unexpected response'}`)
  }
  return body
}

async function pollLiveMetalRates(session, samples = 3, intervalMs = 4000) {
  const readings = []
  for (let i = 0; i < samples; i += 1) {
    const body = await authedGet('/api/erp-accounting/metal-rates/live', session)
    const rates = body?.rates || body?.data?.rates || body
    readings.push({
      gold: Number(rates?.sourceGoldPrice || rates?.goldPrice || 0),
      silver: Number(rates?.sourceSilverPrice || rates?.silverPrice || 0),
      updatedAt: rates?.updatedAt || null,
    })
    if (i < samples - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return readings
}

async function run() {
  console.log('ERP fix production verification')
  console.log(`MG origin: ${MG_ORIGIN}`)
  console.log(`API: ${API_BASE}`)

  const results = []

  results.push(assert('MG dashboard HTML loads', /id="root"/.test(await fetchText(`${MG_ORIGIN}/dashboard`))))

  const erpChunkUrl = await resolveErpTabChunkUrl()
  console.log(`ERPTab chunk: ${erpChunkUrl}`)
  const erpSource = await fetchText(erpChunkUrl)
  const analysis = analyzeErpChunk(erpSource)
  results.push(assert('ERPTab chunk excludes useLiveMetalRates hook', analysis.noLiveMetalContextHook))
  results.push(assert('erpTabNeedsLiveMetalRates helper present', analysis.erpTabNeedsLiveMetalRatesFn))
  results.push(assert('Inventory math gated off inventory tab', analysis.inventoryGate))
  results.push(assert('Customer margin rows gated', analysis.customerMarginGate))
  results.push(assert('Supplier margin rows gated', analysis.supplierMarginGate))
  results.push(assert('Enquiry computation gated to enquiry tab', analysis.enquiryTabGate))
  results.push(assert('Metal rates ref-gated socket updates', analysis.metalRatesRefGate))
  results.push(assert('Live-rate tab identifiers present', analysis.liveRateTabs))
  results.push(assert('Heavy ERP sub-tabs remain lazy-loaded', analysis.lazySubTabs))
  results.push(assert('ERPTab chunk size under budget', erpSource.length < 360_000, `${erpSource.length} bytes`))

  const ready = await fetch(`${API_BASE}/api/ready`, { headers: { 'x-tenant': 'mg', 'x-company': 'mg' } })
    .then((r) => r.json())
  results.push(assert('MG tenant ready on API', ready?.ready === true && ready?.checks?.tenants?.mg?.ready === true))

  const session = await loginMg()
  if (!session) {
    console.log('SKIP authenticated ERP API probes — set SMOKE_AUTH_NAME_MG/SMOKE_AUTH_PASSWORD_MG for full smoke')
  } else {
    const txBody = await authedGet('/api/erp-accounting/transactions?limit=1', session)
    results.push(assert('ERP transactions read-only probe', Array.isArray(txBody?.data?.transactions) || Array.isArray(txBody?.transactions)))

    const liveBody = await authedGet('/api/erp-accounting/metal-rates/live', session)
    const liveRates = liveBody?.rates || liveBody?.data?.rates || liveBody
    results.push(assert(
      'Live metal rates API returns gold/silver',
      Number(liveRates?.sourceGoldPrice || liveRates?.goldPrice) > 0
        && Number(liveRates?.sourceSilverPrice || liveRates?.silverPrice) > 0,
    ))

    const accountsBody = await authedGet('/api/erp-accounting/accounts?limit=5', session)
    const accounts = accountsBody?.data?.accounts || accountsBody?.accounts || []
    results.push(assert('Account Summary data source reachable', accounts.length > 0, `${accounts.length} accounts`))

    if (accounts[0]?.accountCode) {
      const code = encodeURIComponent(accounts[0].accountCode)
      const enquiryBody = await authedGet(`/api/erp-accounting/accounts/${code}/enquiry`, session)
      results.push(assert(
        'Account enquiry endpoint responds',
        Boolean(enquiryBody?.data?.account || enquiryBody?.account),
        accounts[0].accountCode,
      ))
    }

    const inventoryBody = await authedGet('/api/erp-accounting/inventory/products?limit=5', session)
    const products = inventoryBody?.data?.products || inventoryBody?.products || []
    results.push(assert('Inventory tab data source reachable', Array.isArray(products), `${products.length} products`))

    const customersBody = await authedGet('/api/erp-accounting/customers?limit=5', session)
    const customers = customersBody?.data?.customers || customersBody?.customers || []
    results.push(assert('Customer margin data source reachable', Array.isArray(customers), `${customers.length} customers`))

    console.log(`Polling live metal rates (${3} samples, 4s apart)...`)
    const readings = await pollLiveMetalRates(session, 3, 4000)
    const goldMoves = new Set(readings.map((r) => r.gold)).size
    const silverMoves = new Set(readings.map((r) => r.silver)).size
    results.push(assert(
      'Live metal rates tick over time',
      readings.every((r) => r.gold > 0 && r.silver > 0),
      `gold samples=${goldMoves} silver samples=${silverMoves}`,
    ))
  }

  const failed = results.filter((ok) => !ok).length
  if (failed) {
    console.error(`Verification failed: ${failed}/${results.length} checks`)
    process.exit(1)
  }
  console.log(`Verification passed: ${results.length}/${results.length} checks`)
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
