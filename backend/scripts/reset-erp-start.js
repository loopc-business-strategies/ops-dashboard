require('dotenv').config()
const mongoose = require('mongoose')

const Transaction = require('../models/Transaction')
const Ledger = require('../models/Ledger')
const ChartOfAccount = require('../models/ChartOfAccount')

const RESET_TYPES = ['sale', 'purchase', 'payment', 'receipt']

async function resetErpStart() {
  if (!process.env.MONGO_URI) {
    throw new Error('Missing MONGO_URI in environment')
  }

  await mongoose.connect(process.env.MONGO_URI)

  const txFilter = { type: { $in: RESET_TYPES } }

  const targetTransactions = await Transaction.find(txFilter)
    .select('_id journalEntryId type')
    .lean()

  const transactionIds = targetTransactions.map((tx) => tx._id)
  const journalEntryIds = targetTransactions
    .map((tx) => tx.journalEntryId)
    .filter(Boolean)

  const before = {
    txSale: await Transaction.countDocuments({ type: 'sale' }),
    txPurchase: await Transaction.countDocuments({ type: 'purchase' }),
    txPayment: await Transaction.countDocuments({ type: 'payment' }),
    txReceipt: await Transaction.countDocuments({ type: 'receipt' }),
    ledgerVoucherRefs: await Ledger.countDocuments({ referenceType: { $in: RESET_TYPES } }),
    demoAccounts: await ChartOfAccount.countDocuments({
      $or: [
        { accountName: { $regex: /(demo|test|dummy|sample)/i } },
        { accountCode: { $regex: /(demo|test|dummy|sample)/i } },
      ],
    }),
  }

  const ledgerDeleteFilter = {
    $or: [
      { _id: { $in: journalEntryIds } },
      { referenceId: { $in: transactionIds } },
      { referenceType: { $in: RESET_TYPES } },
    ],
  }

  const [ledgerDeleteResult, txDeleteResult, accountDeleteResult] = await Promise.all([
    Ledger.deleteMany(ledgerDeleteFilter),
    Transaction.deleteMany(txFilter),
    ChartOfAccount.deleteMany({
      $or: [
        { accountName: { $regex: /(demo|test|dummy|sample)/i } },
        { accountCode: { $regex: /(demo|test|dummy|sample)/i } },
      ],
    }),
  ])

  const after = {
    txSale: await Transaction.countDocuments({ type: 'sale' }),
    txPurchase: await Transaction.countDocuments({ type: 'purchase' }),
    txPayment: await Transaction.countDocuments({ type: 'payment' }),
    txReceipt: await Transaction.countDocuments({ type: 'receipt' }),
    ledgerVoucherRefs: await Ledger.countDocuments({ referenceType: { $in: RESET_TYPES } }),
    demoAccounts: await ChartOfAccount.countDocuments({
      $or: [
        { accountName: { $regex: /(demo|test|dummy|sample)/i } },
        { accountCode: { $regex: /(demo|test|dummy|sample)/i } },
      ],
    }),
  }

  console.log('ERP reset summary')
  console.log('Before:', before)
  console.log('Deleted:', {
    transactions: txDeleteResult.deletedCount,
    ledgerRows: ledgerDeleteResult.deletedCount,
    demoAccounts: accountDeleteResult.deletedCount,
  })
  console.log('After:', after)

  await mongoose.disconnect()
}

resetErpStart().catch(async (error) => {
  console.error('ERP reset failed:', error.message)
  try {
    await mongoose.disconnect()
  } catch {
    // ignore disconnect errors during failure
  }
  process.exit(1)
})
