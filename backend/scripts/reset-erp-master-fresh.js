require('dotenv').config()
const mongoose = require('mongoose')

const User = require('../models/User')
const Currency = require('../models/Currency')
const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')
const Ledger = require('../models/Ledger')
const Transaction = require('../models/Transaction')
const Customer = require('../models/Customer')
const Vendor = require('../models/Vendor')

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, baseCurrency: true },
]

const accounts = [
  { accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', description: 'Operational cash balance', department: 'finance' },
  { accountCode: '1010', accountName: 'Main Bank Account', accountType: 'Asset', description: 'Primary treasury bank account', department: 'finance' },
  { accountCode: '1020', accountName: 'Petty Cash', accountType: 'Asset', description: 'Minor operational cash', department: 'finance' },
  { accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'Asset', description: 'Customer invoices not yet collected', department: 'sales' },
  { accountCode: '1200', accountName: 'Inventory - Raw Materials', accountType: 'Asset', description: 'Raw material stock valuation', department: 'production' },
  { accountCode: '1205', accountName: 'Inventory - Work in Progress', accountType: 'Asset', description: 'Semi-finished goods', department: 'production' },
  { accountCode: '1210', accountName: 'Inventory - Finished Goods', accountType: 'Asset', description: 'Finished inventory ready for sale', department: 'production' },
  { accountCode: '1500', accountName: 'Property & Equipment', accountType: 'Asset', description: 'Fixed assets', department: 'operations' },
  { accountCode: '1600', accountName: 'Accumulated Depreciation', accountType: 'Asset', description: 'Contra-asset for depreciation', department: 'finance' },
  { accountCode: '1700', accountName: 'Intangible Assets', accountType: 'Asset', description: 'Patents, licenses, trademarks', department: 'finance' },
  { accountCode: '2000', accountName: 'Accounts Payable', accountType: 'Liability', description: 'Supplier invoices not yet paid', department: 'finance' },
  { accountCode: '2010', accountName: 'Short-term Loans', accountType: 'Liability', description: 'Loans due within 12 months', department: 'finance' },
  { accountCode: '2100', accountName: 'Payroll Payable', accountType: 'Liability', description: 'Salary obligations to employees', department: 'hr' },
  { accountCode: '2110', accountName: 'Sales Tax Payable', accountType: 'Liability', description: 'VAT/GST owed to government', department: 'finance' },
  { accountCode: '2120', accountName: 'Income Tax Payable', accountType: 'Liability', description: 'Corporate tax obligations', department: 'finance' },
  { accountCode: '2200', accountName: 'Long-term Debt', accountType: 'Liability', description: 'Loans due after 12 months', department: 'finance' },
  { accountCode: '3000', accountName: 'Owner Equity', accountType: 'Equity', description: 'Opening equity balance', department: 'finance' },
  { accountCode: '3100', accountName: 'Retained Earnings', accountType: 'Equity', description: 'Accumulated profits', department: 'finance' },
  { accountCode: '3200', accountName: 'Current Period Profit/Loss', accountType: 'Equity', description: 'YTD net income', department: 'finance' },
  { accountCode: '4000', accountName: 'Sales Revenue', accountType: 'Income', description: 'Primary product/service revenue', department: 'sales' },
  { accountCode: '4100', accountName: 'Sales - Domestic', accountType: 'Income', description: 'Local market sales', department: 'sales' },
  { accountCode: '4110', accountName: 'Sales - Export', accountType: 'Income', description: 'International sales', department: 'sales' },
  { accountCode: '4200', accountName: 'Service Revenue', accountType: 'Income', description: 'Service delivery income', department: 'sales' },
  { accountCode: '4300', accountName: 'Other Income', accountType: 'Income', description: 'Interest, royalties, miscellaneous', department: 'finance' },
  { accountCode: '5000', accountName: 'Cost of Goods Sold', accountType: 'Expense', description: 'Direct inventory cost', department: 'production' },
  { accountCode: '5100', accountName: 'Raw Materials Used', accountType: 'Expense', description: 'Raw material consumption', department: 'production' },
  { accountCode: '5200', accountName: 'Direct Labor', accountType: 'Expense', description: 'Production worker wages', department: 'production' },
  { accountCode: '6000', accountName: 'Rent Expense', accountType: 'Expense', description: 'Office and facility rent', department: 'operations' },
  { accountCode: '6100', accountName: 'Operating Expenses', accountType: 'Expense', description: 'General operating expenses', department: 'operations' },
  { accountCode: '6110', accountName: 'Utilities', accountType: 'Expense', description: 'Electricity, water, gas', department: 'operations' },
  { accountCode: '6120', accountName: 'Maintenance & Repairs', accountType: 'Expense', description: 'Equipment and building upkeep', department: 'operations' },
  { accountCode: '6130', accountName: 'Office Supplies', accountType: 'Expense', description: 'Stationery and consumables', department: 'operations' },
  { accountCode: '6140', accountName: 'Depreciation Expense', accountType: 'Expense', description: 'Fixed asset depreciation', department: 'finance' },
  { accountCode: '6200', accountName: 'Payroll Expense', accountType: 'Expense', description: 'Employee salaries and wages', department: 'hr' },
  { accountCode: '6210', accountName: 'Payroll Taxes', accountType: 'Expense', description: 'Employer taxes and benefits', department: 'hr' },
  { accountCode: '6220', accountName: 'Training & Development', accountType: 'Expense', description: 'Employee training programs', department: 'hr' },
  { accountCode: '6300', accountName: 'Marketing & Advertising', accountType: 'Expense', description: 'Marketing campaign costs', department: 'sales' },
  { accountCode: '6310', accountName: 'Sales Commission', accountType: 'Expense', description: 'Sales team commissions', department: 'sales' },
  { accountCode: '6400', accountName: 'Professional Fees', accountType: 'Expense', description: 'Legal, audit, consulting fees', department: 'finance' },
  { accountCode: '6500', accountName: 'Travel & Entertainment', accountType: 'Expense', description: 'Business travel and meals', department: 'operations' },
  { accountCode: '6600', accountName: 'Insurance Expense', accountType: 'Expense', description: 'Business insurance premiums', department: 'finance' },
  { accountCode: '6700', accountName: 'Interest Expense', accountType: 'Expense', description: 'Loan and debt interest', department: 'finance' },
  { accountCode: '6800', accountName: 'Bad Debt Expense', accountType: 'Expense', description: 'Uncollectible accounts write-off', department: 'sales' },
  { accountCode: '6900', accountName: 'Miscellaneous Expense', accountType: 'Expense', description: 'Other operating costs', department: 'operations' },
]

const mappings = [
  { mappingType: 'sales_invoice', debit: '1010', credit: '4000', description: 'Record customer invoice receipts', department: 'sales' },
  { mappingType: 'sales_domestic', debit: '1010', credit: '4100', description: 'Domestic market sales', department: 'sales' },
  { mappingType: 'sales_export', debit: '1010', credit: '4110', description: 'Export sales transactions', department: 'sales' },
  { mappingType: 'sales_service', debit: '1010', credit: '4200', description: 'Service revenue recognition', department: 'sales' },
  { mappingType: 'inventory_purchase', debit: '1200', credit: '2000', description: 'Record inventory purchase from suppliers', department: 'production' },
  { mappingType: 'raw_material_usage', debit: '5100', credit: '1200', description: 'Raw materials consumed in production', department: 'production' },
  { mappingType: 'cogs_recognition', debit: '5000', credit: '1210', description: 'Recognize COGS from finished goods', department: 'production' },
  { mappingType: 'vendor_payment', debit: '2000', credit: '1010', description: 'Pay supplier invoices', department: 'finance' },
  { mappingType: 'customer_payment', debit: '1010', credit: '1100', description: 'Customer payment received', department: 'sales' },
  { mappingType: 'payroll_accrual', debit: '6200', credit: '2100', description: 'Accrue monthly payroll', department: 'hr' },
  { mappingType: 'payroll_payment', debit: '2100', credit: '1010', description: 'Pay employee salaries', department: 'hr' },
  { mappingType: 'payroll_tax', debit: '6210', credit: '2120', description: 'Accrue payroll taxes', department: 'hr' },
  { mappingType: 'operations_expense', debit: '6100', credit: '1010', description: 'Pay operating expenses from bank', department: 'operations' },
  { mappingType: 'rent_expense', debit: '6000', credit: '1010', description: 'Pay monthly rent', department: 'operations' },
  { mappingType: 'utilities_expense', debit: '6110', credit: '1010', description: 'Pay utilities bill', department: 'operations' },
  { mappingType: 'office_supplies', debit: '6130', credit: '1010', description: 'Purchase office supplies', department: 'operations' },
  { mappingType: 'marketing_campaign', debit: '6300', credit: '1010', description: 'Marketing and advertising expenses', department: 'sales' },
  { mappingType: 'sales_commission', debit: '6310', credit: '2100', description: 'Accrue sales commissions', department: 'sales' },
  { mappingType: 'depreciation', debit: '6140', credit: '1600', description: 'Record monthly depreciation', department: 'finance' },
  { mappingType: 'bank_interest', debit: '1010', credit: '4300', description: 'Bank interest income', department: 'finance' },
  { mappingType: 'interest_expense', debit: '6700', credit: '1010', description: 'Pay loan interest', department: 'finance' },
  { mappingType: 'tax_payment', debit: '2120', credit: '1010', description: 'Pay income taxes', department: 'finance' },
]

async function run() {
  if (!process.env.MONGO_URI_LOOPC) {
    throw new Error('Missing env var MONGO_URI_LOOPC')
  }

  await mongoose.connect(process.env.MONGO_URI_LOOPC)

  const actor = await User.findOne({ role: 'super_admin' }).sort({ createdAt: 1 })
  if (!actor) {
    throw new Error('No super admin user found. Create one before reset.')
  }

  const before = {
    transactions: await Transaction.countDocuments(),
    ledgerEntries: await Ledger.countDocuments(),
    mappings: await AccountMapping.countDocuments(),
    accounts: await ChartOfAccount.countDocuments(),
  }

  await Transaction.deleteMany({})
  await Ledger.deleteMany({})
  await AccountMapping.deleteMany({})
  await ChartOfAccount.deleteMany({})
  await Customer.updateMany({}, { $set: { ledgerAccountId: null } })
  await Vendor.updateMany({}, { $set: { ledgerAccountId: null } })

  for (const currency of currencies) {
    await Currency.findOneAndUpdate(
      { code: currency.code },
      { $set: { ...currency, isActive: true, rateUpdatedAt: new Date() } },
      { upsert: true, new: true }
    )
  }
  await Currency.updateMany({ code: { $ne: 'USD' } }, { $set: { isActive: false, baseCurrency: false } })

  const accountMap = new Map()
  for (const account of accounts) {
    const saved = await ChartOfAccount.create({
      ...account,
      currency: 'USD',
      isActive: true,
      createdBy: actor._id,
    })
    accountMap.set(account.accountCode, saved)
  }

  for (const mapping of mappings) {
    await AccountMapping.create({
      mappingType: mapping.mappingType,
      debitAccountId: accountMap.get(mapping.debit)._id,
      creditAccountId: accountMap.get(mapping.credit)._id,
      department: mapping.department || '',
      description: mapping.description,
      isActive: true,
    })
  }

  const after = {
    transactions: await Transaction.countDocuments(),
    ledgerEntries: await Ledger.countDocuments(),
    mappings: await AccountMapping.countDocuments(),
    accounts: await ChartOfAccount.countDocuments(),
  }

  console.log('ERP master reset completed')
  console.log('Before:', before)
  console.log('After:', after)

  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error('ERP master reset failed:', error.message)
  try {
    await mongoose.disconnect()
  } catch {
    // ignore disconnect errors
  }
  process.exit(1)
})
