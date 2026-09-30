import { describe, expect, test, vi } from 'vitest'

vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: vi.fn(), addEventListener: vi.fn() } }))
vi.mock('@/src/api/floor', () => ({ syncOperations: vi.fn() }))
vi.mock('@/src/offline/outbox', () => ({
  clearSynced: vi.fn(),
  listOutbox: vi.fn(),
  markOutbox: vi.fn(),
  pendingCount: vi.fn(),
}))

import { groupBySenderToken } from './sync'
import type { OutboxItem } from './outbox'

const item = (operationId: string, senderUserId?: string): OutboxItem => ({
  operationId,
  operationType: 'batch_entry',
  payload: {},
  clientTimestamp: '2026-09-30T08:00:00.000Z',
  syncStatus: 'PENDING',
  ...(senderUserId ? { senderUserId } : {}),
})

describe('offline batches keep their sender on a shared tablet', () => {
  test('items sync with the sender\'s login while they are logged in, otherwise with the primary login', () => {
    const tokens: Record<string, string> = { a: 'tok-a', b: 'tok-b' }
    const groups = groupBySenderToken(
      [item('1', 'a'), item('2'), item('3', 'b'), item('4', 'a'), item('5', 'gone')],
      (id) => tokens[id] ?? null,
    )
    expect(groups.map((g) => [g.token, g.items.map((i) => i.operationId)])).toEqual([
      ['tok-a', ['1', '4']],
      [null, ['2', '5']],
      ['tok-b', ['3']],
    ])
  })

  test('without a resolver everything goes with the primary login', () => {
    const groups = groupBySenderToken([item('1', 'a'), item('2')], null)
    expect(groups).toEqual([{ token: null, items: [item('1', 'a'), item('2')] }])
  })
})
