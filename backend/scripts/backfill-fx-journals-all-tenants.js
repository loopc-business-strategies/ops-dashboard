require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const APPLY = process.argv.includes('--apply')
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))
const MODE = (modeArg ? modeArg.split('=')[1] : 'rate').trim().toLowerCase()
const VALID_MODES = new Set(['rate', 'pair'])
const EPSILON = 0.01

if (!VALID_MODES.has(MODE)) {
  console.error(`Invalid mode: ${MODE}. Use --mode=rate or --mode=pair`)
  process.exit(1)
}

const toMoney = (value) => Number(Number(value || 0).toFixed(2))

const tenantUris = [
  { name: 'MG', uri: process.env.MONGO_URI_MG },
  { name: 'CG', uri: process.env.MONGO_URI_CG },
  { name: 'LoopC', uri: process.env.MONGO_URI_LOOPC },
].filter((t) => !!t.uri)

const parseReferenceRate = (voucherMeta) => {
  const line = voucherMeta?.lineItems?.[0] || {}
  const rate = Number(
    voucherMeta?.referenceExchangeRate
    || voucherMeta?.invoiceExchangeRate
    || voucherMeta?.currRate
    || voucherMeta?.rate
    || line?.referenceRate
    || line?.currRate
    || line?.rate
    || 0
  )
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

const parseForeignAmount = (tx) => {
  const line = tx?.voucherMeta?.lineItems?.[0] || {}
  const fcAmount = Number(
    line?.amountFC
    || line?.amountFc
    || line?.amtFc
    || line?.headerAmt
    || 0
  )
  if (Number.isFinite(fcAmount) && fcAmount > 0) return fcAmount

  const amount = Number(tx?.amount || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

const parseVoucherCurrency = (tx) => {
  const line = tx?.voucherMeta?.lineItems?.[0] || {}
  return String(tx?.voucherMeta?.currCode || tx?.voucherMeta?.curr || line?.currCode || line?.curr || tx?.currency || 'USD').trim().toUpperCase()
}

const parseBaseSettlementAmount = (tx, baseCurrencyCode) => {
  const line = tx?.voucherMeta?.lineItems?.[0] || {}

  const lcAmount = Number(
    line?.amountLC
    || line?.amountLc
    || line?.amtLC
    || line?.amtLc
    || 0
  )
  if (Number.isFinite(lcAmount) && lcAmount > 0) return toMoney(lcAmount)

  const voucherCurrencyCode = parseVoucherCurrency(tx)
  const foreignAmount = parseForeignAmount(tx)
  const lineRate = Number(
    line?.currRate
    || line?.rate
    || tx?.voucherMeta?.currRate
    || tx?.voucherMeta?.rate
    || 0
  )

  if (voucherCurrencyCode === String(baseCurrencyCode || 'USD').toUpperCase() && foreignAmount > 0) {
    return toMoney(foreignAmount)
  }

  if (foreignAmount > 0 && Number.isFinite(lineRate) && lineRate > 0) {
    return toMoney(foreignAmount * lineRate)
  }

  const amount = Number(tx?.amount || 0)
  const exchangeRate = Number(tx?.exchangeRate || 1)
  if (Number.isFinite(amount) && amount > 0 && Number.isFinite(exchangeRate) && exchangeRate > 0) {
    return toMoney(amount * exchangeRate)
  }

  return 0
}

const ensureFallbackAccounts = async ({ db, baseCurrencyCode }) => {
  const chart = db.collection('chartofaccounts')

  const [gain, loss, bank] = await Promise.all([
    chart.findOne({ accountCode: '4190', isDeleted: { $ne: true } }),
    chart.findOne({ accountCode: '5190', isDeleted: { $ne: true } }),
    chart.findOne({ accountCode: '1010', isDeleted: { $ne: true } }),
  ])

  const missing = []
  if (!gain) missing.push('4190 Exchange Gain')
  if (!loss) missing.push('5190 Exchange Loss')
  if (!bank) missing.push('1010 Bank/Cash')

  if (missing.length) {
    throw new Error(`Missing fallback account(s): ${missing.join(', ')}`)
  }

  return {
    gainId: gain._id,
    lossId: loss._id,
    bankId: bank._id,
    baseCurrencyCode,
  }
}

const resolveExchangeAccounts = async ({ db, isGain, fallback }) => {
  const mappingType = isGain ? 'exchange_gain' : 'exchange_loss'
  const mapping = await db.collection('accountmappings').findOne({ mappingType, isActive: true })

  if (mapping?.debitAccountId && mapping?.creditAccountId) {
    const chart = db.collection('chartofaccounts')
    const [debit, credit] = await Promise.all([
      chart.findOne({ _id: mapping.debitAccountId, isDeleted: { $ne: true }, isActive: { $ne: false } }, { projection: { _id: 1 } }),
      chart.findOne({ _id: mapping.creditAccountId, isDeleted: { $ne: true }, isActive: { $ne: false } }, { projection: { _id: 1 } }),
    ])

    if (debit && credit) {
      return {
        debitAccountId: mapping.debitAccountId,
        creditAccountId: mapping.creditAccountId,
        source: `mapping:${mappingType}`,
      }
    }
  }

  return isGain
    ? { debitAccountId: fallback.bankId, creditAccountId: fallback.gainId, source: 'fallback:1010/4190' }
    : { debitAccountId: fallback.lossId, creditAccountId: fallback.bankId, source: 'fallback:5190/1010' }
}

const hasFxJournal = async ({ db, txId }) => {
  const fxJournal = await db.collection('ledgers').findOne({
    referenceType: 'journal',
    referenceId: txId,
    isDeleted: { $ne: true },
    description: /exchange/i,
  }, { projection: { _id: 1 } })
  return !!fxJournal
}

const pickActor = (tx) => tx?.updatedBy || tx?.postedBy || tx?.createdBy

const processTenantByRateMode = async ({ db, baseCurrencyCode, fallback, name }) => {
  const txCursor = db.collection('transactions').find(
    {
      type: { $in: ['receipt', 'payment'] },
      status: 'posted',
      isDeleted: { $ne: true },
    },
    {
      projection: {
        _id: 1,
        type: 1,
        amount: 1,
        exchangeRate: 1,
        currency: 1,
        date: 1,
        createdBy: 1,
        updatedBy: 1,
        postedBy: 1,
        voucherMeta: 1,
      },
    }
  )

  const stats = {
    tenant: name,
    mode: 'rate',
    scanned: 0,
    noReferenceRate: 0,
    alreadyHasFxJournal: 0,
    noDifference: 0,
    queued: 0,
    inserted: 0,
    skippedByCurrency: 0,
    failures: 0,
  }

  while (await txCursor.hasNext()) {
    const tx = await txCursor.next()
    stats.scanned += 1

    try {
      const referenceRate = parseReferenceRate(tx.voucherMeta)
      if (!referenceRate) {
        stats.noReferenceRate += 1
        continue
      }

      const voucherCurrencyCode = parseVoucherCurrency(tx)
      if (voucherCurrencyCode === baseCurrencyCode) {
        stats.skippedByCurrency += 1
        continue
      }

      if (await hasFxJournal({ db, txId: tx._id })) {
        stats.alreadyHasFxJournal += 1
        continue
      }

      const amountInBase = toMoney(Number(tx.amount || 0) * Number(tx.exchangeRate || 1))
      const foreignAmount = parseForeignAmount(tx)
      const expectedBaseAmount = toMoney(foreignAmount * referenceRate)
      const diff = toMoney(amountInBase - expectedBaseAmount)

      if (Math.abs(diff) < EPSILON) {
        stats.noDifference += 1
        continue
      }

      const isGain = String(tx.type).toLowerCase() === 'payment' ? diff < 0 : diff > 0
      const resolved = await resolveExchangeAccounts({ db, isGain, fallback })

      const payload = {
        date: tx.voucherMeta?.valueDate || tx.date || new Date(),
        debitAccountId: resolved.debitAccountId,
        creditAccountId: resolved.creditAccountId,
        amount: toMoney(Math.abs(diff)),
        description: `Exchange ${isGain ? 'gain' : 'loss'} adjustment for transaction ${tx._id}`,
        referenceType: 'journal',
        referenceId: tx._id,
        createdBy: pickActor(tx),
        updatedBy: pickActor(tx),
        department: '',
        currency: baseCurrencyCode,
        exchangeRate: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: `FX backfill (${resolved.source}, mode=rate)`,
      }

      stats.queued += 1

      if (APPLY) {
        await db.collection('ledgers').insertOne(payload)
        stats.inserted += 1
      }
    } catch (err) {
      stats.failures += 1
      console.error(`[${name}] tx ${String(tx._id)} failed: ${err.message}`)
    }
  }

  return stats
}

const buildPairKey = (tx) => {
  const voucher = tx?.voucherMeta || {}
  const line = voucher?.lineItems?.[0] || {}

  const party = String(voucher.partyCode || voucher.partyName || tx.customerId || tx.vendorId || '').trim().toUpperCase()
  const txCurrency = String(tx.currency || 'USD').trim().toUpperCase()
  const lineCurrency = parseVoucherCurrency(tx)
  const foreignAmount = toMoney(parseForeignAmount(tx))
  const refNo = String(voucher.refNo || '').trim().toUpperCase()
  const vocNo = String(voucher.vocNo || '').trim().toUpperCase()
  const vatRef = String(line.vatRef || '').trim().toUpperCase()

  const refPart = refNo || vocNo || vatRef || 'N/A'
  const partyPart = party || 'N/A'

  return `${partyPart}|${refPart}|${txCurrency}|${lineCurrency}|${foreignAmount}`
}

const processTenantByPairMode = async ({ db, baseCurrencyCode, fallback, name }) => {
  const txs = await db.collection('transactions').find(
    {
      type: { $in: ['receipt', 'payment'] },
      status: 'posted',
      isDeleted: { $ne: true },
    },
    {
      projection: {
        _id: 1,
        type: 1,
        amount: 1,
        exchangeRate: 1,
        currency: 1,
        date: 1,
        customerId: 1,
        vendorId: 1,
        createdBy: 1,
        updatedBy: 1,
        postedBy: 1,
        voucherMeta: 1,
      },
    }
  ).sort({ date: 1, _id: 1 }).toArray()

  const stats = {
    tenant: name,
    mode: 'pair',
    scanned: txs.length,
    candidatePairs: 0,
    fallbackPairs: 0,
    alreadyHasFxJournal: 0,
    noDifference: 0,
    queued: 0,
    inserted: 0,
    ambiguous: 0,
    failures: 0,
  }

  const processPair = async (receipt, payment) => {
    const [receiptHasFx, paymentHasFx] = await Promise.all([
      hasFxJournal({ db, txId: receipt._id }),
      hasFxJournal({ db, txId: payment._id }),
    ])

    if (receiptHasFx || paymentHasFx) {
      stats.alreadyHasFxJournal += 1
      return
    }

    const receiptBase = parseBaseSettlementAmount(receipt, baseCurrencyCode)
    const paymentBase = parseBaseSettlementAmount(payment, baseCurrencyCode)
    const diff = toMoney(receiptBase - paymentBase)

    if (Math.abs(diff) < EPSILON) {
      stats.noDifference += 1
      return
    }

    const isGain = diff > 0
    const resolved = await resolveExchangeAccounts({ db, isGain, fallback })

    const payload = {
      date: payment?.voucherMeta?.valueDate || payment?.date || receipt?.date || new Date(),
      debitAccountId: resolved.debitAccountId,
      creditAccountId: resolved.creditAccountId,
      amount: toMoney(Math.abs(diff)),
      description: `Exchange ${isGain ? 'gain' : 'loss'} settlement adjustment pair receipt ${receipt._id} vs payment ${payment._id}`,
      referenceType: 'journal',
      referenceId: payment._id,
      createdBy: pickActor(payment) || pickActor(receipt),
      updatedBy: pickActor(payment) || pickActor(receipt),
      department: '',
      currency: baseCurrencyCode,
      exchangeRate: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: `FX backfill (${resolved.source}, mode=pair, counterpart=${receipt._id})`,
    }

    stats.queued += 1

    if (APPLY) {
      await db.collection('ledgers').insertOne(payload)
      stats.inserted += 1
    }
  }

  const buckets = new Map()
  for (const tx of txs) {
    const key = buildPairKey(tx)
    const bucket = buckets.get(key) || { receipts: [], payments: [] }
    if (String(tx.type).toLowerCase() === 'receipt') bucket.receipts.push(tx)
    if (String(tx.type).toLowerCase() === 'payment') bucket.payments.push(tx)
    buckets.set(key, bucket)
  }

  for (const [, bucket] of buckets.entries()) {
    if (!bucket.receipts.length || !bucket.payments.length) continue

    if (bucket.receipts.length !== bucket.payments.length) {
      stats.ambiguous += 1
      continue
    }

    stats.candidatePairs += bucket.receipts.length

    for (let i = 0; i < bucket.receipts.length; i += 1) {
      const receipt = bucket.receipts[i]
      const payment = bucket.payments[i]

      try {
        await processPair(receipt, payment)
      } catch (err) {
        stats.failures += 1
        console.error(`[${name}] pair failed receipt ${String(receipt._id)} payment ${String(payment._id)}: ${err.message}`)
      }
    }
  }

  // Fallback matcher: same tx amount/currency and same voucher line currency, opposite types.
  if (!stats.candidatePairs) {
    const receipts = txs.filter((tx) => String(tx.type).toLowerCase() === 'receipt')
    const payments = txs.filter((tx) => String(tx.type).toLowerCase() === 'payment')
    const usedPaymentIds = new Set()

    for (const receipt of receipts) {
      const receiptAmount = toMoney(receipt.amount)
      const receiptCurrency = String(receipt.currency || 'USD').toUpperCase()
      const receiptLineCurrency = parseVoucherCurrency(receipt)

      const payment = payments.find((p) => {
        if (usedPaymentIds.has(String(p._id))) return false
        const amountMatch = toMoney(p.amount) === receiptAmount
        const txCurrMatch = String(p.currency || 'USD').toUpperCase() === receiptCurrency
        const lineCurrMatch = parseVoucherCurrency(p) === receiptLineCurrency
        return amountMatch && txCurrMatch && lineCurrMatch
      })

      if (!payment) continue
      usedPaymentIds.add(String(payment._id))
      stats.fallbackPairs += 1

      try {
        await processPair(receipt, payment)
      } catch (err) {
        stats.failures += 1
        console.error(`[${name}] fallback pair failed receipt ${String(receipt._id)} payment ${String(payment._id)}: ${err.message}`)
      }
    }
  }

  return stats
}

const processTenant = async ({ name, uri }) => {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 12000 }).asPromise()
  const db = conn.getClient().db()

  try {
    const baseCurrency = await db.collection('currencies').findOne({ baseCurrency: true, isActive: true }, { projection: { code: 1 } })
    const baseCurrencyCode = String(baseCurrency?.code || 'USD').toUpperCase()
    const fallback = await ensureFallbackAccounts({ db, baseCurrencyCode })

    if (MODE === 'pair') {
      return await processTenantByPairMode({ db, baseCurrencyCode, fallback, name })
    }

    return await processTenantByRateMode({ db, baseCurrencyCode, fallback, name })
  } finally {
    await conn.close()
  }
}

const printStats = (stats) => {
  if (stats.mode === 'pair') {
    console.log(`  scanned             : ${stats.scanned}`)
    console.log(`  candidate pairs     : ${stats.candidatePairs}`)
    console.log(`  fallback pairs      : ${stats.fallbackPairs}`)
    console.log(`  ambiguous buckets   : ${stats.ambiguous}`)
    console.log(`  has FX journal      : ${stats.alreadyHasFxJournal}`)
    console.log(`  no diff             : ${stats.noDifference}`)
    console.log(`  queued              : ${stats.queued}`)
    console.log(`  inserted            : ${stats.inserted}`)
    console.log(`  failures            : ${stats.failures}`)
    return
  }

  console.log(`  scanned             : ${stats.scanned}`)
  console.log(`  no reference rate   : ${stats.noReferenceRate}`)
  console.log(`  base-currency skip  : ${stats.skippedByCurrency}`)
  console.log(`  already has FX jrnl : ${stats.alreadyHasFxJournal}`)
  console.log(`  no diff             : ${stats.noDifference}`)
  console.log(`  queued              : ${stats.queued}`)
  console.log(`  inserted            : ${stats.inserted}`)
  console.log(`  failures            : ${stats.failures}`)
}

const addTotals = (acc, row) => {
  Object.keys(acc).forEach((key) => {
    if (typeof acc[key] === 'number') acc[key] += Number(row[key] || 0)
  })
  return acc
}

;(async () => {
  if (!tenantUris.length) {
    throw new Error('No tenant Mongo URIs found. Expected MONGO_URI_MG / MONGO_URI_CG / MONGO_URI_LOOPC.')
  }

  console.log(`Mode: ${MODE.toUpperCase()} | ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

  const results = []
  for (const tenant of tenantUris) {
    console.log(`\nProcessing ${tenant.name}...`)
    const stats = await processTenant(tenant)
    results.push(stats)
    printStats(stats)
  }

  if (MODE === 'pair') {
    const totals = results.reduce((acc, row) => addTotals(acc, row), {
      scanned: 0,
      candidatePairs: 0,
      fallbackPairs: 0,
      ambiguous: 0,
      alreadyHasFxJournal: 0,
      noDifference: 0,
      queued: 0,
      inserted: 0,
      failures: 0,
    })

    console.log('\nSummary:')
    console.log(`  scanned             : ${totals.scanned}`)
    console.log(`  candidate pairs     : ${totals.candidatePairs}`)
    console.log(`  fallback pairs      : ${totals.fallbackPairs}`)
    console.log(`  ambiguous buckets   : ${totals.ambiguous}`)
    console.log(`  has FX journal      : ${totals.alreadyHasFxJournal}`)
    console.log(`  no diff             : ${totals.noDifference}`)
    console.log(`  queued              : ${totals.queued}`)
    console.log(`  inserted            : ${totals.inserted}`)
    console.log(`  failures            : ${totals.failures}`)
  } else {
    const totals = results.reduce((acc, row) => addTotals(acc, row), {
      scanned: 0,
      noReferenceRate: 0,
      skippedByCurrency: 0,
      alreadyHasFxJournal: 0,
      noDifference: 0,
      queued: 0,
      inserted: 0,
      failures: 0,
    })

    console.log('\nSummary:')
    console.log(`  scanned             : ${totals.scanned}`)
    console.log(`  no reference rate   : ${totals.noReferenceRate}`)
    console.log(`  base-currency skip  : ${totals.skippedByCurrency}`)
    console.log(`  already has FX jrnl : ${totals.alreadyHasFxJournal}`)
    console.log(`  no diff             : ${totals.noDifference}`)
    console.log(`  queued              : ${totals.queued}`)
    console.log(`  inserted            : ${totals.inserted}`)
    console.log(`  failures            : ${totals.failures}`)
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to insert ledgers.')
  }
})().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
