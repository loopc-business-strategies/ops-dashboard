require('dotenv').config()
const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])
const mongoose = require('mongoose')

const DEFAULT_TARGETS = [
  { txId: '69fcd5e36e9d4942bc0b42db', journalId: '69fcd6056e9d4942bc0b43e1', historicalBefore: 72.29 },
  { txId: '69fcd3e76e9d4942bc0b3d82', journalId: '69fcd48c6e9d4942bc0b4042', historicalBefore: 3.61 },
  { txId: '69fc8b026e9d4942bc0b3270', journalId: '69fcd1016e9d4942bc0b394e', historicalBefore: 11.57 },
]

const TENANTS = [
  ['MG', process.env.MONGO_URI_MG],
  ['CG', process.env.MONGO_URI_CG],
  ['LoopC', process.env.MONGO_URI_LOOPC],
].filter(([, uri]) => Boolean(uri))

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toMoney = (value) => Math.round((parseNumber(value) + Number.EPSILON) * 100) / 100

const resolveTargets = () => {
  const raw = String(process.env.FX_TRACE_TARGETS || '').trim()
  if (!raw) return DEFAULT_TARGETS

  return raw.split(',').map((entry) => {
    const [txId, journalId, historicalBefore] = entry.split(':').map((part) => String(part || '').trim())
    return {
      txId,
      journalId,
      historicalBefore: historicalBefore ? parseNumber(historicalBefore, 0) : null,
    }
  }).filter((entry) => entry.txId)
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

async function loadAccounts(db, ledgers) {
  const ids = [...new Set(
    ledgers
      .flatMap((row) => [row.debitAccountId, row.creditAccountId])
      .filter(Boolean)
      .map((id) => String(id))
  )]

  if (!ids.length) return {}

  const accounts = await db.collection('chartofaccounts').find(
    { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
    { projection: { _id: 1, accountCode: 1, accountName: 1 } },
  ).toArray()

  return Object.fromEntries(accounts.map((account) => [
    String(account._id),
    `${account.accountCode || '?'} ${account.accountName || ''}`.trim(),
  ]))
}

async function traceTenant(name, uri, targets) {
  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 15000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const txIds = targets.map((target) => new mongoose.Types.ObjectId(target.txId))
    const transactions = await db.collection('transactions').find(
      { _id: { $in: txIds } },
      {
        projection: {
          _id: 1,
          type: 1,
          amount: 1,
          currency: 1,
          exchangeRate: 1,
          status: 1,
          description: 1,
          voucherMeta: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ).toArray()

    if (!transactions.length) return []

    const traces = []

    for (const tx of transactions) {
      const target = targets.find((entry) => entry.txId === String(tx._id)) || {}
      const voucherMeta = tx.voucherMeta || {}
      const firstLine = Array.isArray(voucherMeta.lineItems) ? voucherMeta.lineItems[0] || {} : {}
      const referenceRate = parseReferenceRate(voucherMeta)
      const lineRate = parseLineRate(tx, voucherMeta)
      const txAmount = parseNumber(tx.amount, 0)
      const foreignAmount = parseForeignAmount(tx, voucherMeta)
      const actualForeignAmount = foreignAmount > 0 ? foreignAmount : (lineRate > 0 ? txAmount / lineRate : 0)
      const expectedForeignAmount = referenceRate > 0 ? txAmount / referenceRate : 0
      const foreignDifference = actualForeignAmount - expectedForeignAmount
      const correctedAmount = toMoney(Math.abs(foreignDifference) * referenceRate)
      const expectedDirection = String(tx.type || '').toLowerCase() === 'payment'
        ? (foreignDifference < 0 ? 'gain' : 'loss')
        : (foreignDifference > 0 ? 'gain' : 'loss')

      const ledgers = await db.collection('ledgers').find(
        { referenceId: tx._id, isDeleted: { $ne: true } },
        {
          projection: {
            _id: 1,
            date: 1,
            debitAccountId: 1,
            creditAccountId: 1,
            amount: 1,
            currency: 1,
            exchangeRate: 1,
            description: 1,
            referenceType: 1,
            notes: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ).sort({ createdAt: 1, _id: 1 }).toArray()

      const accountsById = await loadAccounts(db, ledgers)
      const journalRows = ledgers.filter((row) => row.referenceType === 'journal')
      const targetJournal = target.journalId
        ? journalRows.find((row) => String(row._id) === target.journalId) || null
        : (journalRows[0] || null)

      traces.push({
        tenant: name,
        transaction: {
          id: String(tx._id),
          vocNo: voucherMeta.vocNo || '',
          type: tx.type,
          status: tx.status,
          currency: tx.currency,
          amount: txAmount,
          exchangeRate: parseNumber(tx.exchangeRate, 0),
          referenceRate,
          lineRate,
          foreignAmount: actualForeignAmount,
          expectedForeignAmount,
          foreignDifference,
          correctedAmount,
          expectedDirection,
          partyCode: voucherMeta.partyCode || '',
          partyName: voucherMeta.partyName || '',
          valueDate: voucherMeta.valueDate || tx.date || null,
          description: tx.description || '',
          lineItem: {
            acCode: firstLine.acCode || '',
            currCode: firstLine.currCode || '',
            amountFC: parseNumber(firstLine.amountFC || firstLine.amountFc || firstLine.amtFc || firstLine.headerAmt, 0),
            amountLC: parseNumber(firstLine.amountLC || firstLine.amountLc || firstLine.amtLc, 0),
            narration: firstLine.narration || '',
          },
        },
        journalComparison: targetJournal ? {
          journalId: String(targetJournal._id),
          description: targetJournal.description || '',
          beforeAmount: target.historicalBefore,
          currentAmount: toMoney(targetJournal.amount),
          correctedAmount,
          deltaFromBefore: target.historicalBefore == null ? null : toMoney(correctedAmount - target.historicalBefore),
          debitAccount: accountsById[String(targetJournal.debitAccountId)] || String(targetJournal.debitAccountId || ''),
          creditAccount: accountsById[String(targetJournal.creditAccountId)] || String(targetJournal.creditAccountId || ''),
          notes: targetJournal.notes || '',
        } : null,
        ledgers: ledgers.map((row) => ({
          id: String(row._id),
          referenceType: row.referenceType,
          description: row.description || '',
          amount: toMoney(row.amount),
          currency: row.currency || '',
          exchangeRate: parseNumber(row.exchangeRate, 0),
          debitAccount: accountsById[String(row.debitAccountId)] || String(row.debitAccountId || ''),
          creditAccount: accountsById[String(row.creditAccountId)] || String(row.creditAccountId || ''),
          notes: row.notes || '',
        })),
      })
    }

    return traces
  } finally {
    await conn.close()
  }
}

async function main() {
  const targets = resolveTargets()
  if (!targets.length) throw new Error('No FX trace targets configured')
  if (!TENANTS.length) throw new Error('No tenant Mongo URIs found in environment')

  const results = []
  for (const [name, uri] of TENANTS) {
    const traces = await traceTenant(name, uri, targets)
    results.push(...traces)
  }

  if (!results.length) {
    console.log('No matching transactions found in configured tenants.')
    return
  }

  console.log(JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})