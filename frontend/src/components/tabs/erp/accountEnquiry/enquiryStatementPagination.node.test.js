import { describe, expect, test } from 'vitest'

/**
 * Mirrors account enquiry newest-first running-balance page seeding.
 * Page 2+ must continue from: lastVisible.runningBalance - lastVisible.signedAmount
 */
function stampNewestFirst(entries, closingBalance) {
  const sorted = [...entries].sort((a, b) => {
    const ad = new Date(a.date).getTime()
    const bd = new Date(b.date).getTime()
    if (bd !== ad) return bd - ad
    return String(b._id).localeCompare(String(a._id))
  })
  let rb = Number(closingBalance)
  return sorted.map((row) => {
    const next = { ...row, runningBalance: rb }
    rb -= Number(row.signedAmount || 0)
    return next
  })
}

describe('enquiry statement cursor running balance continuity', () => {
  test('page1 + page2 balances match a single full walk', () => {
    const all = [
      { _id: 'e5', date: '2026-09-09', signedAmount: -3 },
      { _id: 'e4', date: '2026-05-13T12:00:00.000Z', signedAmount: -49.59 },
      { _id: 'e3', date: '2026-05-13T11:00:00.000Z', signedAmount: 198.35 },
      { _id: 'e2', date: '2026-05-13T10:00:00.000Z', signedAmount: 82.64 },
      { _id: 'e1', date: '2026-05-10', signedAmount: -85.12 },
    ]
    const closing = all.reduce((sum, row) => sum + Number(row.signedAmount || 0), 0)
    const full = stampNewestFirst(all, closing)

    const page1Source = all.slice(0, 2)
    const page1 = stampNewestFirst(page1Source, closing)
    const last = page1[page1.length - 1]
    const seed = Number(last.runningBalance) - Number(last.signedAmount)
    const page2 = stampNewestFirst(all.slice(2), seed)

    const joined = [...page1, ...page2]
    expect(joined.map((row) => row._id)).toEqual(full.map((row) => row._id))
    joined.forEach((row, index) => {
      expect(row.runningBalance).toBeCloseTo(full[index].runningBalance, 6)
    })
  })
})
