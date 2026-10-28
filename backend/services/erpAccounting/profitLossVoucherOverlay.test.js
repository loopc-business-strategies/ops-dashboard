const { applySalesAndPurchasesToPnl } = require('./profitLossVoucherOverlay')

const toMoney = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100

describe('applySalesAndPurchasesToPnl', () => {
  test('does not inject purchases into COGS / expense totals', async () => {
    const result = await applySalesAndPurchasesToPnl({
      ChartOfAccount: null,
      toMoney,
      summary: {
        incomeBreakdown: [{ accountCode: '4190', accountName: 'Exchange Gain', amount: 102.82 }],
        expenseBreakdown: [{ accountCode: '6000', accountName: 'Rent Expense', amount: 1000 }],
      },
      metalVouchers: {
        totalSales: 0,
        totalPurchases: 27167.83,
      },
    })

    expect(result.expenseBreakdown.find((row) => String(row.accountCode) === '5101')).toBeUndefined()
    expect(result.totalExpense).toBe(1000)
    expect(result.totalIncome).toBe(102.82)
    expect(result.netProfit).toBe(toMoney(102.82 - 1000))
  })

  test('keeps ledger COGS when present and still ignores purchase overlay', async () => {
    const result = await applySalesAndPurchasesToPnl({
      ChartOfAccount: null,
      toMoney,
      summary: {
        incomeBreakdown: [],
        expenseBreakdown: [{ accountCode: '5101', accountName: 'Cost Of Goods Sold', amount: 50 }],
      },
      metalVouchers: { totalSales: 0, totalPurchases: 9999 },
    })

    expect(result.expenseBreakdown.find((row) => String(row.accountCode) === '5101').amount).toBe(50)
    expect(result.totalExpense).toBe(50)
  })

  test('lifts Sales Revenue to voucher sales when higher than ledger', async () => {
    const result = await applySalesAndPurchasesToPnl({
      ChartOfAccount: null,
      toMoney,
      summary: {
        incomeBreakdown: [{ accountCode: '4000', accountName: 'Sales Revenue', amount: 10 }],
        expenseBreakdown: [],
      },
      metalVouchers: { totalSales: 500, totalPurchases: 0 },
    })

    expect(result.incomeBreakdown.find((row) => String(row.accountCode) === '4000').amount).toBe(500)
    expect(result.totalIncome).toBe(500)
  })
})
