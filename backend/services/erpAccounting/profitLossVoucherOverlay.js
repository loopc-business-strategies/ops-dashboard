/**
 * Overlay posted sale voucher totals onto P&L income.
 * Purchases are intentionally NOT injected into COGS — they debit stock assets.
 */

async function placeAmountOnBreakdown(rows, code, fallbackName, amount, { ChartOfAccount, toMoney }) {
  if (!(amount > 0)) return
  let row = rows.find((item) => String(item.accountCode) === code)
  if (!row) {
    const account = ChartOfAccount
      ? await ChartOfAccount.findOne({ accountCode: code, isDeleted: { $ne: true } })
        .select('accountCode accountName')
        .lean()
      : null
    row = {
      accountId: account?._id ? String(account._id) : '',
      accountCode: account?.accountCode || code,
      accountName: account?.accountName || fallbackName,
      amount: 0,
    }
    rows.push(row)
  }
  row.amount = toMoney(amount)
}

async function applySalesAndPurchasesToPnl({ ChartOfAccount, toMoney, summary, metalVouchers }) {
  const sales = Number(metalVouchers?.totalSales || 0)
  const income = (summary?.incomeBreakdown || []).map((row) => ({ ...row }))
  const expense = (summary?.expenseBreakdown || []).map((row) => ({ ...row }))

  const salesRow = income.find((item) => String(item.accountCode) === '4000')
  await placeAmountOnBreakdown(
    income,
    '4000',
    'Sales Revenue',
    Math.max(Number(salesRow?.amount || 0), sales),
    { ChartOfAccount, toMoney },
  )

  income.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  expense.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  const totalIncome = toMoney(income.reduce((sum, row) => sum + Number(row.amount || 0), 0))
  const totalExpense = toMoney(expense.reduce((sum, row) => sum + Number(row.amount || 0), 0))
  return {
    incomeBreakdown: income,
    expenseBreakdown: expense,
    totalIncome,
    totalExpense,
    netProfit: toMoney(totalIncome - totalExpense),
    topIncome: income.slice(0, 10),
    topExpenses: expense.slice(0, 10),
    grossMarginPct: totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 10000) / 100 : 0,
  }
}

module.exports = {
  applySalesAndPurchasesToPnl,
  placeAmountOnBreakdown,
}
