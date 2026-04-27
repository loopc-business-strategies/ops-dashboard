require('dotenv').config()
const mongoose = require('mongoose')

const Transaction = require('../models/Transaction')
const Ledger = require('../models/Ledger')
const Customer = require('../models/Customer')
const Vendor = require('../models/Vendor')
const ChartOfAccount = require('../models/ChartOfAccount')

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI

const isUnfixed = (tx) => {
  const raw = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
  return ['unfixed', 'unfix', 'non-fixing', 'non_fixing', 'nonfixing'].includes(raw)
}

const getAccountByCode = async (code) => ChartOfAccount.findOne({ accountCode: String(code), isActive: true }).select('_id accountCode accountName').lean()

const resolveAccounts = async (tx) => {
  let debitAccountId = tx.debitAccountId || null
  let creditAccountId = tx.creditAccountId || null

  if (debitAccountId && creditAccountId) return { debitAccountId, creditAccountId }

  if (tx.type === 'sale') {
    if (!debitAccountId && tx.customerId) {
      const customer = await Customer.findById(tx.customerId).select('ledgerAccountId').lean()
      if (customer?.ledgerAccountId) debitAccountId = customer.ledgerAccountId
    }
    if (!creditAccountId) {
      const revenue = await getAccountByCode('4000')
      if (revenue?._id) creditAccountId = revenue._id
    }
  }

  if (tx.type === 'purchase') {
    if (!debitAccountId) {
      const inventory = await getAccountByCode('1210')
      if (inventory?._id) debitAccountId = inventory._id
    }
    if (!creditAccountId && tx.vendorId) {
      const vendor = await Vendor.findById(tx.vendorId).select('ledgerAccountId').lean()
      if (vendor?.ledgerAccountId) creditAccountId = vendor.ledgerAccountId
    }
    if (!creditAccountId) {
      const ap = await getAccountByCode('2000')
      if (ap?._id) creditAccountId = ap._id
    }
  }

  return { debitAccountId, creditAccountId }
}

async function run() {
  if (!MONGO_URI) throw new Error('MONGO_URI/MONGODB_URI is not configured')
  await mongoose.connect(MONGO_URI)

  const candidates = await Transaction.find({
    isDeleted: { $ne: true },
    status: 'posted',
    type: { $in: ['sale', 'purchase'] },
  }).select('_id type date amount description currency exchangeRate department voucherMeta fixingType metalFixStatus customerId vendorId debitAccountId creditAccountId journalEntryId postedBy createdBy updatedBy').lean()

  let created = 0
  let relinked = 0
  let skipped = 0

  for (const tx of candidates) {
    const existingRefEntry = await Ledger.findOne({
      isDeleted: { $ne: true },
      referenceType: tx.type,
      referenceId: tx._id,
    }).select('_id').lean()

    const existingJournalEntry = tx.journalEntryId
      ? await Ledger.findOne({ _id: tx.journalEntryId, isDeleted: { $ne: true } }).select('_id').lean()
      : null

    if (existingRefEntry || existingJournalEntry) {
      const targetLedgerId = existingRefEntry?._id || existingJournalEntry?._id
      if (targetLedgerId && String(tx.journalEntryId || '') !== String(targetLedgerId)) {
        await Transaction.updateOne({ _id: tx._id }, { $set: { journalEntryId: targetLedgerId } })
        relinked += 1
      }
      continue
    }

    const { debitAccountId, creditAccountId } = await resolveAccounts(tx)
    if (!debitAccountId || !creditAccountId) {
      skipped += 1
      console.log(`SKIP tx=${tx._id} voc=${tx.voucherMeta?.vocNo || '-'} reason=missing_accounts debit=${debitAccountId || '-'} credit=${creditAccountId || '-'}`)
      continue
    }

    const unfixed = isUnfixed(tx)
    const exchangeRate = Number(tx.exchangeRate || 1)
    const baseAmount = unfixed ? 0 : (Number(tx.amount || 0) * exchangeRate)

    const actorId = tx.postedBy || tx.updatedBy || tx.createdBy
    if (!actorId) {
      skipped += 1
      console.log(`SKIP tx=${tx._id} voc=${tx.voucherMeta?.vocNo || '-'} reason=missing_actor`)
      continue
    }

    const entry = await Ledger.create({
      date: tx.date || new Date(),
      debitAccountId,
      creditAccountId,
      amount: Number(baseAmount.toFixed(2)),
      description: tx.description || `${tx.type} transaction`,
      referenceType: tx.type,
      referenceId: tx._id,
      createdBy: actorId,
      updatedBy: actorId,
      department: tx.department || '',
      currency: String(tx.currency || 'USD').toUpperCase(),
      exchangeRate,
      notes: unfixed ? 'Backfilled unfixed voucher marker (zero-value).' : 'Backfilled voucher ledger entry.',
    })

    await Transaction.updateOne(
      { _id: tx._id },
      {
        $set: {
          journalEntryId: entry._id,
          debitAccountId,
          creditAccountId,
        },
      }
    )

    created += 1
    console.log(`CREATE tx=${tx._id} voc=${tx.voucherMeta?.vocNo || '-'} type=${tx.type} fix=${unfixed ? 'unfixed' : 'fixed'} amount=${entry.amount}`)
  }

  console.log(`DONE created=${created} relinked=${relinked} skipped=${skipped}`)
  await mongoose.disconnect()
}

run().catch(async (e) => {
  console.error(e)
  try { await mongoose.disconnect() } catch {}
  process.exit(1)
})
