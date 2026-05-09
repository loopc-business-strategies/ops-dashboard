const https = require('https')

const API_BASE = 'https://api.loopcstrategies.com'
const TENANT = 'mg'
const USERNAME = process.env.MG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.MG_ADMIN_PASSWORD || '123456'

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

async function transitionTx(cookie, id, action) {
  return httpRequest('POST', `/api/erp-accounting/transactions/${id}/${action}`, { comment: `restore ${action}` }, { Cookie: cookie })
}

async function main() {
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    name: USERNAME,
    password: PASSWORD,
    company: TENANT,
  })

  const cookieHeader = extractCookie(loginRes.headers['set-cookie'])
  if (loginRes.status !== 200 || !cookieHeader) {
    throw new Error('Live API login failed')
  }

  const now = new Date().toISOString().slice(0, 10)
  const payloads = [
    {
      key: 'payment-1',
      body: {
        type: 'payment',
        amount: 20000,
        date: now,
        description: 'Restored legacy payment #1',
        currency: 'USD',
        exchangeRate: 1,
        voucherMeta: {
          vocNo: '1',
          docDate: now,
          valueDate: now,
          partyCode: '101001',
          partyName: 'NATIONAL BANK OF UZBEKISTAN-USD',
          lineItems: [
            {
              acCode: '101001',
              type: 'TT',
              currCode: 'USD',
              currRate: 1,
              amountFC: 20000,
              amountLC: 20000,
              headerAmt: 20000,
              narration: 'Restored legacy payment #1',
            },
          ],
        },
      },
    },
    {
      key: 'payment-2',
      body: {
        type: 'payment',
        amount: 23000,
        date: now,
        description: 'Restored legacy payment #2',
        currency: 'USD',
        exchangeRate: 1,
        voucherMeta: {
          vocNo: '2',
          docDate: now,
          valueDate: now,
          partyCode: '1303',
          partyName: 'V.J ENTERPRISES',
          lineItems: [
            {
              acCode: '1303',
              type: 'TT',
              currCode: 'USD',
              currRate: 1,
              amountFC: 23000,
              amountLC: 23000,
              headerAmt: 23000,
              narration: 'Restored legacy payment #2',
            },
          ],
        },
      },
    },
    {
      key: 'receipt-1',
      body: {
        type: 'receipt',
        amount: 20000,
        date: now,
        description: 'Restored legacy receipt #1',
        currency: 'USD',
        exchangeRate: 1,
        voucherMeta: {
          vocNo: '1',
          docDate: now,
          valueDate: now,
          partyCode: '1301',
          partyName: 'MODERN CAPITAL TRADING LLC',
          lineItems: [
            {
              acCode: '1301',
              type: 'TT',
              currCode: 'USD',
              currRate: 1,
              amountFC: 20000,
              amountLC: 20000,
              headerAmt: 20000,
              narration: 'Restored legacy receipt #1',
            },
          ],
        },
      },
    },
    {
      key: 'receipt-2',
      body: {
        type: 'receipt',
        amount: 27000,
        date: now,
        description: 'Restored legacy receipt #2',
        currency: 'USD',
        exchangeRate: 1,
        voucherMeta: {
          vocNo: '2',
          docDate: now,
          valueDate: now,
          partyCode: '1301',
          partyName: 'MODERN CAPITAL TRADING LLC',
          lineItems: [
            {
              acCode: '1301',
              type: 'TT',
              currCode: 'USD',
              currRate: 1,
              amountFC: 27000,
              amountLC: 27000,
              headerAmt: 27000,
              narration: 'Restored legacy receipt #2',
            },
          ],
        },
      },
    },
  ]

  const results = []

  for (const item of payloads) {
    const createRes = await httpRequest('POST', '/api/erp-accounting/transactions', item.body, { Cookie: cookieHeader })
    const row = {
      key: item.key,
      createStatus: createRes.status,
      createdId: createRes?.data?.transaction?._id || null,
      message: createRes?.data?.message || '',
      workflow: [],
    }

    if (createRes.status >= 200 && createRes.status < 300 && row.createdId) {
      for (const action of ['submit', 'approve', 'post']) {
        const stepRes = await transitionTx(cookieHeader, row.createdId, action)
        row.workflow.push({ action, status: stepRes.status, message: stepRes?.data?.message || '' })
        if (!(stepRes.status >= 200 && stepRes.status < 300)) break
      }
    }

    results.push(row)
  }

  console.log(JSON.stringify({
    tenant: TENANT,
    createdAt: new Date().toISOString(),
    restored: results,
  }, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
