require('./_requireGuard')

const { createMakeRequest, assertLoginConfigured, loginPayloadForApi } = require('./_opsMiscEnv')

const makeRequest = createMakeRequest()
const APPLY = process.argv.includes('--apply')

;(async () => {
  try {
    console.log('\n=== Authenticated MG Comprehensive Cleanup ===\n')
    if (!APPLY) {
      console.log('Dry-run only. Pass --apply --reason="..." --confirm=... to delete data.\n')
    }

    // Step 1: Login
    assertLoginConfigured()
    console.log('[1/6] Logging in as Nan...')
    let loginRes = await makeRequest('POST', '/api/auth/login', loginPayloadForApi())
    if (loginRes.status !== 200) {
      console.log(`Login failed: ${loginRes.status}`)
      console.log(JSON.stringify(loginRes.data).slice(0, 200))
      throw new Error(`Auth failed`)
    }
    const token = loginRes.data.token
    const authHeaders = { 'Authorization': `Bearer ${token}` }
    console.log(`✓ Logged in\n`)

    // Step 2: Get all ledger entries
    console.log('[2/6] Fetching ledger entries...')
    let ledRes = await makeRequest('GET', '/api/erp-accounting/ledger?limit=1000', null, authHeaders)
    if (ledRes.status !== 200) {
      console.log(`Fetch failed: ${ledRes.status}`)
      throw new Error('Could not fetch ledger')
    }
    const ledger = ledRes.data.entries || []
    console.log(`✓ Found ${ledger.length} ledger entries\n`)

    // Step 3: Get all transactions
    console.log('[3/6] Fetching transactions...')
    let txRes = await makeRequest('GET', '/api/erp-accounting/transactions?limit=1000&includeVoided=true', null, authHeaders)
    if (txRes.status !== 200) {
      console.log(`Fetch failed: ${txRes.status}`)
      throw new Error('Could not fetch transactions')
    }
    const transactions = txRes.data.transactions || []
    console.log(`✓ Found ${transactions.length} transactions\n`)

    if (!APPLY) {
      console.log(`Would delete ${ledger.length} ledger entries and ${transactions.length} transactions.`)
      console.log('No changes made (dry-run).')
      return
    }

    // Step 4: Delete all ledger entries
    console.log('[4/6] Deleting ledger entries...')
    let deletedLedger = 0
    for (const entry of ledger) {
      try {
        const delRes = await makeRequest('DELETE', `/api/erp-accounting/ledger/${entry._id}`, null, authHeaders)
        if ([200, 204].includes(delRes.status)) {
          deletedLedger++
          process.stdout.write('.')
        } else {
          process.stdout.write(`[${delRes.status}]`)
        }
      } catch (e) {
        process.stdout.write('E')
      }
    }
    console.log(`\n✓ Deleted ${deletedLedger}/${ledger.length} ledger entries\n`)

    // Step 5: Delete all transactions
    console.log('[5/6] Deleting transactions...')
    let deletedTx = 0
    for (const tx of transactions) {
      try {
        const delRes = await makeRequest('DELETE', `/api/erp-accounting/transactions/${tx._id}`, null, authHeaders)
        if ([200, 204].includes(delRes.status)) {
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

    // Step 6: Verify
    console.log('[6/6] Verifying cleanup...')
    let verifyLed = await makeRequest('GET', '/api/erp-accounting/ledger?limit=100', null, authHeaders)
    let verifyTx = await makeRequest('GET', '/api/erp-accounting/transactions?limit=100', null, authHeaders)
    const finalLedger = verifyLed.data.entries || []
    const finalTx = verifyTx.data.transactions || []
    console.log(`Ledger entries remaining: ${finalLedger.length}`)
    console.log(`Transactions remaining: ${finalTx.length}\n`)

    console.log('=== Cleanup Summary ===')
    console.log(`Ledger deleted: ${deletedLedger}`)
    console.log(`Transactions deleted: ${deletedTx}`)
    console.log(`Total cleared: ${deletedLedger + deletedTx}`)
    console.log(`Remaining - Ledger: ${finalLedger.length}, TX: ${finalTx.length}\n`)

  } catch (e) {
    console.error(`\n❌ Error: ${e.message}\n`)
    process.exit(1)
  }
})()
