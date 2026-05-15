require('./_destructive-guard')({ scriptName: __filename })
const https = require('https')

const API_BASE = 'https://api.loopcstrategies.com'
const TENANT = 'mg'
const USERNAME = process.env.MG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.MG_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('MG_ADMIN_PASSWORD is required.')
const APPLY = process.argv.includes('--apply')

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

function isNumericDocNo(value) {
  return /^\d+$/.test(String(value || '').trim())
}

function toDocNo(prefix, year, seq) {
  return `${prefix}/${year}/${String(seq).padStart(4, '0')}`
}

function readYear(tx) {
  const raw = tx?.voucherMeta?.docDate || tx?.date || new Date().toISOString()
  const dt = new Date(raw)
  if (!Number.isFinite(dt.getTime())) return new Date().getFullYear()
  return dt.getFullYear()
}

async function transitionTx(cookie, id, action) {
  return httpRequest('POST', `/api/erp-accounting/transactions/${id}/${action}`, { comment: `doc no renumber ${action}` }, { Cookie: cookie })
}

function buildUpdatePayload(tx, newDocNo) {
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
      ...(tx.voucherMeta || {}),
      vocNo: newDocNo,
    },
  }
}

async function main() {
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    name: USERNAME,
    password: PASSWORD,
    company: TENANT,
  })

  const cookieHeader = extractCookie(loginRes.headers['set-cookie'])
  if (loginRes.status !== 200 || !cookieHeader) {
    throw new Error(`Live API login failed (status ${loginRes.status})`)
  }

  const types = [
    { key: 'payment', prefix: 'Pay' },
    { key: 'receipt', prefix: 'Rec' },
  ]

  const plan = []

  for (const type of types) {
    const listRes = await httpRequest('GET', `/api/erp-accounting/transactions?type=${type.key}&limit=500`, null, {
      Cookie: cookieHeader,
    })
    if (listRes.status !== 200) {
      throw new Error(`Failed to fetch ${type.key} list (status ${listRes.status})`)
    }

    const items = Array.isArray(listRes?.data?.transactions) ? listRes.data.transactions : []
    const legacy = items
      .filter((tx) => isNumericDocNo(tx?.voucherMeta?.vocNo))
      .sort((a, b) => Number(a.voucherMeta.vocNo) - Number(b.voucherMeta.vocNo))

    legacy.forEach((tx, i) => {
      const year = readYear(tx)
      plan.push({
        id: tx._id,
        type: type.key,
        fromDocNo: String(tx?.voucherMeta?.vocNo || ''),
        toDocNo: toDocNo(type.prefix, year, i + 1),
        status: tx.status,
      })
    })
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      tenant: TENANT,
      dryRun: true,
      count: plan.length,
      changes: plan,
      message: 'Dry run complete. Re-run with --apply to renumber and re-post vouchers.',
    }, null, 2))
    return
  }

  const results = []

  for (const item of plan) {
    const getRes = await httpRequest('GET', `/api/erp-accounting/transactions?type=${item.type}&limit=500`, null, {
      Cookie: cookieHeader,
    })
    const txList = Array.isArray(getRes?.data?.transactions) ? getRes.data.transactions : []
    const tx = txList.find((t) => String(t._id) === String(item.id))

    if (!tx) {
      results.push({ ...item, ok: false, step: 'fetch-current', message: 'Transaction not found in active list' })
      continue
    }

    const updatePayload = buildUpdatePayload(tx, item.toDocNo)
    const updateRes = await httpRequest('PUT', `/api/erp-accounting/transactions/${item.id}`, updatePayload, {
      Cookie: cookieHeader,
    })

    const row = {
      ...item,
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
      const stepRes = await transitionTx(cookieHeader, item.id, action)
      row.workflow.push({ action, status: stepRes.status, message: stepRes?.data?.message || '' })
      if (!(stepRes.status >= 200 && stepRes.status < 300)) {
        row.message = `Workflow failed at ${action}`
        break
      }
    }

    row.ok = row.workflow.length === 3 && row.workflow.every((s) => s.status >= 200 && s.status < 300)
    results.push(row)
  }

  const verify = {}
  for (const type of types) {
    const res = await httpRequest('GET', `/api/erp-accounting/transactions?type=${type.key}&limit=500`, null, { Cookie: cookieHeader })
    const items = Array.isArray(res?.data?.transactions) ? res.data.transactions : []
    verify[type.key] = items.map((tx) => ({ id: tx._id, docNo: tx?.voucherMeta?.vocNo || '', status: tx.status }))
  }

  console.log(JSON.stringify({
    tenant: TENANT,
    dryRun: false,
    attempted: plan.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    verify,
  }, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
