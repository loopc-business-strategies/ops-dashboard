const https = require('https')

const makeRequest = (method, path, data = null) => new Promise((resolve, reject) => {
  const url = new URL('https://api.loopcstrategies.com' + path)
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'mg' },
  }
  const req = https.request(options, (res) => {
    let body = ''
    res.on('data', (chunk) => (body += chunk))
    res.on('end', () => {
      try {
        resolve({ status: res.statusCode, data: JSON.parse(body) })
      } catch (e) {
        resolve({ status: res.statusCode, data: body })
      }
    })
  })
  req.on('error', reject)
  if (data) req.write(JSON.stringify(data))
  req.end()
})

;(async () => {
  try {
    console.log('\n=== MG Database Entry Check ===\n')

    // Check transactions (payment, receipt, purchase, metal_sale vouchers)
    console.log('[1] Checking Transactions (Vouchers)...')
    let txRes = await makeRequest('GET', '/api/erp-accounting/transactions?limit=100&includeVoided=true')
    const transactions = txRes.data.transactions || txRes.data || []
    console.log(`Status: ${txRes.status}`)
    console.log(`Total found: ${Array.isArray(transactions) ? transactions.length : 0}`)
    if (Array.isArray(transactions) && transactions.length > 0) {
      console.log('Sample entries:')
      transactions.slice(0, 3).forEach((tx, i) => {
        console.log(`  ${i+1}. ${tx.type || 'unknown'} - ${tx._id}`)
      })
    }

    // Check ledger (journal vouchers)
    console.log('\n[2] Checking Ledger (Journal Entries)...')
    let ledRes = await makeRequest('GET', '/api/erp-accounting/ledger?limit=100&includeAll=true')
    const ledger = ledRes.data.entries || ledRes.data || []
    console.log(`Status: ${ledRes.status}`)
    console.log(`Total found: ${Array.isArray(ledger) ? ledger.length : 0}`)
    if (Array.isArray(ledger) && ledger.length > 0) {
      const jvs = ledger.filter(e => ['journal', 'bank_jv'].includes(String(e.referenceType || '').toLowerCase()))
      console.log(`Journal Vouchers found: ${jvs.length}`)
      console.log('Sample entries:')
      jvs.slice(0, 3).forEach((entry, i) => {
        console.log(`  ${i+1}. ${entry.referenceType || 'unknown'} - ${entry._id} - Debit: ${entry.debit}, Credit: ${entry.credit}`)
      })
    }

    console.log('\n=== Summary ===')
    console.log(`Transactions: ${Array.isArray(transactions) ? transactions.length : 'error'} entries`)
    console.log(`Ledger: ${Array.isArray(ledger) ? ledger.length : 'error'} entries\n`)
  } catch (e) {
    console.error(`Error: ${e.message}\n`)
  }
})()
