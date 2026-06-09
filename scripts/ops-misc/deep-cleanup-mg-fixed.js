const https = require('https')

const makeRequest = (method, path, data = null, headers = {}) => new Promise((resolve, reject) => {
  const url = new URL('https://api.loopcstrategies.com' + path)
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'mg', ...headers },
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
    console.log('\n=== Deep MG Cleanup (Authenticated) ===\n')

    // Step 1: Login with correct field
    console.log('[1/5] Logging in as Nan...')
    let loginRes = await makeRequest('POST', '/api/auth/login', { name: 'Nan', password: '123456' })
    if (loginRes.status !== 200) {
      console.log(`Login status: ${loginRes.status}`)
      console.log(`Response: ${JSON.stringify(loginRes.data).slice(0, 300)}`)
      throw new Error(`Auth failed - status ${loginRes.status}`)
    }
    const token = loginRes.data.token
    if (!token) throw new Error('No token returned')
    const authHeaders = { 'Authorization': `Bearer ${token}` }
    console.log(`✓ Authenticated, token: ${token.slice(0, 30)}...\n`)

    // Step 2: Fetch all transactions
    console.log('[2/5] Fetching all transactions...')
    let txRes = await makeRequest('GET', '/api/erp-accounting/transactions?limit=1000&includeVoided=true', null, authHeaders)
    if (txRes.status !== 200) {
      console.log(`Error: ${txRes.status} - ${JSON.stringify(txRes.data).slice(0, 200)}`)
      throw new Error(`Failed to fetch transactions: ${txRes.status}`)
    }
    const transactions = txRes.data.transactions || []
    console.log(`Found ${transactions.length} transactions`)
    if (transactions.length > 0) {
      transactions.slice(0, 3).forEach((tx, i) => {
        console.log(`  ${i+1}. ${tx.type || 'unknown'} - ${tx._id}`)
      })
    }

    // Step 3: Fetch all ledger entries
    console.log('[3/5] Fetching all ledger entries...')
    let ledRes = await makeRequest('GET', '/api/erp-accounting/ledger?limit=1000', null, authHeaders)
    if (ledRes.status !== 200) {
      console.log(`Error: ${ledRes.status}`)
      throw new Error(`Failed to fetch ledger: ${ledRes.status}`)
    }
    const ledger = ledRes.data.entries || []
    const jvs = ledger.filter(e => ['journal', 'bank_jv'].includes(String(e.referenceType || '').toLowerCase()))
    console.log(`Found ${ledger.length} total ledger entries (${jvs.length} are JVs)\n`)

    // Step 4: Delete all transactions
    console.log('[4/5] Deleting all transactions...')
    let deletedTx = 0
    for (const tx of transactions) {
      try {
        const delRes = await makeRequest('DELETE', `/api/erp-accounting/transactions/${tx._id}`, null, authHeaders)
        if (delRes.status === 200 || delRes.status === 204) {
          deletedTx++
          process.stdout.write('.')
        } else {
          process.stdout.write(`[${delRes.status}]`)
        }
      } catch (e) {
        process.stdout.write('E')
      }
    }
    console.log(`\n✓ Deleted ${deletedTx}/${transactions.length} transactions\n`)

    // Step 5: Delete all ledger entries (JVs)
    console.log('[5/5] Deleting all ledger entries...')
    let deletedLed = 0
    for (const entry of ledger) {
      try {
        const delRes = await makeRequest('DELETE', `/api/erp-accounting/ledger/${entry._id}`, null, authHeaders)
        if (delRes.status === 200 || delRes.status === 204) {
          deletedLed++
          process.stdout.write('.')
        } else {
          process.stdout.write(`[${delRes.status}]`)
        }
      } catch (e) {
        process.stdout.write('E')
      }
    }
    console.log(`\n✓ Deleted ${deletedLed}/${ledger.length} ledger entries\n`)

    console.log('=== Deep Cleanup Complete ===')
    console.log(`Transactions deleted: ${deletedTx}`)
    console.log(`Ledger entries deleted: ${deletedLed}`)
    console.log(`Total cleared: ${deletedTx + deletedLed}\n`)
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}\n`)
    process.exit(1)
  }
})()
