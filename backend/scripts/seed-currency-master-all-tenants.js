require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const mongoose = require('mongoose')
const { TENANT_KEYS, getTenantUri } = require('../config/tenants')

const defaults = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, baseCurrency: true },
  { code: 'EUR', name: 'Euro', symbol: 'EUR', exchangeRate: 1.08, baseCurrency: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 0.2723, baseCurrency: false },
  { code: 'UZS', name: 'Uzbekistan Som', symbol: 'UZS', exchangeRate: 0.000078, baseCurrency: false },
]

async function seedTenant(tenant) {
  const uri = getTenantUri(tenant)
  if (!uri) {
    console.log(`[${tenant}] skipped: missing tenant URI`)
    return
  }

  const conn = await mongoose.createConnection(uri).asPromise()
  try {
    const col = conn.collection('currencies')
    const now = new Date()

    for (const currency of defaults) {
      if (currency.baseCurrency) {
        await col.updateOne(
          { code: currency.code },
          {
            $set: {
              name: currency.name,
              symbol: currency.symbol,
              exchangeRate: 1,
              baseCurrency: true,
              isActive: true,
              rateUpdatedAt: now,
            },
            $setOnInsert: { code: currency.code, createdAt: now },
            $currentDate: { updatedAt: true },
          },
          { upsert: true }
        )

        await col.updateMany(
          { code: { $ne: 'USD' }, baseCurrency: true },
          { $set: { baseCurrency: false }, $currentDate: { updatedAt: true } }
        )
        continue
      }

      await col.updateOne(
        { code: currency.code },
        {
          $setOnInsert: {
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            exchangeRate: currency.exchangeRate,
            baseCurrency: false,
            isActive: true,
            rateUpdatedAt: now,
            createdAt: now,
          },
          $currentDate: { updatedAt: true },
        },
        { upsert: true }
      )

      await col.updateOne(
        { code: currency.code, exchangeRate: { $lte: 0 } },
        {
          $set: {
            exchangeRate: currency.exchangeRate,
            rateUpdatedAt: now,
            isActive: true,
          },
          $currentDate: { updatedAt: true },
        }
      )
    }

    const list = await col.find({ code: { $in: ['USD', 'EUR', 'AED', 'UZS'] } })
      .project({ _id: 0, code: 1, exchangeRate: 1, baseCurrency: 1, isActive: 1 })
      .sort({ code: 1 })
      .toArray()

    console.log(`[${tenant}] ${JSON.stringify(list)}`)
  } finally {
    await conn.close()
  }
}

async function run() {
  for (const tenant of TENANT_KEYS) {
    await seedTenant(tenant)
  }
  console.log('Currency master seeded for all tenants.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
require('./destructive/_destructive-guard')({ scriptName: __filename })
