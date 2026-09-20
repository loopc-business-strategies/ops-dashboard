export type OutboxItem = {
  operationId: string
  operationType: 'metal_in' | 'metal_out' | 'transfer' | 'weight_adjust'
  payload: Record<string, unknown>
  deviceId?: string
  scaleId?: string
  clientTimestamp: string
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT'
  errorMessage?: string
}

const MEMORY_KEY = '__mg_floor_outbox__'

function store(): OutboxItem[] {
  const g = globalThis as unknown as Record<string, OutboxItem[]>
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = []
  return g[MEMORY_KEY]
}

export function createOperationId(prefix = 'op') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function enqueueOutbox(item: Omit<OutboxItem, 'syncStatus' | 'clientTimestamp'> & {
  clientTimestamp?: string
}) {
  const row: OutboxItem = {
    ...item,
    clientTimestamp: item.clientTimestamp || new Date().toISOString(),
    syncStatus: 'PENDING',
  }
  store().push(row)
  return row
}

export async function listOutbox() {
  return [...store()]
}

export async function pendingCount() {
  return store().filter((i) => i.syncStatus === 'PENDING' || i.syncStatus === 'FAILED').length
}

export async function markOutbox(operationId: string, patch: Partial<OutboxItem>) {
  const items = store()
  const idx = items.findIndex((i) => i.operationId === operationId)
  if (idx >= 0) items[idx] = { ...items[idx], ...patch }
}

export async function clearSynced() {
  const items = store()
  const next = items.filter((i) => i.syncStatus !== 'SYNCED')
  items.length = 0
  items.push(...next)
}
