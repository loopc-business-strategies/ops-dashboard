require('./_destructive-guard')({ scriptName: __filename, allowDryRunNoApply: true })
/**
 * Upsert optional currency INR (Indian Rupee) for one or all tenants.
 * Stored exchangeRate = USD per 1 INR = 1 / (INR per 1 USD).
 *
 * Dry run (default): --tenant=loopc [--inr-per-usd=85.6]
 * Stores exchangeRate = 1/inrPerUsd at full float precision so Currency Master shows
 * Exchange Rate 0.011682 (6dp) and 1 USD = 85.6 — do not round to 0.011682 before save.
 * Apply: add --apply --reason="..." --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const mongoose = require('mongoose')
const path = require('path')

const { getTenantUri, TENANT_KEYS, normalizeTenant } = require('../../config/tenants')

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)
  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

const DEFAULT_INR_PER_USD = 85.6

function parseInrPerUsd() {
  const raw = String(readArgValue('--inr-per-usd') || readArgValue('--inrPerUsd') || '').trim()
  const n = raw ? Number(raw) : DEFAULT_INR_PER_USD
  if (!Number.isFinite(n) || n <= 0) {
    console.error('Invalid --inr-per-usd (must be a positive number, e.g. 85.6 meaning 1 USD = 85.6 INR).')
    process.exit(1)
  }
  return n
}

function tenantsToRun() {
  const raw = String(readArgValue('--tenant') || readArgValue('-t') || '').trim().toLowerCase()
  if (raw === 'all') return TENANT_KEYS.slice()
  const one = normalizeTenant(raw)
  if (!one) {
    console.error('Pass --tenant=loopc (or mg, cg, all).')
    process.exit(1)
  }
  return [one]
}

async function provisionTenant(tenantKey, inrPerUsd, isApply) {
  const uri = getTenantUri(tenantKey)
  if (!uri) {
    console.warn(`[${tenantKey}] skipped: missing URI in env (${tenantKey === 'loopc' ? 'MONGO_URI_LOOPC' : 'see tenants.js'})`)
    return
  }

  const exchangeRate = 1 / inrPerUsd
  const conn = await mongoose.createConnection(uri).asPromise()
  try {
    const col = conn.collection('currencies')
    const existing = await col.findOne({ code: 'INR' })
    const payload = {
      code: 'INR',
      name: 'Indian Rupee',
      symbol: '₹',
      exchangeRate,
      baseCurrency: false,
      isActive: true,
      rateUpdatedAt: new Date(),
    }

    if (existing?.baseCurrency) {
      console.error(`[${tenantKey}] INR exists as base currency — refusing to change. Fix manually.`)
      return
    }

    if (!isApply) {
      const inv = payload.exchangeRate > 0 ? (1 / payload.exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 'N/A'
      console.log(
        `[${tenantKey}] dry-run: would upsert INR name="${payload.name}" ` +
          `stored exchangeRate=${payload.exchangeRate} (UI ~${payload.exchangeRate.toFixed(6)} USD/INR, 1 USD ≈ ${inv} INR)`
      )
      if (existing) {
        console.log(`[${tenantKey}] current row: exchangeRate=${existing.exchangeRate} name=${existing.name}`)
      }
      return
    }

    const now = new Date()
    await col.updateOne(
      { code: 'INR' },
      {
        $set: {
          name: payload.name,
          symbol: payload.symbol,
          exchangeRate: payload.exchangeRate,
          baseCurrency: false,
          isActive: true,
          rateUpdatedAt: now,
        },
        $setOnInsert: {
          code: 'INR',
          createdAt: now,
        },
        $currentDate: { updatedAt: true },
      },
      { upsert: true }
    )
    console.log(`[${tenantKey}] INR upserted exchangeRate=${exchangeRate} (1 USD = ${inrPerUsd} INR)`)
  } finally {
    await conn.close()
  }
}

async function main() {
  const isApply = process.argv.includes('--apply')
  const inrPerUsd = parseInrPerUsd()
  const keys = tenantsToRun()

  for (const key of keys) {
    await provisionTenant(key, inrPerUsd, isApply)
  }

  if (!isApply) {
    console.log('\nDry run only. Re-run with --apply --reason="..." --confirm=... to write (see backend/scripts/README.md).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
