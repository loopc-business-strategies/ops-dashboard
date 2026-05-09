const https = require('https')

const API = 'https://api.loopcstrategies.com'
const TEN = 'mg'
const USER = process.env.MG_ADMIN_NAME || 'Nan'
const PASS = process.env.MG_ADMIN_PASSWORD || '123456'

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path)
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TEN,
        ...headers,
      },
    }
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data)

    const request = https.request(options, (response) => {
      let text = ''
      response.on('data', (chunk) => {
        text += chunk
      })
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, data: JSON.parse(text), headers: response.headers })
        } catch {
          resolve({ status: response.statusCode, data: text, headers: response.headers })
        }
      })
    })

    request.on('error', reject)
    if (data) request.write(data)
    request.end()
  })
}

function nextDoc(entries, referenceType, prefix, year) {
  let max = 0
  for (const entry of entries) {
    if (String(entry.referenceType || '').toLowerCase() !== referenceType) continue
    const head = String(entry.description || '').split(' — ')[0].trim()
    const match = head.match(/^([A-Z]+)\/(\d{4})\/(\d+)$/i)
    if (!match) continue
    if (String(match[1]).toLowerCase() !== String(prefix).toLowerCase()) continue
    if (Number(match[2]) !== year) continue
    const num = Number(match[3])
    if (Number.isFinite(num) && num > max) max = num
  }
  return `${prefix}/${year}/${String(max + 1).padStart(4, '0')}`
}

async function run() {
  const login = await req('POST', '/api/auth/login', { name: USER, password: PASS, company: TEN })
  if (login.status !== 200) throw new Error(`Login failed: ${login.status}`)
  const cookie = (login.headers['set-cookie'] || []).map((value) => value.split(';')[0]).join('; ')

  const ledgerRead = await req('GET', '/api/erp-accounting/ledger?limit=400', null, { Cookie: cookie })
  if (ledgerRead.status !== 200) throw new Error(`Ledger read failed: ${ledgerRead.status}`)
  const entries = ledgerRead.data.entries || []

  const year = new Date().getFullYear()
  const normalDoc = nextDoc(entries, 'journal', 'Jv', year)
  const bankDoc = nextDoc(entries, 'bank_jv', 'BnkJV', year)
  const stamp = new Date().toISOString().replace(/[TZ:.]/g, '').slice(0, 14)

  const debitAccountId = '682b15f4970135f8cc1549db' // 1000 Cash on Hand
  const creditAccountId = '682b15f4970135f8cc1549df' // 1010 Main Bank Account

  const normalPayload = {
    date: new Date().toISOString().slice(0, 10),
    description: `${normalDoc} — AUTO TEST ${stamp}`,
    notes: 'AUTO TEST NORMAL JV',
    referenceType: 'journal',
    currency: 'USD',
    debitAccountId,
    creditAccountId,
    amount: 1,
  }

  const bankPayload = {
    date: new Date().toISOString().slice(0, 10),
    description: `${bankDoc} — AUTO TEST ${stamp}`,
    notes: 'AUTO TEST BANK JV',
    referenceType: 'bank_jv',
    currency: 'USD',
    debitAccountId,
    creditAccountId,
    amount: 1,
  }

  const normalCreate = await req('POST', '/api/erp-accounting/ledger', normalPayload, { Cookie: cookie })
  const bankCreate = await req('POST', '/api/erp-accounting/ledger', bankPayload, { Cookie: cookie })

  const verify = await req('GET', '/api/erp-accounting/ledger?limit=400', null, { Cookie: cookie })
  const all = verify.data.entries || []

  const foundNormal = all.find((entry) => String(entry.description || '').startsWith(normalDoc))
  const foundBank = all.find((entry) => String(entry.description || '').startsWith(bankDoc))

  console.log(JSON.stringify({
    normal: {
      docNo: normalDoc,
      createStatus: normalCreate.status,
      id: normalCreate.data?.entry?._id || null,
      found: Boolean(foundNormal),
      referenceType: foundNormal?.referenceType || null,
      amount: foundNormal?.amount || null,
    },
    bank: {
      docNo: bankDoc,
      createStatus: bankCreate.status,
      id: bankCreate.data?.entry?._id || null,
      found: Boolean(foundBank),
      referenceType: foundBank?.referenceType || null,
      amount: foundBank?.amount || null,
    },
  }, null, 2))
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
