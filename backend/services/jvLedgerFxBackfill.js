/**
 * Rewrites legacy journal / bank_jv ledger rows stored as base currency + exchangeRate 1
 * (amount already in base) to foreign-currency amount + master exchangeRate, preserving
 * amount × exchangeRate (base equivalent).
 *
 * Used by scripts/backfill-jv-ledger-base-to-fc.js and POST …/ledger/repair-jv-fx/* routes.
 */

const SOM_NARRATION_RE = /(?:\d[\d,]*\s*)?(?:k|m|mil|million)\s*soms?\b|\b\d[\d,]*\s*soms?\b|\bsoms?\b|\buzs\b|\bsum\b(?!\w)/i

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

const inferFcForGroup = (group, coaById, baseCurrencyCode, mode, forceCurrency) => {
  if (String(mode || 'coa').toLowerCase() === 'force') {
    return normalizeLedgerCurrency(forceCurrency, baseCurrencyCode)
  }
  let fc = inferFcFromCoaMajority(group, coaById, baseCurrencyCode)
  if (!fc) {
    const blob = group.map((e) => `${e.description || ''} ${e.notes || ''}`).join('\n')
    if (SOM_NARRATION_RE.test(blob)) fc = 'UZS'
  }
  return fc
}

/**
 * @param {import('mongodb').Db} db - Tenant MongoDB database (e.g. TenantLedger.db)
 * @param {object} options
 * @param {boolean} [options.dryRun=true]
 * @param {'coa'|'force'} [options.mode='coa']
 * @param {string} [options.forceCurrency=''] — required when mode=force
 * @param {boolean} [options.verbose=false] — reserved for script logging
 * @returns {Promise<{
 *   baseCurrencyCode: string,
 *   candidateRows: number,
 *   updated: number,
 *   skipped: number,
 *   skipReasons: Record<string, number>,
 *   skipSamples: Array<{ refKey: string, reason: string, detail?: string }>,
 *   updateSamples: Array<{ id: string, refKey: string, baseEquiv: number, fcAmount: number, fc: string, rate: number }>,
 * }>}
 */
async function runJvLedgerFxBackfillOnNativeDb(db, options = {}) {
  const dryRun = options.dryRun !== false
  const mode = String(options.mode || 'coa').toLowerCase()
  const forceCurrency = String(options.forceCurrency || '').trim().toUpperCase()
  const verbose = Boolean(options.verbose)

  if (mode !== 'coa' && mode !== 'force') {
    const err = new Error('INVALID_MODE')
    err.code = 'INVALID_MODE'
    throw err
  }
  if (mode === 'force' && !forceCurrency) {
    const err = new Error('FORCE_CURRENCY_REQUIRED')
    err.code = 'FORCE_CURRENCY_REQUIRED'
    throw err
  }

  const baseCurrencyDoc = await db.collection('currencies').findOne({ baseCurrency: true, isActive: true })
  const baseCurrencyCode = String(baseCurrencyDoc?.code || 'USD').toUpperCase()

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

  const byRef = new Map()
  for (const e of toFix) {
    const key = e.referenceId ? String(e.referenceId) : `__single_${String(e._id)}`
    if (!byRef.has(key)) byRef.set(key, [])
    byRef.get(key).push(e)
  }

  let updateCount = 0
  let skipCount = 0
  const skipReasons = {}
  const skipSamples = []
  const skipSampleKeys = new Set()
  const updateSamples = []

  const bump = (reason) => {
    skipCount += 1
    skipReasons[reason] = (skipReasons[reason] || 0) + 1
  }

  const pushSkipSample = (refKey, reason, detail) => {
    const k = `${refKey}:${reason}`
    if (skipSampleKeys.has(k) || skipSamples.length >= 22) return
    skipSampleKeys.add(k)
    skipSamples.push({ refKey, reason, detail })
  }

  for (const [refKey, group] of byRef) {
    let fcCurrency = inferFcForGroup(group, coaById, baseCurrencyCode, mode, forceCurrency)

    if (mode === 'force' && (!fcCurrency || fcCurrency === baseCurrencyCode)) {
      for (const e of group) bump('force_currency_invalid')
      pushSkipSample(refKey, 'force_currency_invalid', `forceCurrency=${forceCurrency || '(empty)'}`)
      continue
    }

    if (!fcCurrency) {
      const e0 = group[0]
      const dr = coaById.get(String(e0.debitAccountId))
      const cr = coaById.get(String(e0.creditAccountId))
      pushSkipSample(
        refKey,
        'coa_all_base_or_ambiguous_fc',
        `lines=${group.length} debit=${dr?.accountCode || '?'} cur=${dr?.currency ?? ''} credit=${cr?.accountCode || '?'} cur=${cr?.currency ?? ''}`,
      )
      for (const e of group) bump('coa_all_base_or_ambiguous_fc')
      continue
    }

    if (fcCurrency === baseCurrencyCode) {
      for (const e of group) bump('inferred_fc_is_base')
      continue
    }

    const rate = rateMap[fcCurrency]
    if (!Number.isFinite(rate) || rate <= 0) {
      for (const e of group) bump(`missing_fx_${fcCurrency}`)
      pushSkipSample(refKey, `missing_fx_${fcCurrency}`, `No active ${fcCurrency} rate in currencies`)
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

      if (dryRun) {
        if (updateSamples.length < 25) {
          updateSamples.push({
            id: String(e._id),
            refKey,
            baseEquiv,
            fcAmount,
            fc: fcCurrency,
            rate,
          })
        }
      } else {
        await db.collection('ledgers').updateOne(
          { _id: e._id },
          { $set: { amount: fcAmount, currency: fcCurrency, exchangeRate: rate } },
        )
      }
      updateCount += 1
    }
  }

  return {
    baseCurrencyCode,
    candidateRows: toFix.length,
    updated: updateCount,
    skipped: skipCount,
    skipReasons,
    skipSamples: skipSamples.filter((s) => s.reason),
    updateSamples,
    dryRun,
    mode,
  }
}

module.exports = {
  runJvLedgerFxBackfillOnNativeDb,
  normalizeLedgerCurrency,
  isBaseCurrencyRow,
}
