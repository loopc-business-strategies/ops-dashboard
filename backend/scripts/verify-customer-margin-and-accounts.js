require('dotenv').config()
const mongoose = require('mongoose')
const Customer = require('../models/Customer')
const ChartOfAccount = require('../models/ChartOfAccount')

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in backend/.env')
  }

  await mongoose.connect(process.env.MONGO_URI)

  const customers = await Customer.find({})
    .populate('ledgerAccountId', 'accountCode accountName')
    .sort({ name: 1 })
    .lean()

  const accounts = await ChartOfAccount.find({})
    .sort({ accountCode: 1 })
    .lean()

  console.log('=== CUSTOMER MARGIN ROWS ===')
  customers.forEach((customer, idx) => {
    const balance = Number(customer.outstandingBalance || 0)
    const drcr = balance >= 0 ? 'Cr' : 'Dr'
    const status = balance > 0 ? 'POSITIVE' : balance < 0 ? 'NEGATIVE' : 'NEUTRAL'
    console.log(
      `${idx + 1}. ${customer.name} | ${Math.abs(balance).toFixed(2)}${drcr} | ${status} | Ledger: ${customer.ledgerAccountId?.accountCode || '-'} - ${customer.ledgerAccountId?.accountName || '-'}`
    )
  })

  console.log('=== CHART OF ACCOUNTS ===')
  accounts.forEach((account, idx) => {
    console.log(
      `${idx + 1}. ${account.accountCode} | ${account.accountName} | ${account.accountType} | ${account.isActive ? 'active' : 'inactive'}`
    )
  })

  console.log('=== COUNTS ===')
  console.log(`Customers: ${customers.length}`)
  console.log(`Chart Of Accounts: ${accounts.length}`)
}

run()
  .catch((error) => {
    console.error('Verification failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  })
