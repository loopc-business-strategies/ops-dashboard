import NetInfo from '@react-native-community/netinfo'
import { syncOperations } from '@/src/api/floor'
import { clearSynced, listOutbox, markOutbox, pendingCount } from '@/src/offline/outbox'

export async function flushOutbox() {
  const pending = (await listOutbox()).filter(
    (i) => i.syncStatus === 'PENDING' || i.syncStatus === 'FAILED',
  )
  if (!pending.length) return { synced: 0, results: [] as unknown[] }

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
        scaleId: p.scaleId,
        clientTimestamp: p.clientTimestamp,
      })),
    )
    for (const r of res.results as Array<{ operationId: string; syncStatus: string; errorMessage?: string }>) {
      await markOutbox(r.operationId, {
        syncStatus: r.syncStatus as 'SYNCED' | 'FAILED' | 'CONFLICT',
        errorMessage: r.errorMessage,
      })
    }
    await clearSynced()
    return { synced: pending.length, results: res.results }
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
