const Ledger = require('../models/Ledger')
const Transaction = require('../models/Transaction')
const ChartOfAccount = require('../models/ChartOfAccount')
const MetalRate = require('../models/MetalRate')
const { mergeNotificationPreferences } = require('./notificationPreferences')
const { MOBILE_APP_NAME } = require('../config/mobileApp')
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const { connectTenant } = require('../db/tenantConnections')

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function fmtMoney(n, currency = 'USD') {
  const v = Number(n || 0)
  return `${currency} ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function withTenantModels(tenant, fn) {
  const connection = await connectTenant(tenant)
  return runWithTenantConnection(connection, tenant, fn)
}

async function buildReportDigestText(tenant, preferences = {}) {
  const merged = mergeNotificationPreferences(preferences)
  const digest = merged.reportDigest
  const lines = [`${MOBILE_APP_NAME} daily report`]

  return withTenantModels(tenant, async () => {
    const from = startOfToday()
    const to = endOfToday()

    if (digest.includeExpensesToday) {
      const expenseAccounts = await ChartOfAccount.find({
        isDeleted: { $ne: true },
        accountType: { $in: ['Expense', 'expense', 'Liability'] },
      }).select('_id accountCode accountName').limit(200).lean()
      const expenseIds = expenseAccounts.map((a) => a._id)
      let expenseTotal = 0
      if (expenseIds.length) {
        const rows = await Ledger.find({
          isDeleted: { $ne: true },
          date: { $gte: from, $lte: to },
          $or: [{ debitAccountId: { $in: expenseIds } }, { creditAccountId: { $in: expenseIds } }],
        }).select('amount exchangeRate debitAccountId creditAccountId').lean()
        for (const row of rows) {
          const amt = Number(row.amount || 0) * Number(row.exchangeRate || 1)
          if (expenseIds.some((id) => String(id) === String(row.debitAccountId))) expenseTotal += amt
          if (expenseIds.some((id) => String(id) === String(row.creditAccountId))) expenseTotal -= amt
        }
      }
      lines.push(`Expenses today: ${fmtMoney(Math.max(0, expenseTotal))}`)
    }

    if (digest.includeSalesToday) {
      const sales = await Transaction.find({
        isDeleted: { $ne: true },
        status: 'posted',
        type: { $in: ['sale', 'receipt'] },
        date: { $gte: from, $lte: to },
      }).select('amount currency type').lean()
      const total = sales.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      lines.push(`Sales/receipts today: ${fmtMoney(total)} (${sales.length} posted)`)
    }

    if (digest.includeBankCashBalance) {
      const cashBank = await ChartOfAccount.find({
        isDeleted: { $ne: true },
        isActive: { $ne: false },
        $or: [
          { accountName: /bank|cash/i },
          { accountCode: /^1[0-2]/ },
        ],
      }).select('_id accountCode accountName').limit(100).lean()
      let balance = 0
      for (const acc of cashBank) {
        const rows = await Ledger.find({
          isDeleted: { $ne: true },
          $or: [{ debitAccountId: acc._id }, { creditAccountId: acc._id }],
        }).select('amount exchangeRate debitAccountId creditAccountId').limit(5000).lean()
        for (const row of rows) {
          const amt = Number(row.amount || 0) * Number(row.exchangeRate || 1)
          if (String(row.debitAccountId) === String(acc._id)) balance += amt
          if (String(row.creditAccountId) === String(acc._id)) balance -= amt
        }
      }
      lines.push(`Bank & cash: ${fmtMoney(balance)}`)
    }

    if (digest.includeGoldPrice) {
      const rate = await MetalRate.findOne({}).sort({ updatedAt: -1 }).lean()
      const gold = Number(rate?.goldPrice || 0)
      const unit = String(rate?.priceUnit || 'USD/oz')
      if (gold > 0) lines.push(`Gold: ${gold.toFixed(2)} ${unit}`)
      else lines.push('Gold: rate unavailable')
    }

    return lines.join('\n')
  })
}

module.exports = {
  buildReportDigestText,
}
