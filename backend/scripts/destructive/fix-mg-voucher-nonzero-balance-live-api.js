require('./_destructive-guard')({ scriptName: __filename })
const https = require('https')

const API_BASE = 'https://api.loopcstrategies.com'
const TENANT = 'mg'
const USERNAME = process.env.MG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.MG_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('MG_ADMIN_PASSWORD is required.')

const TARGET_DOCS = [
  'Pay/2026/0001',
  'Pay/2026/0002',
  'Rec/2026/0001',
  'Rec/2026/0002',
]
const OFFSET_AC_CODE = '1010'

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

function buildUpdatePayload(tx) {
  const meta = tx.voucherMeta || {}
  const lines = Array.isArray(meta.lineItems) ? meta.lineItems : []
  const nextLines = lines.map((line) => ({
    ...line,
    acCode: OFFSET_AC_CODE,
  }))

  return {
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    description: tx.description,
    currency: tx.currency,
    exchangeRate: tx.exchangeRate,
    customerId: tx.customerId?._id || tx.customerId || null,
    vendorId: tx.vendorId?._id || tx.vendorId || null,
    inventoryItemId: tx.inventoryItemId?._id || tx.inventoryItemId || null,
    mappingId: tx.mappingId?._id || tx.mappingId || null,
    debitAccountId: tx.debitAccountId?._id || tx.debitAccountId || null,
    creditAccountId: tx.creditAccountId?._id || tx.creditAccountId || null,
    voucherMeta: {
      ...meta,
      lineItems: nextLines,
    },
  }
}

async function transition(cookie, id, action) {
  return httpRequest('POST', `/api/erp-accounting/transactions/${id}/${action}`, { comment: `non-zero balance fix ${action}` }, { Cookie: cookie })
}

async function getByDocs(cookie) {
  const [pRes, rRes] = await Promise.all([
    httpRequest('GET', '/api/erp-accounting/transactions?type=payment&limit=200', null, { Cookie: cookie }),
    httpRequest('GET', '/api/erp-accounting/transactions?type=receipt&limit=200', null, { Cookie: cookie }),
  ])
  const all = [
    ...(Array.isArray(pRes?.data?.transactions) ? pRes.data.transactions : []),
    ...(Array.isArray(rRes?.data?.transactions) ? rRes.data.transactions : []),
  ]
  return all.filter((tx) => TARGET_DOCS.includes(String(tx?.voucherMeta?.vocNo || '')))
}

async function main() {
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    name: USERNAME,
    password: PASSWORD,
    company: TENANT,
  })
  const cookie = extractCookie(loginRes.headers['set-cookie'])
  if (loginRes.status !== 200 || !cookie) throw new Error(`Login failed (${loginRes.status})`)

  const targets = await getByDocs(cookie)
  const results = []

  for (const tx of targets) {
    const oldAcCodes = (Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []).map((l) => String(l.acCode || ''))
    const updateRes = await httpRequest('PUT', `/api/erp-accounting/transactions/${tx._id}`, buildUpdatePayload(tx), { Cookie: cookie })

    const row = {
      id: tx._id,
      docNo: tx?.voucherMeta?.vocNo || '',
      type: tx.type,
      oldLineAcCodes: oldAcCodes,
      updateStatus: updateRes.status,
      workflow: [],
      ok: false,
    }

    if (!(updateRes.status >= 200 && updateRes.status < 300)) {
      row.message = updateRes?.data?.message || 'Update failed'
      results.push(row)
      continue
    }

    for (const action of ['submit', 'approve', 'post']) {
      const step = await transition(cookie, tx._id, action)
      row.workflow.push({ action, status: step.status, message: step?.data?.message || '' })
      if (!(step.status >= 200 && step.status < 300)) break
    }

    row.ok = row.workflow.length === 3 && row.workflow.every((s) => s.status >= 200 && s.status < 300)
    results.push(row)
  }

  // Verify ledger postings are not same-account anymore
  const refreshed = await getByDocs(cookie)
  const verify = []

  for (const tx of refreshed) {
    const ledgerId = tx.journalEntryId ? String(tx.journalEntryId) : ''
    if (!ledgerId) {
      verify.push({ docNo: tx?.voucherMeta?.vocNo || '', ok: false, reason: 'missing_journal' })
      continue
    }

    const src = await httpRequest('GET', `/api/erp-accounting/transactions/source-by-ledger/${ledgerId}`, null, { Cookie: cookie })
    const le = src?.data?.ledgerEntry || {}
    const d = le.debitAccountId || {}
    const c = le.creditAccountId || {}
    const debitCode = d.accountCode || ''
    const creditCode = c.accountCode || ''

    verify.push({
      docNo: tx?.voucherMeta?.vocNo || '',
      ok: Boolean(debitCode) && Boolean(creditCode) && debitCode !== creditCode,
      debitCode,
      creditCode,
      amount: le.amount,
      ledgerId,
    })
  }

  console.log(JSON.stringify({
    tenant: TENANT,
    offsetAccountCode: OFFSET_AC_CODE,
    targeted: TARGET_DOCS,
    updated: results,
    verify,
    ok: verify.every((v) => v.ok),
  }, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
