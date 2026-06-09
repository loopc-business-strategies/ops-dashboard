const { createMakeRequest } = require('./_opsMiscEnv')

const makeRequest = createMakeRequest()

;(async () => {
  try {
    console.log('\n=== MG Chart of Accounts Check ===\n')

    // Check via different endpoints
    console.log('[1] Checking /api/erp-accounting/chart-of-accounts...')
    let res1 = await makeRequest('GET', '/api/erp-accounting/chart-of-accounts?limit=100')
    console.log(`Status: ${res1.status}`)
    const coa1 = res1.data.accounts || res1.data || []
    console.log(`Result: ${Array.isArray(coa1) ? coa1.length : 'N/A'} items\n`)

    console.log('[2] Checking /api/erp-accounting/accounts...')
    let res2 = await makeRequest('GET', '/api/erp-accounting/accounts?limit=100')
    console.log(`Status: ${res2.status}`)
    const coa2 = res2.data.accounts || res2.data || []
    console.log(`Result: ${Array.isArray(coa2) ? coa2.length : 'N/A'} items\n`)

    console.log('[3] Raw response from /accounts:')
    console.log(JSON.stringify(res2.data, null, 2).slice(0, 500) + '...\n')
  } catch (e) {
    console.error(`Error: ${e.message}`)
  }
})()
