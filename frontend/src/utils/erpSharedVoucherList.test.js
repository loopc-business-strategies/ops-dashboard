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
    expect(res.listComplete).toBe(true)
    const codes = res.transactions.map((row) => row.voucherMeta.vocNo)
    expect(codes).toContain('Pay/2026/0001')
    expect(codes).toContain('Pay/2026/0010')
    expect(codes).toContain('Pay/2026/0211')
  })

  test('fetchAllVoucherTransactions onPage fires after first page for fast paint', async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => ({ _id: `a-${i}`, voucherMeta: { vocNo: `A${i}` } }))
    const page2 = Array.from({ length: 5 }, (_, i) => ({ _id: `b-${i}`, voucherMeta: { vocNo: `B${i}` } }))
    const getTransactions = vi.fn(async (_token, params) => {
      if (Number(params.page) === 1) {
        return { success: true, transactions: page1, total: 205, hasMore: true }
      }
      return { success: true, transactions: page2, total: 205, hasMore: false }
    })
    const onPage = vi.fn()

    const res = await fetchAllVoucherTransactions('t', { type: 'payment' }, getTransactions, { onPage })
    expect(onPage).toHaveBeenCalledTimes(2)
    expect(onPage.mock.calls[0][0].transactions).toHaveLength(200)
    expect(onPage.mock.calls[0][0].listComplete).toBe(false)
    expect(onPage.mock.calls[1][0].transactions).toHaveLength(205)
    expect(onPage.mock.calls[1][0].listComplete).toBe(true)
    expect(res.transactions).toHaveLength(205)
  })
})
