require('./destructive/_destructive-guard')({ scriptName: __filename })
/**
 * Update UZS exchange rate to 1/12100 (1 USD = 12100 UZS) across all tenants
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const { TENANTS } = require('../config/tenants')

const NEW_UZS_RATE = 1 / 12100  // ~0.00008264

async function updateForTenant(key, mongoUri) {
  const conn = await mongoose.createConnection(mongoUri).asPromise()
  const Currency = conn.model('Currency', new mongoose.Schema({
    code: String,
    exchangeRate: Number,
    rateUpdatedAt: Date,
  }, { strict: false }))

  const result = await Currency.findOneAndUpdate(
    { code: 'UZS' },
    { $set: { exchangeRate: NEW_UZS_RATE, rateUpdatedAt: new Date() } },
    { new: true }
  )

  if (result) {
    console.log(`[${key}] UZS updated → exchangeRate=${result.exchangeRate.toFixed(8)}  (1 USD = ${Math.round(1/result.exchangeRate)} UZS)`)
  } else {
    console.log(`[${key}] UZS not found — skipping`)
  }

  await conn.close()
}

async function main() {
  const tenantKeys = Object.keys(TENANTS)
  for (const key of tenantKeys) {
    const envVar = TENANTS[key].envVar
    const uri = process.env[envVar]
    if (!uri) {
      console.warn(`[${key}] No URI found for env var ${envVar} — skipping`)
      continue
    }
    try {
      await updateForTenant(key, uri)
    } catch (e) {
      console.error(`[${key}] Error: ${e.message}`)
    }
  }
  console.log('Done.')
  process.exit(0)
}

main()
