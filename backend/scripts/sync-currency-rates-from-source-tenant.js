/**
 * Align Currency.exchangeRate values from a source tenant DB to target tenant DBs
 * for currencies that exist in both (matched by code). Dry-run by default.
 *
 * Usage:
 *   node backend/scripts/sync-currency-rates-from-source-tenant.js
 *   node backend/scripts/sync-currency-rates-from-source-tenant.js --source=mg --targets=cg,loopc
 *   node backend/scripts/sync-currency-rates-from-source-tenant.js --apply
 *
 * Does NOT change which currency is base (baseCurrency flag) — only rates on existing rows.
 * If base currency codes differ between source and target, the script refuses --apply for that target.
 *
 * Env: MONGO_URI_MG, MONGO_URI_CG, MONGO_URI_LOOPC (from .env via dotenv)
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

const sourceTenant = normalizeTenant(argValue('source', 'mg')) || 'mg'
const targetsRaw = argValue('targets', 'cg,loopc')
const targetTenants = targetsRaw
  .split(',')
  .map((s) => normalizeTenant(s))
  .filter(Boolean)
  .filter((k) => k !== sourceTenant)

async function loadCurrencies(db) {
  const rows = await db.collection('currencies').find({ isActive: { $ne: false } }).project({
    code: 1,
    exchangeRate: 1,
    baseCurrency: 1,
    name: 1,
  }).toArray()
  const byCode = new Map()
  for (const r of rows) {
    const code = String(r.code || '').trim().toUpperCase()
    if (!code) continue
    byCode.set(code, r)
  }
  const base = rows.find((r) => r.baseCurrency === true)
  const baseCode = base ? String(base.code || '').trim().toUpperCase() : ''
  return { byCode, baseCode, rows }
}

async function main() {
  if (!TENANT_KEYS.includes(sourceTenant)) {
    console.error(`Invalid --source (use one of: ${TENANT_KEYS.join(', ')})`)
    process.exit(1)
  }
  if (!targetTenants.length) {
    console.error('No --targets after filtering (must differ from --source).')
    process.exit(1)
  }

  const sourceUri = getTenantUri(sourceTenant)
  if (!sourceUri) {
    console.error(`Missing URI for source tenant ${sourceTenant}`)
    process.exit(1)
  }

  const sourceConn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const sourceDb = sourceConn.getClient().db()
  const sourcePack = await loadCurrencies(sourceDb)
  console.log(`Source [${sourceTenant}] base currency: ${sourcePack.baseCode || '(none flagged)'}`)
  console.log(`Source [${sourceTenant}] active currency rows: ${sourcePack.byCode.size}`)

  for (const t of targetTenants) {
    const uri = getTenantUri(t)
    if (!uri) {
      console.warn(`Skip [${t}]: missing env URI`)
      continue
    }

    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise()
    const db = conn.getClient().db()
    const targetPack = await loadCurrencies(db)

    const baseMismatch = Boolean(
      sourcePack.baseCode && targetPack.baseCode && sourcePack.baseCode !== targetPack.baseCode,
    )
    if (baseMismatch) {
      console.warn(
        `[${t}] Base currency differs from source (${targetPack.baseCode} vs ${sourcePack.baseCode}).`
        + ' Skipping rate sync (rates are not comparable); fix base setup manually, then re-run.',
      )
    }

    const updates = []
    for (const [code, srcRow] of sourcePack.byCode) {
      const tgtRow = targetPack.byCode.get(code)
      if (!tgtRow) {
        updates.push({ code, action: 'missing_on_target', sourceRate: srcRow.exchangeRate })
        continue
      }
      const srcRate = Number(srcRow.exchangeRate)
      const tgtRate = Number(tgtRow.exchangeRate)
      if (!Number.isFinite(srcRate) || srcRate <= 0) {
        updates.push({ code, action: 'skip_invalid_source_rate', sourceRate: srcRow.exchangeRate })
        continue
      }
      if (Math.abs(srcRate - tgtRate) < 1e-12) {
        updates.push({ code, action: 'unchanged', rate: srcRate })
        continue
      }
      updates.push({
        code,
        action: srcRow.baseCurrency ? 'set_base_rate' : 'set_rate',
        from: tgtRate,
        to: srcRow.baseCurrency ? 1 : srcRate,
      })
    }

    const actionable = updates.filter((u) => u.action === 'set_rate' || u.action === 'set_base_rate')
    const missing = updates.filter((u) => u.action === 'missing_on_target')
    const actionableEffective = baseMismatch ? [] : actionable

    console.log(`\n--- Target [${t}] ---`)
    console.log(`Base currency: ${targetPack.baseCode || '(none flagged)'}`)
    if (baseMismatch && actionable.length) {
      console.log(`  (suppressed ${actionable.length} rate diff(s) — incompatible base currencies)`)
    }
    console.log(`Would update ${actionableEffective.length} row(s); missing on target: ${missing.length}`)
    for (const u of actionableEffective.slice(0, 40)) {
      console.log(`  ${u.code}: ${u.from} -> ${u.to} (${u.action})`)
    }
    if (actionableEffective.length > 40) console.log(`  ... and ${actionableEffective.length - 40} more`)
    for (const u of missing.slice(0, 15)) {
      console.log(`  (missing) ${u.code} sourceRate=${u.sourceRate}`)
    }
    if (missing.length > 15) console.log(`  ... and ${missing.length - 15} more missing`)

    if (APPLY && actionableEffective.length && !baseMismatch) {
      let n = 0
      for (const u of actionableEffective) {
        const setRate = u.action === 'set_base_rate' ? 1 : u.to
        const res = await db.collection('currencies').updateOne(
          { code: u.code, isActive: { $ne: false } },
          {
            $set: {
              exchangeRate: setRate,
              rateUpdatedAt: new Date(),
              updatedAt: new Date(),
            },
          },
        )
        n += res.modifiedCount || 0
      }
      console.log(`[${t}] Applied updates: ${n} document(s) modified.`)
    }

    await conn.close()
  }

  await sourceConn.close()

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write exchangeRate changes to target DBs.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
