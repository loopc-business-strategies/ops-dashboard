/**
 * backfill-jv-ledger-base-to-fc.js
 *
 * CLI wrapper for services/jvLedgerFxBackfill.js (same logic as POST …/ledger/repair-jv-fx).
 *
 * Usage:
 *   cd backend && node scripts/backfill-jv-ledger-base-to-fc.js --tenant=mg --dry-run
 *   cd backend && node scripts/backfill-jv-ledger-base-to-fc.js --tenant=mg --apply --reason="..." --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
 *
 * Optional: --mode=coa|force  --currency=UZS (force mode)  --verbose
 */
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
require('./destructive/_destructive-guard')({ scriptName: __filename, allowDryRunNoApply: isDryRun })

require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { runJvLedgerFxBackfillOnNativeDb } = require('../services/jvLedgerFxBackfill')

dns.setServers(['8.8.8.8', '1.1.1.1'])

const readArgValue = (name) => {
  const exactPrefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)
  const idx = args.indexOf(name)
  if (idx >= 0) return args[idx + 1] || ''
  return ''
}

const tenantKey = readArgValue('--tenant') || readArgValue('-t')
const mode = String(readArgValue('--mode') || 'coa').toLowerCase()
const forceCurrency = String(readArgValue('--currency') || '').trim().toUpperCase()
const verbose = args.includes('--verbose')

const TENANT_URIS = {
  mg: process.env.MONGO_URI_MG,
  cg: process.env.MONGO_URI_CG,
  loopc: process.env.MONGO_URI_LOOPC,
}

async function runTenant(uri, tenantName) {
  console.log(`\n=== Tenant: ${tenantName} ===`)
  const conn = await mongoose.createConnection(uri, { autoIndex: false }).asPromise()
  const db = conn.db
  try {
    const result = await runJvLedgerFxBackfillOnNativeDb(db, {
      dryRun: isDryRun,
      mode,
      forceCurrency,
      verbose,
    })
    console.log(`Base currency: ${result.baseCurrencyCode}`)
    console.log(`Candidate JV/bank_jv rows (base + rate 1): ${result.candidateRows}`)
    if (result.updateSamples?.length) {
      for (const s of result.updateSamples.slice(0, 15)) {
        console.log(
          `  [${isDryRun ? 'DRY-RUN' : 'UPDATED'}] _id=${s.id} ref=${s.refKey} ${s.baseEquiv} ${result.baseCurrencyCode} → amount=${s.fcAmount} ${s.fc} × ${s.rate}`,
        )
      }
      if (result.updateSamples.length > 15) console.log(`  … and ${result.updateSamples.length - 15} more`)
    }
    console.log(`\nDone. ${isDryRun ? 'Would update' : 'Updated'}: ${result.updated}  Skipped line-events: ${result.skipped}`)
    if (result.skipped && Object.keys(result.skipReasons || {}).length) {
      console.log('Skip breakdown:', result.skipReasons)
    }
    if (result.skipSamples?.length) {
      console.log('Skip samples:', result.skipSamples)
    }
  } finally {
    await conn.close()
  }
}

async function main() {
  if (isDryRun) console.log('*** DRY RUN — no writes ***\n')

  const tenantsToProcess =
    String(tenantKey).toLowerCase() === 'all'
      ? Object.keys(TENANT_URIS)
      : [String(tenantKey).toLowerCase()]

  for (const key of tenantsToProcess) {
    const uri = TENANT_URIS[key]
    if (!uri) {
      console.warn(`[SKIP] Tenant "${key}": no URI in .env (MONGO_URI_${key.toUpperCase()})`)
      continue
    }
    await runTenant(uri, key.toUpperCase())
  }

  console.log('\nBackfill JV ledger (base → FC) complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err)
  if (err.code === 'FORCE_CURRENCY_REQUIRED') process.exit(1)
  if (err.code === 'INVALID_MODE') process.exit(1)
  process.exit(1)
})
