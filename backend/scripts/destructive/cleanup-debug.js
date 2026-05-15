#!/usr/bin/env node
require('./_destructive-guard')({ scriptName: __filename })
/**
 * Cleanup with better error handling
 */

const https = require('https')

const API_URL = 'https://api.loopcstrategies.com'
const TENANT = 'mg'

async function cleanup() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/api/admin/cleanup/exchange-entries`)
    url.searchParams.append('tenant', TENANT)

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }

    console.log('🔌 Calling cleanup endpoint...')
    console.log(`   POST ${API_URL}/api/admin/cleanup/exchange-entries?tenant=${TENANT}\n`)

    const req = https.request(options, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        console.log(`📡 Status Code: ${res.statusCode}`)
        console.log(`📡 Content-Type: ${res.headers['content-type']}\n`)
        console.log('📋 Response Body:')
        console.log(body)
        console.log()

        try {
          const data = JSON.parse(body)
          
          if (data.ok) {
            console.log('✅ SUCCESS')
            console.log(`   Message: ${data.message}`)
            console.log(`   Deleted: ${data.deletedCount} entries`)
            
            if (data.entries && data.entries.length > 0) {
              console.log('\n   Deleted Entries:')
              data.entries.forEach((entry, i) => {
                console.log(`   [${i + 1}] ${entry.description}`)
                console.log(`       Amount: ${entry.amount} USD | Date: ${entry.date}`)
              })
            }
          } else {
            console.log('✗ FAILED')
            console.log(`   Error: ${data.error || 'Unknown error'}`)
          }
          
          resolve()
        } catch (e) {
          console.log('⚠️  Response is not JSON')
          console.log(`   Parse error: ${e.message}`)
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

cleanup()
  .then(() => process.exit(0))
  .catch((e) => process.exit(1))
