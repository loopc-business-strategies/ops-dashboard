require('dotenv').config()
const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])
const mongoose = require('mongoose')

const APPLY = String(process.env.APPLY || '').trim() === '1'
const EPSILON = 0.01

const TENANTS = [
  ['MG', process.env.MONGO_URI_MG],
  ['CG', process.env.MONGO_URI_CG],
  ['LoopC', process.env.MONGO_URI_LOOPC],
].filter(([, uri]) => Boolean(uri))

const toMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseReferenceRate = (voucherMeta = {}) => {
  const line = Array.isArray(voucherMeta.lineItems) ? voucherMeta.lineItems[0] || {} : {}
  const value = parseNumber(
    line.referenceRate
      || voucherMeta.referenceExchangeRate
      || voucherMeta.invoiceExchangeRate
      || 0,
    0,
  )
  return value > 0 ? value : 0
}

const parseLineRate = (tx = {}, voucherMeta = {}) => {
  const line = Array.isArray(voucherMeta.lineItems) ? voucherMeta.lineItems[0] || {} : {}
  const value = parseNumber(line.currRate || tx.exchangeRate || 0, 0)
  return value > 0 ? value : 0
}

const parseForeignAmount = (tx = {}, voucherMeta = {}) => {
  const line = Array.isArray(voucherMeta.lineItems) ? voucherMeta.lineItems[0] || {} : {}
  return parseNumber(
    line.amountFC
      || line.amountFc
      || line.amtFc
      || line.headerAmt
      || 0,
    0,
  )
}

const getFxJournals = async (db, txId) => db.collection('ledgers').find({
  referenceId: txId,
  referenceType: 'journal',
  isDeleted: { $ne: true },
  description: /Exchange (gain|loss) adjustment/i,
}).toArray()

async function processTenant(name, uri) {
  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 15000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const txs = await db.collection('transactions').find({
      type: { $in: ['receipt', 'payment'] },
      status: 'posted',
      isDeleted: { $ne: true },
    }, {
      projection: {
        _id: 1,
        type: 1,
        amount: 1,
        exchangeRate: 1,
        voucherMeta: 1,
      },
    }).toArray()

    const stats = {
      scanned: 0,
      missingReference: 0,
      missingJournals: 0,
      unchanged: 0,
      updated: 0,
      skippedDirection: 0,
      failures: 0,
    }

    console.log(`\n=== ${name} ===`)

    for (const tx of txs) {
      stats.scanned += 1
      try {
        const voucherMeta = tx.voucherMeta || {}
        const referenceRate = parseReferenceRate(voucherMeta)
        if (!(referenceRate > 0)) {
          stats.missingReference += 1
          continue
        }

        const lineRate = parseLineRate(tx, voucherMeta)
        const txAmount = parseNumber(tx.amount, 0)
        const foreignAmount = parseForeignAmount(tx, voucherMeta)
        const actualFC = foreignAmount > 0 ? foreignAmount : (lineRate > 0 ? txAmount / lineRate : 0)
        const expectedFC = txAmount / referenceRate
        const fcDiff = actualFC - expectedFC
        const correctedAmount = toMoney(Math.abs(fcDiff) * referenceRate)
        const isGain = String(tx.type || '').toLowerCase() === 'payment' ? fcDiff < 0 : fcDiff > 0

        if (!(correctedAmount >= EPSILON)) {
          stats.unchanged += 1
          continue
        }

        const journals = await getFxJournals(db, tx._id)
        if (!journals.length) {
          stats.missingJournals += 1
          continue
        }

        for (const journal of journals) {
          const description = String(journal.description || '').toLowerCase()
          const looksLikeGain = description.includes('exchange gain')
          const looksLikeLoss = description.includes('exchange loss')

          if ((looksLikeGain && !isGain) || (looksLikeLoss && isGain)) {
            console.log(`SKIP direction mismatch tx=${tx._id} journal=${journal._id} current=${journal.description}`)
            stats.skippedDirection += 1
            continue
          }

          const currentAmount = toMoney(parseNumber(journal.amount, 0))
          if (Math.abs(currentAmount - correctedAmount) < EPSILON) {
            stats.unchanged += 1
            continue
          }

          console.log(`${APPLY ? 'UPDATE' : 'DRY'} tx=${tx._id} journal=${journal._id} ${currentAmount.toFixed(2)} -> ${correctedAmount.toFixed(2)} refRate=${referenceRate} lineRate=${lineRate}`)

          if (APPLY) {
            await db.collection('ledgers').updateOne(
              { _id: journal._id },
              {
                $set: {
                  amount: correctedAmount,
                  updatedAt: new Date(),
                  notes: `FX journal revalued using reference rate ${referenceRate}`,
                },
              },
            )
          }

          stats.updated += 1
        }
      } catch (err) {
        stats.failures += 1
        console.error(`FAIL tx=${tx._id} ${err.message}`)
      }
    }

    console.log(`Summary ${name}:`, stats)
  } finally {
    await conn.close()
  }
}

async function main() {
  if (!TENANTS.length) {
    throw new Error('No tenant Mongo URIs found in environment')
  }

  console.log(APPLY ? 'Applying FX journal revaluation...' : 'Dry-run FX journal revaluation...')
  for (const [name, uri] of TENANTS) {
    await processTenant(name, uri)
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
