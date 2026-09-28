import { beforeEach, describe, expect, test, vi } from 'vitest'

const store = vi.hoisted(() => new Map<string, string>())

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k)
    }),
  },
}))

const item = (operationId: string, operationType: string) => ({
  operationId,
  operationType,
  payload: {},
  clientTimestamp: '2026-09-28T08:00:00.000Z',
  syncStatus: 'PENDING',
})

async function freshOutbox() {
  vi.resetModules()
  return import('./outbox')
}

describe('outbox helpers', () => {
  beforeEach(() => store.clear())

  test('createOperationId is unique-ish', async () => {
    const { createOperationId } = await freshOutbox()
    const a = createOperationId('be')
    const b = createOperationId('be')
    expect(a).not.toBe(b)
    expect(a.startsWith('be_')).toBe(true)
  })

  test('dropRemovedOperations keeps only batch_entry and weight_adjust', async () => {
    const { dropRemovedOperations } = await freshOutbox()
    const kept = dropRemovedOperations([
      item('a', 'batch_entry'),
      item('b', 'metal_in'),
      item('c', 'metal_out'),
      item('d', 'transfer'),
      item('e', 'xrf_test'),
      item('f', 'weight_capture'),
      item('g', 'weight_adjust'),
      null,
    ])
    expect(kept.map((i) => i.operationId)).toEqual(['a', 'g'])
  })

  test('first load purges queued removed types and the old photo queue', async () => {
    store.set(
      'mg_floor_outbox_v1',
      JSON.stringify({
        version: 1,
        items: [item('keep', 'batch_entry'), item('old-in', 'metal_in'), item('old-cap', 'weight_capture')],
      }),
    )
    store.set('mg_floor_photo_queue_v1', JSON.stringify({ items: [{ captureId: 'x' }] }))

    const { listOutbox, pendingCount } = await freshOutbox()
    expect((await listOutbox()).map((i) => i.operationId)).toEqual(['keep'])
    expect(await pendingCount()).toBe(1)
    await vi.waitFor(() => expect(store.has('mg_floor_photo_queue_v1')).toBe(false))
    const persisted = JSON.parse(store.get('mg_floor_outbox_v1') || '{}')
    expect(persisted.items.map((i: { operationId: string }) => i.operationId)).toEqual(['keep'])
  })
})
