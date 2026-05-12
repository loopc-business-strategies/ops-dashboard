#!/usr/bin/env node
/**
 * API-based cleanup - calls backend to clean up bad entries
 * No direct MongoDB connection needed
 */

const http = require('http')

const API_URL = 'https://api.loopcstrategies.com'
const TENANT = 'mg'

async function cleanupViaAPI() {
  try {
    console.log('🔌 Connecting to backend API...')
    console.log(`   ${API_URL}`)

    // Step 1: Query ledger for bad entries
    console.log('\n📋 Fetching bad exchange entries...')
    
    const entriesRes = await makeRequest(
      'GET',
      `/api/erp-accounting/ledger?referenceType=journal&description=Exchange`,
      TENANT
    )

    if (!entriesRes.ok) {
      throw new Error(`Failed to fetch entries: ${entriesRes.statusCode}`)
    }

    const entries = entriesRes.data || []
    const badEntries = entries.filter(e => {
      const debitCode = e.debitAccountId?.accountCode
      const creditCode = e.creditAccountId?.accountCode
      return debitCode === '1000' || creditCode === '1000'
    })

    console.log(`Found ${badEntries.length} bad entries on Cash 1000:`)
    badEntries.forEach((entry, i) => {
      console.log(`  [${i + 1}] ${entry.description}`)
      console.log(`      Amount: ${entry.amount} | Date: ${entry.date?.split('T')[0]}`)
    })

    if (badEntries.length === 0) {
      console.log('✓ No bad entries found - already clean!')
      process.exit(0)
    }

    // Step 2: Delete each entry via API
    console.log('\n🗑️  Deleting bad entries...')
    
    for (const entry of badEntries) {
      const deleteRes = await makeRequest(
        'DELETE',
        `/api/erp-accounting/ledger/${entry._id}`,
        TENANT
      )

      if (deleteRes.ok) {
        console.log(`  ✓ Deleted: ${entry._id}`)
      } else {
        console.log(`  ✗ Failed: ${entry._id} (${deleteRes.statusCode})`)
      }
    }

    console.log(`\n✅ Cleanup complete!`)
    console.log(`   ${badEntries.length} bad entries removed`)
    console.log(`   Cash 1000 balance should now be 0`)
    process.exit(0)

  } catch (error) {
    console.error(`✗ Error: ${error.message}`)
    process.exit(1)
  }
}

function makeRequest(method, path, tenant = 'mg') {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path)
    url.searchParams.append('tenant', tenant)
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {}
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            data: parsed
          })
        } catch (e) {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            data: { error: body }
          })
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

cleanupViaAPI()
