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

/** Batch numbers restart every day, so a batch is identified by its day, direction and number. */
export type BatchKey = `${string}|${BatchDirection}|${string}`

export const batchKey = (entryDate: string, direction: BatchDirection, batchLabel: string): BatchKey =>
  `${entryDate}|${direction}|${batchLabel}`

function parseBatchKey(key: BatchKey) {
  const [entryDate, direction, ...label] = key.split('|')
  return { entryDate, direction: direction as BatchDirection, batchLabel: label.join('|') }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Tablet-local calendar day, the unit the Floor Manager approves batches in. */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function previousDateKey(d = new Date()) {
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))
}

/** '' for today's batches, otherwise a short tag for the day the batch belongs to. */
export function dayTag(entryDate: string, now = new Date()) {
  if (entryDate === localDateKey(now)) return ''
  if (entryDate === previousDateKey(now)) return 'Yesterday'
  return entryDate
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

/** Newest entry per day + direction + batch. */
export function latestEntries(entries: BatchEntryRow[]) {
  const latest = new Map<BatchKey, BatchEntryRow>()
  for (const entry of entries) {
    const key = batchKey(entry.entryDate, entry.direction, entry.batchLabel)
    const current = latest.get(key)
    if (!current || new Date(entry.submittedAt).getTime() > new Date(current.submittedAt).getTime()) {
      latest.set(key, entry)
    }
  }
  return latest
}

/**
 * Yesterday's batches whose Metal In was still open at midnight, so a night shift can close them.
 * Such a batch stays listed for the rest of the day once its Metal Out is sent.
 */
export function carriedOverEntries(yesterdayEntries: BatchEntryRow[], today: string): BatchEntryRow[] {
  const latest = latestEntries(yesterdayEntries)
  const open = new Set<string>()
  for (const entry of latest.values()) {
    if (entry.direction !== 'IN') continue
    const out = latest.get(batchKey(entry.entryDate, 'OUT', entry.batchLabel))
    if (!out || out.status === 'REJECTED' || localDateKey(new Date(out.submittedAt)) === today) {
      open.add(entry.batchLabel)
    }
  }
  return [...latest.values()].filter((entry) => open.has(entry.batchLabel))
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

/** A batch number on the day it belongs to. */
export type BatchChoice = {
  entryDate: string
  batchLabel: string
}

export type SentBatch = BatchChoice & {
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

/** Older days first, then batch order. */
function compareBatches(a: BatchChoice, b: BatchChoice) {
  return a.entryDate.localeCompare(b.entryDate) || compareBatchLabels(a.batchLabel, b.batchLabel)
}

const sameBatch = (a: BatchChoice, b: BatchChoice) => a.entryDate === b.entryDate && a.batchLabel === b.batchLabel

/** Batches already sent for one direction (today's, and yesterday's still open), in batch order. */
export function sentBatchesFor(
  direction: BatchDirection,
  states: Partial<Record<BatchKey, BatchApprovalState>>,
  sent: Map<BatchKey, { lines: BatchEntryLine[] }>,
): SentBatch[] {
  const rows: SentBatch[] = []
  for (const [key, state] of Object.entries(states) as Array<[BatchKey, BatchApprovalState | undefined]>) {
    const parsed = parseBatchKey(key)
    if (!state || parsed.direction !== direction) continue
    rows.push({ entryDate: parsed.entryDate, batchLabel: parsed.batchLabel, lines: sent.get(key)?.lines || [], state })
  }
  return rows.sort(compareBatches)
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
 * Batches a Metal Out can close: Metal In batches (today's, or yesterday's still open) with no
 * Metal Out yet. The workbook pairs IN and OUT by day and batch number, so with none open today's
 * next unused number is offered.
 */
export function metalOutChoices(metalIn: BatchChoice[], metalOut: BatchChoice[], today: string): BatchChoice[] {
  const open = metalIn
    .filter((b) => !metalOut.some((out) => sameBatch(out, b)))
    .map(({ entryDate, batchLabel }) => ({ entryDate, batchLabel }))
    .sort(compareBatches)
  if (open.length) return open
  const todayLabels = [...metalIn, ...metalOut].filter((b) => b.entryDate === today).map((b) => b.batchLabel)
  return [{ entryDate: today, batchLabel: nextBatchLabel(todayLabels) }]
}

/** Gold and Alloy always first (empty when not sent), then any other metals that were sent. */
export function withDefaultMetals(lines: BatchEntryLine[] = []): BatchEntryLine[] {
  const defaults = DEFAULT_METALS.map(
    (metal) => lines.find((l) => l.metal === metal) || { metal, qty: null, purity: null, time: '' },
  )
  return [...defaults, ...lines.filter((l) => !DEFAULT_METALS.includes(l.metal))]
}

/** Popup rows for a new batch, or for a rejected batch being fixed (its sent lines filled in). */
export function editableBatch({ entryDate, batchLabel }: BatchChoice, lines?: BatchEntryLine[]): MetalBatchEdit {
  return {
    batchLabel,
    entryDate,
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
