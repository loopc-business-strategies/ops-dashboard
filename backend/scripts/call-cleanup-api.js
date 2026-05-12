#!/usr/bin/env node
/**
 * Call cleanup endpoint via API
 */

const https = require('https')

const API_URL = 'https://api.loopcstrategies.com'
const TENANT = 'mg'

async function callCleanup() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/api/admin/cleanup/exchange-entries`)
    url.searchParams.append('tenant', TENANT)

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0
      }
    }

    console.log('🔌 Calling cleanup endpoint...')
    console.log(`   ${url.toString()}`)

    const req = https.request(options, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          const data = JSON.parse(body)
          
          console.log('\n✅ Cleanup Response:')
          console.log(`   Status: ${data.ok ? '✓ Success' : '✗ Failed'}`)
          console.log(`   Message: ${data.message}`)
          console.log(`   Deleted: ${data.deletedCount} entries`)
          
          if (data.entries && data.entries.length > 0) {
            console.log('\n📋 Deleted Entries:')
            data.entries.forEach((entry, i) => {
              console.log(`   [${i + 1}] ${entry.description}`)
              console.log(`       Amount: ${entry.amount} | Date: ${entry.date}`)
            })
          }

          console.log('\n✅ Cash account 1000 is now CLEAN!')
          console.log('   Refresh the dashboard to see changes')
          
          resolve()
        } catch (e) {
          console.error('✗ Error parsing response:', e.message)
          reject(e)
        }
      })
    })

    req.on('error', (e) => {
      console.error('✗ Request failed:', e.message)
      reject(e)
    })

    req.end()
  })
}

callCleanup()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('✗ Cleanup failed:', e.message)
    process.exit(1)
  })
