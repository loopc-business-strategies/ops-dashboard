const https = require('https')

const API_BASE = 'https://api.loopcstrategies.com'
const TENANT = 'mg'
const USERNAME = process.env.MG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.MG_ADMIN_PASSWORD || '123456'

const JOURNAL_IDS = [
  '69ff73362a2306793c3ff91b',
  '69ff73412a2306793c3ff9c9',
  '69ff734c2a2306793c3ffa6f',
  '69ff73582a2306793c3ffb1c',
]

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

  const cookie = extractCookie(loginRes.headers['set-cookie'])
  if (loginRes.status !== 200 || !cookie) throw new Error(`Login failed (${loginRes.status})`)

  const rows = []
  for (const ledgerId of JOURNAL_IDS) {
    const res = await httpRequest('GET', `/api/erp-accounting/transactions/source-by-ledger/${ledgerId}`, null, { Cookie: cookie })
    if (res.status !== 200 || !res.data?.success) {
      rows.push({ ledgerId, ok: false, status: res.status, response: res.data })
      continue
    }

    const tx = res.data.sourceTransaction || {}
    const le = res.data.ledgerEntry || {}

    rows.push({
      ledgerId,
      ok: true,
      txId: tx.id,
      txNumber: tx.number,
      txType: tx.transactionType,
      amount: le.amount,
      debitAccountCode: le?.debitAccount?.accountCode || '',
      debitAccountName: le?.debitAccount?.accountName || '',
      creditAccountCode: le?.creditAccount?.accountCode || '',
      creditAccountName: le?.creditAccount?.accountName || '',
      referenceType: le.referenceType,
      notes: le.notes || '',
    })
  }

  console.log(JSON.stringify({ tenant: TENANT, rows }, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
