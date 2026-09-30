import NetInfo from '@react-native-community/netinfo'
import { syncOperations } from '@/src/api/floor'
import { clearSynced, listOutbox, markOutbox, pendingCount, type OutboxItem } from '@/src/offline/outbox'

/** Looks up the login of the employee who queued an item; null falls back to the tablet's primary login. */
let senderTokenResolver: ((userId: string) => string | null) | null = null

export function setSenderTokenResolver(resolver: ((userId: string) => string | null) | null) {
  senderTokenResolver = resolver
}

/** Splits queued items by the login they will be sent with (the sender's, or the primary one). */
export function groupBySenderToken(
  items: OutboxItem[],
  resolve: ((userId: string) => string | null) | null,
): Array<{ token: string | null; items: OutboxItem[] }> {
  const groups = new Map<string, { token: string | null; items: OutboxItem[] }>()
  for (const item of items) {
    const token = (item.senderUserId && resolve?.(item.senderUserId)) || null
    const key = token || ''
    const group = groups.get(key) || { token, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
}

async function flushGroup(token: string | null, pending: OutboxItem[]) {
  for (const item of pending) {
    await markOutbox(item.operationId, { syncStatus: 'SYNCING' })
  }

  try {
    const res = await syncOperations(
      pending.map((p) => ({
        operationId: p.operationId,
        operationType: p.operationType,
        payload: p.payload,
        deviceId: p.deviceId,
        clientTimestamp: p.clientTimestamp,
      })),
      token,
    )
    for (const r of res.results as Array<{ operationId: string; syncStatus: string; errorMessage?: string }>) {
      await markOutbox(r.operationId, {
        syncStatus: r.syncStatus as 'SYNCED' | 'FAILED' | 'CONFLICT',
        errorMessage: r.errorMessage,
      })
    }
    return res.results
  } catch (err) {
    for (const item of pending) {
      await markOutbox(item.operationId, {
        syncStatus: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'sync failed',
      })
    }
    throw err
  }
}

export async function flushOutbox() {
  const pending = (await listOutbox()).filter(
    (i) => i.syncStatus === 'PENDING' || i.syncStatus === 'FAILED',
  )
  if (!pending.length) return { synced: 0, results: [] as unknown[] }

  const results: unknown[] = []
  let firstError: unknown = null
  for (const group of groupBySenderToken(pending, senderTokenResolver)) {
    try {
      results.push(...(await flushGroup(group.token, group.items)))
    } catch (err) {
      firstError = firstError || err
    }
  }
  await clearSynced()
  if (firstError) throw firstError
  return { synced: pending.length, results }
}

export function startAutoSync(intervalMs = 15000) {
  let timer: ReturnType<typeof setInterval> | null = null
  const tick = async () => {
    const net = await NetInfo.fetch()
    if (!net.isConnected) return
    const n = await pendingCount()
    if (n > 0) {
      try {
        await flushOutbox()
      } catch {
        // retry next interval
      }
    }
  }
  timer = setInterval(tick, intervalMs)
  const unsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) tick()
  })
  tick()
  return () => {
    if (timer) clearInterval(timer)
    unsub()
  }
}
