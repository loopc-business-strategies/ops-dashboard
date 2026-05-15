require('./_destructive-guard')({ scriptName: __filename })
const https = require('https')

const API_BASE = 'https://api.loopcstrategies.com'
const TENANT = 'mg'
const USERNAME = process.env.MG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.MG_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('MG_ADMIN_PASSWORD is required.')
const APPLY = process.argv.includes('--apply')
const TYPES = ['payment', 'receipt', 'purchase', 'sale']
const LEGACY_DOC_NO_RX = /^\d+$/

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
      message: 'Failed to login to live API',
    }, null, 2))
    process.exit(1)
  }

  const allLegacy = []
  const scanByType = {}

  for (const type of TYPES) {
    const listRes = await httpRequest('GET', `/api/erp-accounting/transactions?type=${type}&limit=500`, null, {
      Cookie: cookieHeader,
    })

    const items = Array.isArray(listRes?.data?.transactions) ? listRes.data.transactions : []
    const legacy = items
      .filter((tx) => LEGACY_DOC_NO_RX.test(String(tx?.voucherMeta?.vocNo || '').trim()))
      .map((tx) => ({
        id: tx._id,
        type: String(tx.type || type),
        status: String(tx.status || ''),
        docNo: String(tx?.voucherMeta?.vocNo || ''),
      }))

    scanByType[type] = {
      httpStatus: listRes.status,
      totalFetched: items.length,
      legacyCount: legacy.length,
      sample: legacy.slice(0, 10),
    }

    allLegacy.push(...legacy)
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    tenant: TENANT,
    dryRun: !APPLY,
    scanByType,
    totalLegacyFound: allLegacy.length,
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      ...summary,
      message: 'Dry run complete. Re-run with --apply to void (soft-delete) legacy numeric Doc No vouchers.',
    }, null, 2))
    return
  }

  let success = 0
  let failed = 0
  const failures = []

  for (const tx of allLegacy) {
    const voidRes = await httpRequest('POST', `/api/erp-accounting/transactions/${tx.id}/void`, {
      reason: 'Legacy numeric Doc No cleanup (API scripted)',
    }, {
      Cookie: cookieHeader,
    })

    if (voidRes.status >= 200 && voidRes.status < 300) {
      success += 1
    } else {
      failed += 1
      failures.push({ id: tx.id, docNo: tx.docNo, type: tx.type, status: voidRes.status, response: voidRes.data })
    }
  }

  console.log(JSON.stringify({
    ...summary,
    dryRun: false,
    executed: {
      attempted: allLegacy.length,
      voided: success,
      failed,
      failures: failures.slice(0, 20),
    },
  }, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
