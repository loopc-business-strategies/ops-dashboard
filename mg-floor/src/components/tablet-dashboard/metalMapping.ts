import type { MetalBatchEdit } from './MetalProcessPanel'

export type MetalBatchBlock = MetalBatchEdit
export type MetalLine = MetalBatchEdit['lines'][number]

export type MovementLike = {
  _id?: string
  batchId?: string
  batchNumber?: string
  weight?: number
  metalType?: string
  purity?: string | number
  status?: string
  receivedAt?: string
  issuedAt?: string
  createdAt?: string
}

export type JobLike = {
  _id?: string
  batchId?: string
  batchNumber?: string
}

function formatTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatQty(weight?: number): string {
  if (weight == null || !Number.isFinite(Number(weight))) return ''
  return `${Number(weight)} g`
}

function formatPurity(purity?: string | number): string {
  if (purity == null || purity === '') return ''
  return String(purity)
}

function isMetalIn(m: MovementLike): boolean {
  if (m.receivedAt) return true
  return String(m.status || '').toUpperCase() === 'RECEIVED'
}

function isMetalOut(m: MovementLike): boolean {
  if (m.receivedAt) return false
  if (m.issuedAt) return true
  const s = String(m.status || '').toUpperCase()
  return s === 'ISSUED' || s === 'IN_TRANSIT'
}

function isAlloy(metalType?: string): boolean {
  return /alloy/i.test(String(metalType || ''))
}

function emptyBatch(label: string): MetalBatchBlock {
  return {
    batchLabel: label,
    lines: [
      { metal: 'Gold', qty: '', purity: '', time: '' },
      { metal: 'Alloy', qty: '', purity: '', time: '' },
    ],
  }
}

function lineFromMovement(metal: string, m?: MovementLike) {
  if (!m) return { metal, qty: '', purity: '', time: '' }
  return {
    metal,
    qty: formatQty(m.weight),
    purity: formatPurity(m.purity),
    time: formatTime(m.receivedAt || m.issuedAt || m.createdAt),
  }
}

function fillBatchFromMovements(label: string, movements: MovementLike[]): MetalBatchBlock {
  const gold = movements.find((m) => !isAlloy(m.metalType))
  const alloy = movements.find((m) => isAlloy(m.metalType))
  return {
    batchLabel: label,
    lines: [lineFromMovement('Gold', gold), lineFromMovement('Alloy', alloy)],
  }
}

/** Group today's movements into Batch 1 / Batch 2 slots (by unique batch, order preserved). */
export function buildMetalProcessBatches(
  movements: MovementLike[],
  kind: 'in' | 'out',
): MetalBatchBlock[] {
  const filtered = movements.filter((m) => (kind === 'in' ? isMetalIn(m) : isMetalOut(m)))
  const byBatch = new Map<string, MovementLike[]>()
  const order: string[] = []
  for (const m of filtered) {
    const key = String(m.batchId || m.batchNumber || m._id || '')
    if (!key) continue
    if (!byBatch.has(key)) {
      byBatch.set(key, [])
      order.push(key)
    }
    byBatch.get(key)!.push(m)
  }
  const keys = order.slice(0, 2)
  return [
    keys[0] ? fillBatchFromMovements('1', byBatch.get(keys[0]) || []) : emptyBatch('1'),
    keys[1] ? fillBatchFromMovements('2', byBatch.get(keys[1]) || []) : emptyBatch('2'),
  ]
}

export function assignedBatchLabels(jobs: JobLike[]): { batch1: string; batch2: string } {
  const nums = jobs.map((j) => String(j.batchNumber || '').trim()).filter(Boolean)
  return {
    batch1: nums[0] || '',
    batch2: nums[1] || '',
  }
}

export function formatClock(iso?: string | null): string {
  return formatTime(iso) || '--'
}
