#!/usr/bin/env node
/**
 * POST a sample MT4 bridge payload to production (uses BRIDGE_TOKEN env).
 * Invoked by verify-bridge.ps1 after reading the token from Railway.
 */
import https from 'https'

const token = process.env.BRIDGE_TOKEN
if (!token) {
  console.error('BRIDGE_TOKEN env is required')
  process.exit(1)
}

const body = JSON.stringify({
  source: 'mt4-bridge',
  tenant: 'mg',
  currency: 'USD',
  unit: 'TOZ',
  metals: {
    gold: { mid: 2650.5, bid: 2650, ask: 2651 },
    silver: { mid: 31.2, bid: 31.1, ask: 31.3 },
    platinum: { mid: 980.5, bid: 980, ask: 981 },
  },
})

const req = https.request({
  hostname: 'api.loopcstrategies.com',
  path: '/api/erp-accounting/metal-rates/bridge',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-metal-rates-bridge-token': token,
    'x-tenant': 'mg',
  },
}, (res) => {
  let data = ''
  res.on('data', (c) => { data += c })
  res.on('end', () => {
    console.log(JSON.stringify({ status: res.statusCode, body: data }))
    process.exit(res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1)
  })
})
req.on('error', (e) => {
  console.error(e.message)
  process.exit(1)
})
req.write(body)
req.end()
