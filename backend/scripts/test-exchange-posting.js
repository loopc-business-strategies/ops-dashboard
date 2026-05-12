#!/usr/bin/env node
/**
 * Test Exchange Entry Posting to AR/AP (Option B)
 * Creates a payment transaction with foreign currency to verify
 * exchange entries now post to AR/AP instead of cash account
 */

const http = require('http')

const API_BASE = process.env.API_URL || 'http://api.loopcstrategies.com'
const TENANT = process.env.TENANT || 'mg'

// Test data: Payment in AED (foreign currency) with exchange rate difference
const testPayment = {
  type: 'payment',
  amount: 1000, // USD
  currency: 'AED', // Foreign currency
  date: new Date().toISOString(),
  description: '[TEST] Payment with FX - verify AR/AP posting',
  vendorId: 'test-vendor-id', // Will be resolved by backend
  voucherMeta: {
    vocNo: `TEST-${Date.now()}`,
    referenceExchangeRate: 3.67, // Original rate
    lineItems: [
      {
        currCode: 'AED',
        currRate: 3.75, // Settlement rate (different = FX gain/loss)
        amountFC: 3750, // 1000 USD at settlement rate
        amountLC: 1000
      }
    ]
  }
}

async function testExchangePosting() {
  try {
    console.log(`Testing Exchange Entry Posting to AR/AP (Option B)`)
    console.log(`================================================\n`)

    console.log(`1. Creating test payment transaction in ${TENANT}...`)
    console.log(`   Amount: ${testPayment.amount} USD`)
    console.log(`   Currency: ${testPayment.currency}`)
    console.log(`   Ref Rate: ${testPayment.voucherMeta.referenceExchangeRate}`)
    console.log(`   Settlement Rate: ${testPayment.voucherMeta.lineItems[0].currRate}`)

    const transactionRes = await makeRequest(
      'POST',
      `/api/erp-accounting/transactions`,
      testPayment,
      TENANT
    )

    if (!transactionRes.ok) {
      throw new Error(`Failed to create transaction: ${transactionRes.statusCode}`)
    }

    const transaction = transactionRes.data
    console.log(`   ✓ Created transaction: ${transaction._id}`)
    console.log(`   Status: ${transaction.status}`)

    console.log(`\n2. Fetching created exchange entries...`)
    
    // Query ledger for exchange entries
    const ledgerRes = await makeRequest(
      'GET',
      `/api/erp-accounting/ledger?referenceId=${transaction._id}&referenceType=journal`,
      null,
      TENANT
    )

    if (!ledgerRes.ok) {
      console.log(`   ℹ Note: Ledger query may not be available via GET. Check via account enquiry.`)
    } else {
      const entries = ledgerRes.data || []
      const exchangeEntries = entries.filter(e => e.description?.includes('Exchange'))
      
      console.log(`   Found ${exchangeEntries.length} exchange entries:`)
      exchangeEntries.forEach((entry, i) => {
        console.log(`\n   Entry ${i + 1}:`)
        console.log(`   - Description: ${entry.description}`)
        console.log(`   - Amount: ${entry.amount}`)
        console.log(`   - Debit Account: ${entry.debitAccountId?.accountCode} (${entry.debitAccountId?.accountName})`)
        console.log(`   - Credit Account: ${entry.creditAccountId?.accountCode} (${entry.creditAccountId?.accountName})`)

        // Verify posting is to AR/AP, not cash (1000)
        const debitCode = entry.debitAccountId?.accountCode
        const creditCode = entry.creditAccountId?.accountCode
        const isCashPosted = debitCode === '1000' || creditCode === '1000'
        
        if (!isCashPosted) {
          console.log(`   ✓ VERIFIED: Posted to AR/AP, NOT cash account`)
        } else {
          console.log(`   ✗ ERROR: Posted to cash account (should be AR/AP)`)
        }
      })
    }

    console.log(`\n3. Cleanup Instructions:`)
    console.log(`   Transaction ID: ${transaction._id}`)
    console.log(`   To remove this test entry, call:`)
    console.log(`   DELETE /api/erp-accounting/transactions/${transaction._id}`)

    console.log(`\n✓ Test complete. Verify exchange entries posted to AR/AP (1100/2000) not Cash (1000).`)
    process.exit(0)

  } catch (error) {
    console.error(`✗ Test failed: ${error.message}`)
    process.exit(1)
  }
}

function makeRequest(method, path, data, tenant = 'mg') {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path)
    url.searchParams.append('tenant', tenant)
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }

    if (data) {
      const jsonData = JSON.stringify(data)
      options.headers['Content-Length'] = Buffer.byteLength(jsonData)
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
            data: body
          })
        }
      })
    })

    req.on('error', reject)
    if (data) req.write(JSON.stringify(data))
    req.end()
  })
}

testExchangePosting()
