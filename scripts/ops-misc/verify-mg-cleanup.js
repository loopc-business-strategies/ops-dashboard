const https = require('https')

const makeRequest = (method, path) => new Promise((resolve, reject) => {
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
  req.end()
})

;(async () => {
  try {
    console.log('\n=== MG Cleanup Verification ===\n')

    // Check transactions
    console.log('[1] Checking Transactions (Vouchers)...')
    let txRes = await makeRequest('GET', '/api/erp-accounting/transactions?limit=1000')
    const transactions = txRes.data.transactions || []
    console.log(`✓ Total transactions found: ${transactions.length}`)
    if (transactions.length === 0) console.log('✓ All vouchers cleared!')

    // Check ledger
    console.log('\n[2] Checking Ledger (Journal Vouchers)...')
    let ledRes = await makeRequest('GET', '/api/erp-accounting/ledger?limit=1000')
    const ledger = ledRes.data.entries || []
    const jvs = ledger.filter(e => ['journal', 'bank_jv'].includes(String(e.referenceType || '').toLowerCase()))
    console.log(`✓ Total ledger entries: ${ledger.length}`)
    console.log(`✓ Journal entries (JV/Bank JV): ${jvs.length}`)
    if (jvs.length === 0) console.log('✓ All JVs cleared!')

    // Check accounts (should still be there)
    console.log('\n[3] Checking Chart of Accounts (should be preserved)...')
    let accRes = await makeRequest('GET', '/api/erp-accounting/accounts?limit=1000')
    const accounts = accRes.data.accounts || []
    console.log(`✓ Total accounts preserved: ${accounts.length}`)

    console.log('\n=== Summary ===')
    console.log(`Vouchers: ${transactions.length === 0 ? '✓ CLEARED' : `✗ ${transactions.length} found`}`)
    console.log(`Journal Entries: ${jvs.length === 0 ? '✓ CLEARED' : `✗ ${jvs.length} found`}`)
    console.log(`Chart of Accounts: ${accounts.length > 0 ? '✓ PRESERVED' : '✗ None found'}\n`)
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}\n`)
    process.exit(1)
  }
})()
