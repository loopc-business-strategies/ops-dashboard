/**
 * Live-API MG cleanup for Production Dashboard leftover WIP.
 * Dry-run default. After cancel endpoints are deployed:
 *   MG_ADMIN_PASSWORD=... node scripts/destructive/clear-mg-pd-wip-leftovers-live-api.js --apply
 */
const https = require('https')
const { ACTIVE_BATCH_STATUSES } = require('../../services/productionControl/constants')

const API_BASE = String(process.env.SMOKE_API_BASE_URL || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANT = 'mg'
const USERNAME = process.env.MG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.MG_ADMIN_PASSWORD
const APPLY = process.argv.includes('--apply')
const REASON = 'Clear leftover PD WIP batches and under-processing stock'

const WIP_STOCK_STATUSES = [
  'UNDER_PROCESSING',
  'DEPARTMENT_PROCESSING',
  'ALLOCATED',
  'QC_PENDING',
  'PACKAGING',
  'REWORK',
  'HOLD',
  'SELECTED',
]

if (!PASSWORD) {
  console.error('MG_ADMIN_PASSWORD is required.')
  process.exit(1)
}

function httpRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path)
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT,
        ...headers,
      },
    }
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data)
    const req = https.request(options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => { responseData += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData), headers: res.headers })
        } catch {
          resolve({ status: res.statusCode, data: responseData, headers: res.headers })
        }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function extractCookie(setCookies) {
  if (!Array.isArray(setCookies)) return ''
  return setCookies.map((cookie) => String(cookie).split(';')[0]).join('; ')
}

async function main() {
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    name: USERNAME,
    password: PASSWORD,
    company: TENANT,
  })
  const cookieHeader = extractCookie(loginRes.headers['set-cookie'])
  if (loginRes.status !== 200 || !cookieHeader) {
    console.log(JSON.stringify({
      ok: false,
      step: 'login',
      status: loginRes.status,
      response: loginRes.data,
    }, null, 2))
    process.exit(1)
  }

  const auth = { Cookie: cookieHeader }
  const [floorRes, batchesRes, stockOverviewRes, stockListRes] = await Promise.all([
    httpRequest('GET', '/api/erp/production-control/live-floor', null, auth),
    httpRequest('GET', '/api/erp/production-control/batches?limit=100&includeCount=1', null, auth),
    httpRequest('GET', '/api/erp/production-control/stock/overview', null, auth),
    httpRequest(
      'GET',
      `/api/erp/production-control/stock?limit=200&status=${WIP_STOCK_STATUSES.join(',')}`,
      null,
      auth,
    ),
  ])

  const allBatches = Array.isArray(batchesRes?.data?.batches)
    ? batchesRes.data.batches
    : (Array.isArray(batchesRes?.data?.data) ? batchesRes.data.data : [])
  const openBatches = allBatches.filter((b) => ACTIVE_BATCH_STATUSES.includes(b.status))
  const wipLots = Array.isArray(stockListRes?.data?.lots) ? stockListRes.data.lots : []
  const overview = stockOverviewRes?.data?.overview || stockOverviewRes?.data || {}
  const underProcessingWeight = Number(overview?.underProcessing?.weight ?? overview?.underProcessing ?? 0)
  const metalInProduction = Number(floorRes?.data?.kpis?.metalInProduction ?? 0)

  const preview = {
    ok: true,
    tenant: TENANT,
    apiBase: API_BASE,
    dryRun: !APPLY,
    totals: {
      openBatches: openBatches.length,
      metalInProduction,
      wipLots: wipLots.length,
      underProcessingWeight,
    },
    openBatches: openBatches.map((b) => ({
      id: b._id,
      batchNumber: b.batchNumber,
      status: b.status,
      currentWeight: b.currentWeight,
      currentDepartment: b.currentDepartment,
    })),
    wipLots: wipLots.map((l) => ({
      id: l._id,
      stockCode: l.stockCode,
      status: l.status,
      netWeight: l.netWeight,
    })),
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      ...preview,
      message: 'Dry run. Re-run with --apply after cancel endpoints are live to soft-cancel these rows.',
    }, null, 2))
    return
  }

  const batchResults = []
  for (const batch of openBatches) {
    const res = await httpRequest('POST', `/api/erp/production-control/batches/${batch._id}/cancel`, {
      reason: REASON,
      expectedVersion: batch.version,
    }, auth)
    batchResults.push({
      id: batch._id,
      batchNumber: batch.batchNumber,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      response: res.data?.message || res.data?.batch?.status || res.data,
    })
  }

  const lotResults = []
  for (const lot of wipLots) {
    const res = await httpRequest('POST', `/api/erp/production-control/stock/${lot._id}/cancel`, {
      reason: REASON,
      expectedVersion: lot.version,
    }, auth)
    lotResults.push({
      id: lot._id,
      stockCode: lot.stockCode,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      response: res.data?.message || res.data?.lot?.status || res.data,
    })
  }

  const [floorAfter, overviewAfter] = await Promise.all([
    httpRequest('GET', '/api/erp/production-control/live-floor', null, auth),
    httpRequest('GET', '/api/erp/production-control/stock/overview', null, auth),
  ])
  const overview2 = overviewAfter?.data?.overview || overviewAfter?.data || {}

  console.log(JSON.stringify({
    ...preview,
    dryRun: false,
    executed: { batchResults, lotResults },
    after: {
      metalInProduction: Number(floorAfter?.data?.kpis?.metalInProduction ?? 0),
      activeBatches: Number(floorAfter?.data?.kpis?.activeBatches ?? 0),
      underProcessingWeight: Number(overview2?.underProcessing?.weight ?? 0),
    },
  }, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
