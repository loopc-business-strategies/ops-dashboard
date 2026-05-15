require('./_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
const asObjectId = (value) => {
  const raw = String(value || '').trim()
  if (!/^[a-f\d]{24}$/i.test(raw)) return null
  return new mongoose.Types.ObjectId(raw)
}

const idsEqual = (a, b) => String(a || '') === String(b || '')

const resolveSettlementPreference = (lineType) => {
  const v = String(lineType || '').trim().toLowerCase()
  if (v === 'cash') return 'cash'
  if (v === 'tt' || v === 'transfer' || v === 'cheque' || v === 'check') return 'bank'
  return 'any'
}

async function main() {
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('Missing MONGO_URI_CG (or fallback URI)')

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const users = db.collection('users')
    const transactions = db.collection('transactions')
    const chart = db.collection('chartofaccounts')
    const ledgers = db.collection('ledgers')
    const customers = db.collection('customers')
    const vendors = db.collection('vendors')
    const currencies = db.collection('currencies')

    const [adminUser, baseCurrency] = await Promise.all([
      users.findOne({ isActive: true, role: { $in: ['super_admin', 'admin', 'finance'] } }, { projection: { _id: 1 } }),
      currencies.findOne({ isActive: true, baseCurrency: true }, { projection: { code: 1 } }),
    ])

    if (!adminUser?._id) throw new Error('No admin/finance user found to stamp updates')
    const baseCurrencyCode = String(baseCurrency?.code || 'USD').toUpperCase()

    const posted = await transactions.find({
      isDeleted: { $ne: true },
      status: 'posted',
      type: { $in: ['receipt', 'payment'] },
    }).toArray()

    const accountCache = new Map()
    const getAccountByCode = async (code) => {
      const key = `code:${String(code || '').trim()}`
      if (accountCache.has(key)) return accountCache.get(key)
      const rows = await chart.find({ accountCode: String(code || '').trim() }).sort({ isActive: -1, createdAt: 1, _id: 1 }).toArray()
      const picked = rows.find((x) => x.isActive && x.accountType === 'Asset')
        || rows.find((x) => x.isActive)
        || rows.find((x) => x.accountType === 'Asset')
        || rows[0]
      if (picked && !picked.isActive) {
        await chart.updateOne({ _id: picked._id }, { $set: { isActive: true, updatedAt: new Date() } })
        picked.isActive = true
      }
      accountCache.set(key, picked || null)
      return picked || null
    }

    const getAccountByIdOrCode = async (raw) => {
      const text = String(raw || '').trim()
      if (!text) return null
      const oid = asObjectId(text)
      if (oid) {
        const key = `id:${String(oid)}`
        if (accountCache.has(key)) return accountCache.get(key)
        const row = await chart.findOne({ _id: oid })
        if (row && !row.isActive) {
          await chart.updateOne({ _id: row._id }, { $set: { isActive: true, updatedAt: new Date() } })
          row.isActive = true
        }
        accountCache.set(key, row || null)
        return row || null
      }
      return getAccountByCode(text)
    }

    const getFallbackSettlement = async (pref) => {
      if (pref === 'cash') return getAccountByCode('1000')
      if (pref === 'bank') return getAccountByCode('1010')
      return (await getAccountByCode('1010')) || (await getAccountByCode('1000'))
    }

    const resolvePartyAccount = async (tx) => {
      const partyAccountId = tx?.voucherMeta?.partyAccountId
      const partyCode = tx?.voucherMeta?.partyCode
      const byVoucherMeta = await getAccountByIdOrCode(partyAccountId) || await getAccountByCode(partyCode)
      if (byVoucherMeta) return byVoucherMeta

      if (String(tx.type || '').toLowerCase() === 'receipt' && tx.customerId) {
        const customer = await customers.findOne({ _id: tx.customerId }, { projection: { ledgerAccountId: 1 } })
        return getAccountByIdOrCode(customer?.ledgerAccountId)
      }

      if (String(tx.type || '').toLowerCase() === 'payment' && tx.vendorId) {
        const vendor = await vendors.findOne({ _id: tx.vendorId }, { projection: { ledgerAccountId: 1 } })
        return getAccountByIdOrCode(vendor?.ledgerAccountId)
      }

      return null
    }

    const summary = {
      scanned: posted.length,
      updatedTransactions: 0,
      updatedLedgers: 0,
      createdLedgers: 0,
      skipped: 0,
      skippedDetails: [],
    }

    for (const tx of posted) {
      const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
      const preferredLine = lines.find((line) => String(line?.acCode || '').trim()) || lines[0] || null
      const settlementCode = String(preferredLine?.acCode || '').trim()
      const settlementPref = resolveSettlementPreference(preferredLine?.type)

      const settlementAccount = await getAccountByCode(settlementCode) || await getFallbackSettlement(settlementPref)
      const partyAccount = await resolvePartyAccount(tx)

      if (!settlementAccount || !partyAccount) {
        summary.skipped += 1
        summary.skippedDetails.push({
          txId: String(tx._id),
          type: tx.type,
          vocNo: String(tx?.voucherMeta?.vocNo || ''),
          reason: !settlementAccount ? 'Missing settlement account' : 'Missing party account',
        })
        continue
      }

      const isReceipt = String(tx.type || '').toLowerCase() === 'receipt'
      const expectedDebitId = isReceipt ? settlementAccount._id : partyAccount._id
      const expectedCreditId = isReceipt ? partyAccount._id : settlementAccount._id
      const expectedAmount = roundMoney(Number(tx.amount || 0) * Number(tx.exchangeRate || 1))

      const txNeedsUpdate = !idsEqual(tx.debitAccountId, expectedDebitId) || !idsEqual(tx.creditAccountId, expectedCreditId)
      if (txNeedsUpdate) {
        await transactions.updateOne(
          { _id: tx._id },
          {
            $set: {
              debitAccountId: expectedDebitId,
              creditAccountId: expectedCreditId,
              updatedBy: adminUser._id,
              updatedAt: new Date(),
            },
          }
        )
        summary.updatedTransactions += 1
      }

      const activeRows = await ledgers.find({
        referenceType: tx.type,
        referenceId: tx._id,
        isDeleted: { $ne: true },
      }).sort({ createdAt: 1, _id: 1 }).toArray()

      const keepRow = activeRows.length ? activeRows[activeRows.length - 1] : null
      const staleRows = activeRows.length > 1 ? activeRows.slice(0, -1) : []

      if (staleRows.length) {
        await ledgers.updateMany(
          { _id: { $in: staleRows.map((r) => r._id) } },
          { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: adminUser._id } }
        )
      }

      if (!keepRow) {
        await ledgers.insertOne({
          date: tx?.voucherMeta?.valueDate || tx.date || new Date(),
          debitAccountId: expectedDebitId,
          creditAccountId: expectedCreditId,
          amount: expectedAmount,
          description: tx.description || `${tx.type} transaction`,
          referenceType: tx.type,
          referenceId: tx._id,
          createdBy: tx.createdBy || adminUser._id,
          updatedBy: adminUser._id,
          department: tx.department || '',
          currency: baseCurrencyCode,
          exchangeRate: 1,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        summary.createdLedgers += 1
      } else {
        const needsLedgerUpdate = !idsEqual(keepRow.debitAccountId, expectedDebitId)
          || !idsEqual(keepRow.creditAccountId, expectedCreditId)
          || roundMoney(keepRow.amount) !== expectedAmount
          || Number(keepRow.exchangeRate || 1) !== 1
          || String(keepRow.currency || '').toUpperCase() !== baseCurrencyCode

        if (needsLedgerUpdate) {
          await ledgers.updateOne(
            { _id: keepRow._id },
            {
              $set: {
                date: tx?.voucherMeta?.valueDate || tx.date || keepRow.date || new Date(),
                debitAccountId: expectedDebitId,
                creditAccountId: expectedCreditId,
                amount: expectedAmount,
                currency: baseCurrencyCode,
                exchangeRate: 1,
                updatedBy: adminUser._id,
                updatedAt: new Date(),
              },
            }
          )
          summary.updatedLedgers += 1
        }
      }
    }

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      tenant: 'CG',
      ...summary,
      skippedPreview: summary.skippedDetails.slice(0, 20),
    }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
