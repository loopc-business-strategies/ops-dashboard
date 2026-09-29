import type { BatchDirection, BatchEntryLine, BatchEntryRow, BatchEntryStatus } from '@/src/api/batchEntries'
import type { MetalBatchEdit } from './MetalProcessPanel'
import { normalizeTime } from './fieldInput'

/** QUEUED: saved in the offline outbox, not yet on the server. */
export type BatchApprovalState = {
  status: BatchEntryStatus | 'QUEUED'
  entryId: string
  rejectReason?: string
  decidedByName?: string
}

export type BatchKey = `${BatchDirection}|${string}`

export const batchKey = (direction: BatchDirection, batchLabel: string): BatchKey => `${direction}|${batchLabel}`

const pad = (n: number) => String(n).padStart(2, '0')

/** Tablet-local calendar day, the unit the Floor Manager approves batches in. */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function clockNow(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseNumber(raw: string) {
  const text = raw.trim().replace(',', '.')
  if (!text) return { empty: true, value: null as number | null }
  const value = Number(text)
  return { empty: false, value: Number.isFinite(value) ? value : null }
}

/**
 * Turn one typed batch into the lines sent for approval. Empty rows are skipped; a row with a
 * quantity and no time gets the current time.
 */
export function prepareBatchLines(batch: MetalBatchEdit, now = new Date()): { lines: BatchEntryLine[]; error: string | null } {
  const lines: BatchEntryLine[] = []
  for (const line of batch.lines) {
    const qty = parseNumber(line.qty)
    const purity = parseNumber(line.purity)
    const time = line.time.trim()
    if (qty.empty && purity.empty && !time) continue
    if (qty.empty) return { lines: [], error: `Enter Qty for ${line.metal}` }
    if (qty.value == null || qty.value <= 0) return { lines: [], error: `Qty for ${line.metal} must be a number above 0` }
    if (!purity.empty && (purity.value == null || purity.value <= 0 || purity.value > 1000)) {
      return { lines: [], error: `Purity for ${line.metal} must be a number between 0 and 1000` }
    }
    const typedTime = normalizeTime(time)
    if (typedTime == null) return { lines: [], error: `Time for ${line.metal} must be like 14:30 (00:00 to 23:59)` }
    lines.push({ metal: line.metal, qty: qty.value, purity: purity.value, time: typedTime || clockNow(now) })
  }
  if (!lines.length) return { lines: [], error: `Enter Qty for Batch ${batch.batchLabel} first` }
  return { lines, error: null }
}

/** Newest entry per direction + batch. */
export function latestEntries(entries: BatchEntryRow[]) {
  const latest = new Map<BatchKey, BatchEntryRow>()
  for (const entry of entries) {
    const key = batchKey(entry.direction, entry.batchLabel)
    const current = latest.get(key)
    if (!current || new Date(entry.submittedAt).getTime() > new Date(current.submittedAt).getTime()) {
      latest.set(key, entry)
    }
  }
  return latest
}

export function stateFromEntry(entry: BatchEntryRow): BatchApprovalState {
  return {
    status: entry.status,
    entryId: entry.entryId,
    rejectReason: entry.rejectReason || undefined,
    decidedByName: entry.decidedByName || undefined,
  }
}

/** Metals offered in the Metal In / Out popup; the backend keeps up to 8 lines per batch. */
export const METAL_OPTIONS = ['Gold', 'Alloy', 'Silver', 'Copper', 'Platinum', 'Palladium']
export const DEFAULT_METALS = ['Gold', 'Alloy']
export const MAX_BATCH_LINES = 8

export type SentBatch = {
  batchLabel: string
  lines: BatchEntryLine[]
  state: BatchApprovalState
}

const show = (n: number | null | undefined) => (n == null ? '' : String(n))

export function compareBatchLabels(a: string, b: string) {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return a.localeCompare(b)
}

/** Batches already sent today for one direction, in batch order. */
export function sentBatchesFor(
  direction: BatchDirection,
  states: Partial<Record<BatchKey, BatchApprovalState>>,
  sent: Map<BatchKey, { lines: BatchEntryLine[] }>,
): SentBatch[] {
  const prefix = `${direction}|`
  const rows: SentBatch[] = []
  for (const [key, state] of Object.entries(states) as Array<[BatchKey, BatchApprovalState | undefined]>) {
    if (!state || !key.startsWith(prefix)) continue
    rows.push({ batchLabel: key.slice(prefix.length), lines: sent.get(key)?.lines || [], state })
  }
  return rows.sort((a, b) => compareBatchLabels(a.batchLabel, b.batchLabel))
}

/** One above the highest numeric batch label (labels are per day and department). */
export function nextBatchLabel(labels: string[]) {
  const max = labels.reduce((m, label) => {
    const n = Number(label)
    return Number.isInteger(n) && n > m ? n : m
  }, 0)
  return String(max + 1)
}

/**
 * Batch numbers a Metal Out can close: Metal In batches with no Metal Out yet. The workbook pairs
 * IN and OUT by batch number, so with none open the next unused number is offered.
 */
export function metalOutChoices(inLabels: string[], outLabels: string[]) {
  const closed = new Set(outLabels)
  const open = inLabels.filter((label) => !closed.has(label)).sort(compareBatchLabels)
  return open.length ? open : [nextBatchLabel([...inLabels, ...outLabels])]
}

/** Gold and Alloy always first (empty when not sent), then any other metals that were sent. */
export function withDefaultMetals(lines: BatchEntryLine[] = []): BatchEntryLine[] {
  const defaults = DEFAULT_METALS.map(
    (metal) => lines.find((l) => l.metal === metal) || { metal, qty: null, purity: null, time: '' },
  )
  return [...defaults, ...lines.filter((l) => !DEFAULT_METALS.includes(l.metal))]
}

/** Popup rows for a new batch, or for a rejected batch being fixed (its sent lines filled in). */
export function editableBatch(batchLabel: string, lines?: BatchEntryLine[]): MetalBatchEdit {
  return {
    batchLabel,
    lines: withDefaultMetals(lines).map((l) => ({
      metal: l.metal,
      qty: show(l.qty),
      purity: show(l.purity),
      time: l.time || '',
    })),
  }
}

export function batchStatusView(state?: BatchApprovalState): { label: string; tone: 'neutral' | 'warn' | 'ok' | 'bad'; note: string } | null {
  if (!state) return null
  switch (state.status) {
    case 'QUEUED':
      return { label: 'SAVED OFFLINE', tone: 'neutral', note: 'Will be sent to the Floor Manager when online' }
    case 'PENDING':
      return { label: 'WAITING FOR F.M', tone: 'warn', note: 'Sent to the Floor Manager for approval' }
    case 'APPROVED':
      return { label: 'APPROVED', tone: 'ok', note: state.decidedByName ? `Approved by ${state.decidedByName}` : 'Approved' }
    case 'REJECTED':
      return {
        label: 'REJECTED',
        tone: 'bad',
        note: `${state.rejectReason || 'Rejected'}${state.decidedByName ? ` — ${state.decidedByName}` : ''}. Tap FIX & RESEND to correct it.`,
      }
    default:
      return null
  }
}
