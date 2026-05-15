const https = require('https')

const API_BASE = 'https://api.loopcstrategies.com'
const TENANT = 'mg'
const USERNAME = process.env.MG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.MG_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('MG_ADMIN_PASSWORD is required.')

const EXPECTED = [
  { type: 'payment', docNo: 'Pay/2026/0001', amount: 20000, partyCode: '101001' },
  { type: 'payment', docNo: 'Pay/2026/0002', amount: 23000, partyCode: '1303' },
  { type: 'receipt', docNo: 'Rec/2026/0001', amount: 20000, partyCode: '1301' },
  { type: 'receipt', docNo: 'Rec/2026/0002', amount: 27000, partyCode: '1301' },
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

  if (loginRes.status !== 200 || !cookie) {
    throw new Error(`Login failed (${loginRes.status})`)
  }

  const [paymentRes, receiptRes] = await Promise.all([
    httpRequest('GET', '/api/erp-accounting/transactions?type=payment&limit=200', null, { Cookie: cookie }),
    httpRequest('GET', '/api/erp-accounting/transactions?type=receipt&limit=200', null, { Cookie: cookie }),
  ])

  const payments = Array.isArray(paymentRes?.data?.transactions) ? paymentRes.data.transactions : []
  const receipts = Array.isArray(receiptRes?.data?.transactions) ? receiptRes.data.transactions : []
  const all = [...payments, ...receipts]

  const voucherChecks = []

  for (const exp of EXPECTED) {
    const tx = all.find((row) => String(row?.voucherMeta?.vocNo || '') === exp.docNo && String(row.type) === exp.type)
    if (!tx) {
      voucherChecks.push({ ...exp, ok: false, reason: 'voucher_missing' })
      continue
    }

    const journalId = tx.journalEntryId ? String(tx.journalEntryId) : ''
    let sourceStatus = null
    if (journalId) {
      const sourceRes = await httpRequest('GET', `/api/erp-accounting/transactions/source-by-ledger/${journalId}`, null, { Cookie: cookie })
      sourceStatus = sourceRes.status
    }

    voucherChecks.push({
      ...exp,
      ok: String(tx.status) === 'posted' && Number(tx.amount) === exp.amount && Boolean(journalId),
      id: tx._id,
      status: tx.status,
      amount: tx.amount,
      partyCode: tx?.voucherMeta?.partyCode || '',
      journalEntryId: journalId,
      sourceByLedgerStatus: sourceStatus,
    })
  }

  const accountCodes = ['101001', '1303', '1301']
  const accountChecks = []

  for (const code of accountCodes) {
    const res = await httpRequest('GET', `/api/erp-accounting/accounts/enquiry?accountCode=${encodeURIComponent(code)}`, null, { Cookie: cookie })
    if (res.status !== 200 || !res.data?.success) {
      accountChecks.push({ accountCode: code, ok: false, status: res.status, reason: 'enquiry_failed' })
      continue
    }

    const entries = Array.isArray(res.data?.statement?.entries) ? res.data.statement.entries : []
    const matchedVouchers = entries
      .filter((entry) => EXPECTED.some((exp) => exp.docNo === entry.sourceTransactionNumber))
      .map((entry) => ({
        sourceTransactionNumber: entry.sourceTransactionNumber,
        sourceTransactionType: entry.sourceTransactionType,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        signedAmount: entry.signedAmount,
        date: entry.date,
      }))

    accountChecks.push({
      accountCode: code,
      ok: matchedVouchers.length > 0,
      netBalance: res.data?.balances?.netBalance,
      netDirection: res.data?.balances?.netDirection,
      matchedVouchers,
    })
  }

  const failures = [
    ...voucherChecks.filter((v) => !v.ok),
    ...accountChecks.filter((a) => !a.ok),
  ]

  console.log(JSON.stringify({
    tenant: TENANT,
    timestamp: new Date().toISOString(),
    feBeCommitExpected: '46c2fc7',
    vouchers: voucherChecks,
    accounts: accountChecks,
    ok: failures.length === 0,
    failureCount: failures.length,
  }, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
