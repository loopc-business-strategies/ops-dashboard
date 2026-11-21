import { describe, expect, test, vi } from 'vitest'
import { fetchAllVoucherTransactions, voucherListQuery } from './erpSharedVoucherList'

describe('erpSharedVoucherList pagination', () => {
  test('voucherListQuery uses API max page size 200', () => {
    expect(voucherListQuery({ type: 'payment', limit: 999 }).limit).toBe(200)
  })

  test('fetchAllVoucherTransactions pages past newest 200 so early Doc Nos stay', async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => ({
      _id: `new-${i}`,
      voucherMeta: { vocNo: `Pay/2026/${String(211 - i).padStart(4, '0')}` },
    }))
    const page2 = Array.from({ length: 10 }, (_, i) => ({
      _id: `old-${i + 1}`,
      voucherMeta: { vocNo: `Pay/2026/${String(i + 1).padStart(4, '0')}` },
    }))
    const getTransactions = vi.fn(async (_token, params) => {
      if (Number(params.page) === 1) {
        return { success: true, transactions: page1, total: 210, hasMore: true }
      }
      return { success: true, transactions: page2, total: 210, hasMore: false }
    })

    const res = await fetchAllVoucherTransactions('t', { type: 'payment' }, getTransactions)
    expect(getTransactions).toHaveBeenCalledTimes(2)
    expect(res.transactions).toHaveLength(210)
    expect(res.hasMore).toBe(false)
    const codes = res.transactions.map((row) => row.voucherMeta.vocNo)
    expect(codes).toContain('Pay/2026/0001')
    expect(codes).toContain('Pay/2026/0010')
    expect(codes).toContain('Pay/2026/0211')
  })
})
