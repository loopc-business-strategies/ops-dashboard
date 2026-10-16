import { describe, expect, test, vi } from 'vitest'
import { forEachListPage } from './erpPagedRows'

describe('forEachListPage', () => {
  test('publishes the first page and then the full list', async () => {
    const seen = []
    const rows = await forEachListPage({
      pageSize: 2,
      fetchPage: async ({ page }) => {
        if (page === 1) return { rows: [{ _id: 'a' }, { _id: 'b' }], total: 3 }
        return { rows: [{ _id: 'c' }], total: 3 }
      },
      onPage: (collected) => { seen.push(collected.map((row) => row._id)) },
    })
    expect(seen).toEqual([['a', 'b'], ['a', 'b', 'c']])
    expect(rows.map((row) => row._id)).toEqual(['a', 'b', 'c'])
  })

  test('retries a failed later page instead of stopping on the first page', async () => {
    const fetchPage = vi.fn(async ({ page }) => {
      if (page === 2 && fetchPage.mock.calls.filter((call) => call[0].page === 2).length === 1) {
        throw new Error('later page failed')
      }
      if (page === 1) return { rows: [{ _id: 'a' }], total: 2 }
      return { rows: [{ _id: 'b' }], total: 2 }
    })
    const rows = await forEachListPage({ pageSize: 1, fetchPage })
    expect(rows.map((row) => row._id)).toEqual(['a', 'b'])
  })

  test('does not treat a repeated page as extra rows', async () => {
    const rows = await forEachListPage({
      pageSize: 1,
      fetchPage: async () => ({ rows: [{ _id: 'a' }], total: 5 }),
    })
    expect(rows).toEqual([{ _id: 'a' }])
  })
})
