const { describe, expect, test } = require('@jest/globals')
const {
  formatMoney,
  buildVoucherActivityDetail,
  buildJournalActivityDetail,
  buildAccountActivityDetail,
} = require('./activityLogDetail')

describe('activityLogDetail', () => {
  test('formatMoney', () => {
    expect(formatMoney(1234.5, 'usd')).toBe('1,234.50 USD')
  })

  test('buildAccountActivityDetail includes name and type', () => {
    expect(buildAccountActivityDetail({
      accountCode: '5100',
      accountName: 'Office Expense',
      accountType: 'Expense',
    })).toBe('Created account 5100 — Office Expense · Expense')
  })

  test('buildVoucherActivityDetail includes type, accounts, amount, party', async () => {
    const detail = await buildVoucherActivityDetail({
      type: 'sale',
      amount: 40000,
      currency: 'USD',
      voucherMeta: { vocNo: 'SV/2026/0001', partyName: 'ABC Trading' },
      debitAccountId: { accountCode: '1100', accountName: 'Cash' },
      creditAccountId: { accountCode: '4000', accountName: 'Sales' },
    }, 'post')
    expect(detail).toContain('Posted Sale SV/2026/0001')
    expect(detail).toContain('ABC Trading')
    expect(detail).toContain('Dr 1100 Cash')
    expect(detail).toContain('Cr 4000 Sales')
    expect(detail).toContain('40,000.00 USD')
  })

  test('buildVoucherActivityDetail includes metal weight and rate', async () => {
    const detail = await buildVoucherActivityDetail({
      type: 'metal_receipt',
      amount: 42000,
      currency: 'USD',
      voucherMeta: {
        vocNo: 'MR/2026/0009',
        partyName: 'Bullion House',
        lineItems: [{ stockCode: 'XAU', pureWeight: 10.5, metalRate: 4000, metalAmount: 42000 }],
      },
      debitAccountId: { accountCode: '1200', accountName: 'Metal Stock' },
      creditAccountId: { accountCode: '2100', accountName: 'Vendor Payable' },
    }, 'create')
    expect(detail).toContain('Created Metal receipt MR/2026/0009')
    expect(detail).toContain('XAU 10.5 @ 4000')
    expect(detail).toContain('42,000.00 USD')
  })

  test('buildJournalActivityDetail includes accounts and amount', async () => {
    const detail = await buildJournalActivityDetail({
      mode: 'journal',
      documentNo: 'JV-DEMO-1',
      totalAmount: 12.34,
      currency: 'USD',
      entries: [{
        amount: 12.34,
        currency: 'USD',
        debitAccountId: { accountCode: '5000', accountName: 'Expense' },
        creditAccountId: { accountCode: '1000', accountName: 'Cash' },
      }],
    })
    expect(detail).toContain('Created Journal voucher JV-DEMO-1')
    expect(detail).toContain('Dr 5000 Expense')
    expect(detail).toContain('Cr 1000 Cash')
    expect(detail).toContain('12.34 USD')
    expect(detail).toContain('1 line')
  })
})
