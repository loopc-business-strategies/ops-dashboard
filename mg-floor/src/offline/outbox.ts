import AsyncStorage from '@react-native-async-storage/async-storage'

export type OutboxItem = {
  operationId: string
  operationType: 'metal_in' | 'metal_out' | 'transfer' | 'weight_adjust' | 'xrf_test'
  payload: Record<string, unknown>
  deviceId?: string
  scaleId?: string
  clientTimestamp: string
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT'
  errorMessage?: string
}

const STORAGE_KEY = 'mg_floor_outbox_v1'
const SCHEMA_VERSION = 1
const LEGACY_MEMORY_KEY = '__mg_floor_outbox__'

type StoredShape = {
  version: number
  items: OutboxItem[]
}

let cache: OutboxItem[] | null = null
let writeChain: Promise<void> = Promise.resolve()

function migrateLegacyMemory(): OutboxItem[] {
  try {
    const g = globalThis as unknown as Record<string, OutboxItem[]>
    const legacy = g[LEGACY_MEMORY_KEY]
    if (Array.isArray(legacy) && legacy.length) {
      const copy = [...legacy]
      g[LEGACY_MEMORY_KEY] = []
      return copy
    }
  } catch {
    // ignore
  }
  return []
}

async function load(): Promise<OutboxItem[]> {
  if (cache) return cache
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredShape
      const items = Array.isArray(parsed?.items) ? parsed.items : []
      cache = items
      return cache
    }
  } catch (err) {
    console.warn('[MG Floor] outbox load failed', err)
  }
  const migrated = migrateLegacyMemory()
  cache = migrated
  if (migrated.length) await persist(migrated)
  return cache
}

async function persist(items: OutboxItem[]) {
  cache = items
  const payload: StoredShape = { version: SCHEMA_VERSION, items }
  writeChain = writeChain.then(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (err) {
      console.warn('[MG Floor] outbox persist failed', err)
    }
  })
  await writeChain
}

export function createOperationId(prefix = 'op') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function enqueueOutbox(
  item: Omit<OutboxItem, 'syncStatus' | 'clientTimestamp'> & {
    clientTimestamp?: string
  },
) {
  const items = await load()
  const row: OutboxItem = {
    ...item,
    clientTimestamp: item.clientTimestamp || new Date().toISOString(),
    syncStatus: 'PENDING',
  }
  const next = [...items.filter((i) => i.operationId !== row.operationId), row]
  await persist(next)
  return row
}

export async function listOutbox() {
  return [...(await load())]
}

export async function pendingCount() {
  const items = await load()
  return items.filter((i) => i.syncStatus === 'PENDING' || i.syncStatus === 'FAILED').length
}

export async function markOutbox(operationId: string, patch: Partial<OutboxItem>) {
  const items = await load()
  const idx = items.findIndex((i) => i.operationId === operationId)
  if (idx < 0) return
  const next = [...items]
  next[idx] = { ...next[idx], ...patch }
  await persist(next)
}

export async function clearSynced() {
  const items = await load()
  await persist(items.filter((i) => i.syncStatus !== 'SYNCED'))
}
