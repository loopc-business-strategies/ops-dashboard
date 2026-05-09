const https = require('https')

const API = 'https://api.loopcstrategies.com'
const TENANT = 'mg'

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
        'x-tenant-id': TENANT,
        ...headers,
      },
    }

    if (data) options.headers['Content-Length'] = Buffer.byteLength(data)

    const request = https.request(options, (res) => {
      let text = ''
      res.on('data', (chunk) => {
        text += chunk
      })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(text), headers: res.headers })
        } catch {
          resolve({ status: res.statusCode, data: text, headers: res.headers })
        }
      })
    })

    request.on('error', reject)
    if (data) request.write(data)
    request.end()
  })
}

async function main() {
  const login = await req('POST', '/api/auth/login', {
    name: process.env.MG_ADMIN_NAME || 'Nan',
    password: process.env.MG_ADMIN_PASSWORD || '123456',
    company: TENANT,
  })

  const cookie = (login.headers['set-cookie'] || []).map((value) => value.split(';')[0]).join('; ')
  if (login.status !== 200 || !cookie) {
    console.log(JSON.stringify({ loginStatus: login.status, loginBody: login.data }, null, 2))
    process.exit(1)
  }

  const paymentRes = await req('GET', '/api/erp-accounting/transactions?type=payment&limit=300', null, { Cookie: cookie })
  const receiptRes = await req('GET', '/api/erp-accounting/transactions?type=receipt&limit=300', null, { Cookie: cookie })

  const payments = Array.isArray(paymentRes.data?.transactions) ? paymentRes.data.transactions : []
  const receipts = Array.isArray(receiptRes.data?.transactions) ? receiptRes.data.transactions : []

  const payment = payments.find((row) => String(row?.voucherMeta?.vocNo || '') === 'Pay/2026/0003')
  if (!payment) {
    console.log(JSON.stringify({ found: false, recentPayments: payments.slice(0, 10).map((row) => row?.voucherMeta?.vocNo) }, null, 2))
    return
  }

  const output = {
    found: true,
    payment: {
      id: payment._id,
      docNo: payment.voucherMeta?.vocNo,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      exchangeRate: payment.exchangeRate,
      journalEntryId: payment.journalEntryId,
      voucherMeta: {
        partyCode: payment.voucherMeta?.partyCode,
        partyName: payment.voucherMeta?.partyName,
        currRate: payment.voucherMeta?.currRate,
        referenceExchangeRate: payment.voucherMeta?.referenceExchangeRate,
        invoiceExchangeRate: payment.voucherMeta?.invoiceExchangeRate,
        lineItems: (payment.voucherMeta?.lineItems || []).map((line) => ({
          acCode: line.acCode,
          currCode: line.currCode,
          currRate: line.currRate,
          referenceRate: line.referenceRate,
          amountFC: line.amountFC,
          amountLC: line.amountLC,
          headerAmt: line.headerAmt,
          narration: line.narration,
        })),
      },
    },
    receipts: receipts.slice(0, 10).map((row) => ({
      id: row._id,
      docNo: row?.voucherMeta?.vocNo,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      partyCode: row?.voucherMeta?.partyCode,
    })),
  }

  if (payment.journalEntryId) {
    const sourceRes = await req('GET', `/api/erp-accounting/transactions/source-by-ledger/${payment.journalEntryId}`, null, { Cookie: cookie })
    output.payment.ledgerFromJournal = sourceRes.data?.ledgerEntry || null
  }

  const ledgerRes = await req('GET', '/api/erp-accounting/ledger?limit=500&referenceType=journal', null, { Cookie: cookie })
  const ledgerEntries = Array.isArray(ledgerRes.data?.entries) ? ledgerRes.data.entries : []

  output.fxJournalMatches = ledgerEntries
    .filter((entry) => {
      const desc = String(entry.description || '').toLowerCase()
      const notes = String(entry.notes || '')
      const referenceId = String(entry.referenceId || '')
      return desc.includes('exchange') && (notes.includes(payment._id) || referenceId === String(payment._id) || String(entry.description || '').includes(payment._id))
    })
    .map((entry) => ({
      id: entry._id,
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      exchangeRate: entry.exchangeRate,
      debit: entry.debitAccountId?.accountCode,
      credit: entry.creditAccountId?.accountCode,
      referenceId: entry.referenceId,
      notes: entry.notes,
    }))

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error('Fatal:', error.message)
  process.exit(1)
})
