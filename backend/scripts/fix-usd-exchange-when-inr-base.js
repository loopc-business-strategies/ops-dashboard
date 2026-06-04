/**
 * When the tenant base currency is INR, the USD row must store **INR per 1 USD**
 * (e.g. 83.5), not 1. This script sets that rate after you pick the spot.
 *
 * Usage (dry-run default):
 *   node backend/scripts/fix-usd-exchange-when-inr-base.js --tenant=loopc --inr-per-usd=83.5
 * Apply:
 *   node backend/scripts/fix-usd-exchange-when-inr-base.js --tenant=loopc --inr-per-usd=83.5 --apply
 *
 * Env: MONGO_URI_* from .env (see ../config/tenants.js)
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant, TENANT_KEYS } = require('../config/tenants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const APPLY = process.argv.includes('--apply')

function argValue(name, fallback) {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (!hit) return fallback
  return hit.slice(prefix.length).trim() || fallback
}

function parseInrPerUsd() {
  const raw = String(argValue('inr-per-usd', '') || argValue('inrPerUsd', '')).trim()
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    console.error('Required: --inr-per-usd=<positive number> (INR per 1 USD, e.g. 83.5).')
    process.exit(1)
  }
  return n
}

async function main() {
  const tenant = normalizeTenant(argValue('tenant', 'loopc')) || 'loopc'
  if (!TENANT_KEYS.includes(tenant)) {
    console.error(`Invalid --tenant (use one of: ${TENANT_KEYS.join(', ')})`)
    process.exit(1)
  }

  const inrPerUsd = parseInrPerUsd()
  const uri = getTenantUri(tenant)
  if (!uri) {
    console.error(`Missing Mongo URI for tenant ${tenant}`)
    process.exit(1)
  }

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const db = conn.getClient().db()
  const col = db.collection('currencies')

  const base = await col.findOne({ baseCurrency: true, isActive: { $ne: false } })
  const baseCode = String(base?.code || '').trim().toUpperCase()
  if (baseCode !== 'INR') {
    console.error(`Expected base currency INR; found base="${baseCode || '(none)'}" — abort.`)
    await conn.close()
    process.exit(1)
  }

  const usd = await col.findOne({ code: 'USD', isActive: { $ne: false } })
  if (!usd) {
    console.error('No active USD currency row — create USD in Currency Master first.')
    await conn.close()
    process.exit(1)
  }

  const current = Number(usd.exchangeRate || 0)
  const summary = {
    tenant,
    base: baseCode,
    usdRowId: String(usd._id),
    currentUsdExchangeRate: current,
    nextUsdExchangeRate: inrPerUsd,
    meaning: 'INR per 1 USD (base units per 1 USD)',
    apply: APPLY,
  }
  console.log(JSON.stringify({ preview: summary }, null, 2))

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to update the USD row.')
    await conn.close()
    return
  }

  const now = new Date()
  await col.updateOne(
    { _id: usd._id },
    {
      $set: {
        exchangeRate: inrPerUsd,
        baseCurrency: false,
        isActive: true,
        rateUpdatedAt: now,
        updatedAt: now,
      },
    },
  )
  console.log(JSON.stringify({ ok: true, updated: 'USD.exchangeRate', tenant, inrPerUsd }, null, 2))
  await conn.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
