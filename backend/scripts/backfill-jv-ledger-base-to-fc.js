/**
 * backfill-jv-ledger-base-to-fc.js
 *
 * Historical MG (and other) journal / bank_jv lines were often stored as:
 *   currency = base, exchangeRate = 1, amount = base equivalent
 * even when the voucher was entered in a foreign currency (e.g. UZS).
 *
 * This script rewrites those rows to match the live API convention:
 *   base equivalent = amount * exchangeRate
 *   amount = foreign-currency units, exchangeRate = master rate (FC → base).
 *
 * Inference (default --mode=coa, recommended):
 *   For each referenceId batch (or each standalone row), tally Chart of Account
 *   `currency` on every debit and credit leg (non-base only). If there is a
 *   single distinct FC, use it. If several FCs appear, use the one with a
 *   strict majority of leg mentions; ties skip the batch.
 *
 * Override (--mode=force --currency=UZS):
 *   Applies the given FC to every candidate row (use only when COA defaults
 *   are wrong). Still preserves base via amount = (oldAmount * oldRate) / fx.
 *
 * Usage:
 *   cd backend && node scripts/backfill-jv-ledger-base-to-fc.js --tenant=mg --dry-run
 *   cd backend && node scripts/backfill-jv-ledger-base-to-fc.js --tenant=mg --apply --reason="..." --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
 *
 * Optional:
 *   --mode=coa|force
 *   --currency=UZS   (required for force mode)
 *   --verbose        log skipped batches (first line: COA account codes)
 */
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')
require('./destructive/_destructive-guard')({ scriptName: __filename, allowDryRunNoApply: isDryRun })

require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

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

const TENANT_URIS = {
  mg: process.env.MONGO_URI_MG,
  cg: process.env.MONGO_URI_CG,
  loopc: process.env.MONGO_URI_LOOPC,
}

const normalizeLedgerCurrency = (code, baseCurrencyCode) => {
  const u = String(code || '').trim().toUpperCase()
  if (['SOM', 'SOMS', 'SUM'].includes(u)) return 'UZS'
  return u || String(baseCurrencyCode || 'USD').toUpperCase()
}

const isBaseCurrencyRow = (entryCurrency, exchangeRate, baseCurrencyCode) => {
  const cur = normalizeLedgerCurrency(entryCurrency, baseCurrencyCode)
  const base = String(baseCurrencyCode || 'USD').toUpperCase()
  const rate = Number(exchangeRate)
  const rateIsOne = !Number.isFinite(rate) || Math.abs(rate - 1) < 1e-12
  return cur === base && rateIsOne
}

/**
 * Tally each debit/credit leg that carries a non-base COA currency; pick unique FC
 * or strict majority (recommended COA path).
 */
const inferFcFromCoaMajority = (group, coaById, baseCurrencyCode) => {
  const base = String(baseCurrencyCode || 'USD').toUpperCase()
  const tally = new Map()
  const bump = (raw) => {
    const trimmed = String(raw || '').trim()
    if (!trimmed) return
    const code = normalizeLedgerCurrency(trimmed, base)
    if (code === base) return
    tally.set(code, (tally.get(code) || 0) + 1)
  }

  for (const e of group) {
    const dr = coaById.get(String(e.debitAccountId))
    const cr = coaById.get(String(e.creditAccountId))
    if (dr?.currency != null) bump(dr.currency)
    if (cr?.currency != null) bump(cr.currency)
  }

  if (tally.size === 0) return null
  if (tally.size === 1) return [...tally.keys()][0]

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1])
  if (sorted[0][1] > sorted[1][1]) return sorted[0][0]
  return null
}

async function backfillTenant(uri, tenantName) {
  console.log(`\n=== Tenant: ${tenantName} ===`)
  if (mode === 'force' && !forceCurrency) {
    console.error('[blocked] --mode=force requires --currency=CODE (e.g. UZS)')
    process.exit(1)
  }
  if (mode !== 'coa' && mode !== 'force') {
    console.error('[blocked] --mode must be coa or force')
    process.exit(1)
  }

  const conn = await mongoose.createConnection(uri, { autoIndex: false }).asPromise()
  const db = conn.db

  try {
    const baseCurrencyDoc = await db.collection('currencies').findOne({ baseCurrency: true, isActive: true })
    const baseCurrencyCode = String(baseCurrencyDoc?.code || 'USD').toUpperCase()
    console.log(`Base currency: ${baseCurrencyCode}`)

    const allCurrencies = await db.collection('currencies').find({ isActive: true }).toArray()
    const rateMap = {}
    for (const c of allCurrencies) {
      const code = normalizeLedgerCurrency(c.code, baseCurrencyCode)
      rateMap[code] = Number(c.exchangeRate || 0)
    }

    const coaDocs = await db.collection('chartofaccounts').find({}).project({ currency: 1, accountCode: 1 }).toArray()
    const coaById = new Map(coaDocs.map((d) => [String(d._id), d]))

    const candidateFilter = {
      isDeleted: { $ne: true },
      referenceType: { $in: ['journal', 'bank_jv'] },
    }

    const candidates = await db.collection('ledgers').find(candidateFilter).toArray()
    const toFix = candidates.filter((e) =>
      isBaseCurrencyRow(e.currency, e.exchangeRate, baseCurrencyCode))

    console.log(`Candidate JV/bank_jv rows (base + rate 1): ${toFix.length}`)

    const byRef = new Map()
    for (const e of toFix) {
      const key = e.referenceId ? String(e.referenceId) : `__single_${String(e._id)}`
      if (!byRef.has(key)) byRef.set(key, [])
      byRef.get(key).push(e)
    }

    let updateCount = 0
    let skipCount = 0
    const skipReasons = {}
    const verboseSkipLogged = new Set()

    const bump = (reason) => {
      skipCount += 1
      skipReasons[reason] = (skipReasons[reason] || 0) + 1
    }

    for (const [refKey, group] of byRef) {
      let fcCurrency = null
      if (mode === 'force') {
        fcCurrency = normalizeLedgerCurrency(forceCurrency, baseCurrencyCode)
      } else {
        fcCurrency = inferFcFromCoaMajority(group, coaById, baseCurrencyCode)
        if (!fcCurrency) {
          if (verbose && group[0] && !verboseSkipLogged.has(refKey)) {
            verboseSkipLogged.add(refKey)
            const e0 = group[0]
            const dr = coaById.get(String(e0.debitAccountId))
            const cr = coaById.get(String(e0.creditAccountId))
            console.log(
              `  [SKIP detail] ref=${refKey} lines=${group.length} debit=${dr?.accountCode || '?'} cur=${dr?.currency || ''} credit=${cr?.accountCode || '?'} cur=${cr?.currency || ''}`,
            )
          }
          for (const e of group) bump('coa_all_base_or_ambiguous_fc')
          continue
        }
      }

      if (fcCurrency === baseCurrencyCode) {
        for (const e of group) bump('inferred_fc_is_base')
        continue
      }

      const rate = rateMap[fcCurrency]
      if (!Number.isFinite(rate) || rate <= 0) {
        console.warn(`  [SKIP batch ${refKey}] No active FX for ${fcCurrency} in currencies collection`)
        for (const e of group) bump(`missing_fx_${fcCurrency}`)
        continue
      }

      for (const e of group) {
        const baseEquiv = Number(e.amount || 0) * Number(e.exchangeRate == null ? 1 : e.exchangeRate)
        if (!Number.isFinite(baseEquiv) || baseEquiv <= 0) {
          bump('invalid_amount')
          continue
        }

        const fcAmount = baseEquiv / rate
        if (!Number.isFinite(fcAmount) || fcAmount <= 0) {
          bump('invalid_fc_amount')
          continue
        }

        const product = fcAmount * rate
        if (Math.abs(product - baseEquiv) > Math.max(1e-6, Math.abs(baseEquiv) * 1e-9)) {
          bump('fx_roundtrip_drift')
          continue
        }

        if (isDryRun) {
          console.log(
            `  [DRY-RUN] _id=${e._id} ref=${refKey} ${baseEquiv} ${baseCurrencyCode} → amount=${fcAmount} ${fcCurrency} × ${rate}`,
          )
        } else {
          await db.collection('ledgers').updateOne(
            { _id: e._id },
            { $set: { amount: fcAmount, currency: fcCurrency, exchangeRate: rate } },
          )
        }
        updateCount += 1
      }
    }

    console.log(`\nDone. ${isDryRun ? 'Would update' : 'Updated'}: ${updateCount}  Skipped lines: ${skipCount}`)
    if (skipCount && Object.keys(skipReasons).length) {
      console.log('Skip breakdown:', skipReasons)
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
    await backfillTenant(uri, key.toUpperCase())
  }

  console.log('\nBackfill JV ledger (base → FC) complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
