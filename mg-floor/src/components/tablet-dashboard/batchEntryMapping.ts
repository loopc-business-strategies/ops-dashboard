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
    const purityFromValue = line.purityValue != null && String(line.purityValue).trim() !== ''
      ? parseNumber(line.purityValue)
      : null
    const purityLooksLikeText = !purityFromValue && /%|[A-Za-z]/.test(String(line.purity || ''))
    const purity = purityFromValue || (purityLooksLikeText ? { empty: true, value: null } : parseNumber(line.purity))
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
/** Metal In always starts with gold / alloy / silver / copper rows. */
export const DEFAULT_METALS = ['Gold', 'Alloy', 'Silver', 'Copper']
export const MAX_BATCH_LINES = 8

/** Alloy is added when metal goes in, so Metal Out never asks for it. */
const IN_ONLY_METALS = ['Alloy']

export function metalOptionsFor(direction: BatchDirection) {
  return direction === 'OUT' ? METAL_OPTIONS.filter((m) => !IN_ONLY_METALS.includes(m)) : METAL_OPTIONS
}

export function defaultMetalsFor(direction: BatchDirection) {
  return direction === 'OUT' ? DEFAULT_METALS.filter((m) => !IN_ONLY_METALS.includes(m)) : DEFAULT_METALS
}

const ALLOY_MIX_BATCH_RE = /^(?:BMG|AMX)-/i

export function isAlloyMixBatchCode(value: string | null | undefined) {
  return ALLOY_MIX_BATCH_RE.test(String(value || '').trim())
}

export function shortMixMetalLabel(name = '') {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return ''
  if (/gold|xau|au\b/.test(n)) return 'Gold'
  if (/copper|cu\b/.test(n)) return 'Copper'
  if (/silver|xag|ag\b/.test(n)) return 'Silver'
  if (/platinum|xpt|pt\b/.test(n)) return 'Platinum'
  if (/palladium|xpd|pd\b/.test(n)) return 'Palladium'
  return String(name || '').trim()
}

export type MixCompositionPart = { label: string; share: number; shareText: string }

function roundMixShare(value: number, places = 6) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const f = 10 ** places
  return Math.round(n * f) / f
}

function roundMixGrams(value: number, places = 3) {
  return roundMixShare(value, places)
}

/** Scale consume grams down to finished target when Update metal loss left stale inputs. */
function mixComponentsForShare(job: {
  purity?: number | null
  targetGross?: number | null
  inputComponents?: Array<{ name?: string; label?: string; gross?: number }> | null
} | null | undefined): { target: number; rows: Array<{ name: string; gross: number }> } {
  const components = Array.isArray(job?.inputComponents) ? job.inputComponents : []
  const rows: Array<{ name: string; gross: number }> = []
  for (const row of components) {
    const name = String(row?.name || row?.label || '').trim()
    const gross = Number(row?.gross)
    if (!name || !(gross > 0)) continue
    if (/^alloy$/i.test(name) || /alloyed\s+gold/i.test(name)) continue
    rows.push({ name, gross })
  }
  const target = Number(job?.targetGross) > 0
    ? Number(job.targetGross)
    : rows.reduce((sum, row) => sum + row.gross, 0)
  const sum = rows.reduce((acc, row) => acc + row.gross, 0)
  if (!(target > 0) || !(sum > target + 0.0005)) {
    return { target, rows }
  }
  let allocated = 0
  const scaled = rows.map((row, index) => {
    const isLast = index === rows.length - 1
    const remain = isLast
      ? roundMixGrams(target - allocated)
      : roundMixGrams(row.gross * (target / sum))
    if (!isLast) allocated = roundMixGrams(allocated + remain)
    return { ...row, gross: remain }
  }).filter((row) => row.gross > 0)
  return { target, rows: scaled }
}

/**
 * Same purity/share numbers as Gold Alloy View mix (finished 0.76, Gold / Copper shares).
 * Fixed from Post Mix — does not change when Metal Out gross changes.
 */
export function postMixCompositionParts(job: {
  purity?: number | null
  targetGross?: number | null
  inputComponents?: Array<{ name?: string; label?: string; gross?: number }> | null
} | null | undefined): MixCompositionPart[] {
  const { target, rows } = mixComponentsForShare(job)
  const parts: MixCompositionPart[] = []
  const purityPct = job?.purity != null && Number(job.purity) > 0 ? Number(job.purity) : null
  if (purityPct != null) {
    const finishedFrac = purityPct > 1.2 && purityPct <= 100 ? purityPct / 100 : purityPct
    if (finishedFrac > 0 && finishedFrac <= 1.2) {
      const share = roundMixShare(finishedFrac, 2)
      parts.push({ label: 'finished', share, shareText: share.toFixed(2) })
    }
  }
  for (const row of rows) {
    const share = target > 0 ? roundMixShare(row.gross / target, 6) : 0
    if (!(share > 0)) continue
    parts.push({
      label: shortMixMetalLabel(row.name),
      share,
      shareText: String(share),
    })
  }
  return parts
}

/** Joined label for titles/tests. */
export function postMixCompositionLabel(job: {
  purity?: number | null
  targetGross?: number | null
  inputComponents?: Array<{ name?: string; label?: string; gross?: number }> | null
} | null | undefined): string {
  return postMixCompositionParts(job)
    .map(({ label, shareText }) => `${label} ${shareText}`)
    .join(' · ')
}

export type AlloyFinishedSeedLine = BatchEntryLine & {
  /** Post Mix Gold/Copper share text for the Purity column. */
  purityDisplay?: string
  compositionParts?: MixCompositionPart[]
}

/**
 * One Metal Out line for a Gold Alloy batch: finished product name.
 * Display purity = Post Mix composition (Gold % · Copper %); API uses finished %.
 */
export function finishedMetalOutLineFromJob(job: {
  finishedProductName?: string | null
  karat?: number | null
  purity?: number | null
  targetGross?: number | null
  inputComponents?: Array<{ name?: string; label?: string; gross?: number }> | null
} | null | undefined): AlloyFinishedSeedLine[] {
  if (!job) return []
  const karat = Number(job.karat)
  const metal = String(job.finishedProductName || '').trim()
    || (Number.isFinite(karat) && karat > 0 ? `${karat}K alloyed gold` : 'Alloyed gold')
  const finishedPurity = job.purity != null && Number(job.purity) > 0
    ? Math.round(Number(job.purity) * 1000) / 1000
    : null
  const compositionParts = postMixCompositionParts(job)
  const composition = compositionParts.map(({ label, shareText }) => `${label} ${shareText}`).join(' · ')
  return [{
    metal,
    qty: null,
    purity: finishedPurity,
    time: '',
    ...(composition ? { purityDisplay: composition } : {}),
    ...(compositionParts.length ? { compositionParts } : {}),
  }]
}

/** Prefill Metal In/Out from Post Mix Inputs (OUT) product + grams. */
export function linesFromMixInputComponents(
  components: Array<{ name?: string; label?: string; gross?: number }> | null | undefined,
): BatchEntryLine[] {
  if (!Array.isArray(components) || !components.length) return []
  const lines: BatchEntryLine[] = []
  for (const row of components) {
    const metal = String(row?.name || row?.label || '').trim()
    const qty = Number(row?.gross)
    if (!metal || !(qty > 0)) continue
    lines.push({
      metal,
      qty: Math.round(qty * 1000) / 1000,
      purity: null,
      time: '',
    })
  }
  return lines
}

/** Sum of Metal In / Out line quantities (grams). */
export function sumBatchLineQty(lines: Array<{ qty?: number | null }> | null | undefined): number {
  if (!Array.isArray(lines) || !lines.length) return 0
  return Math.round(
    lines.reduce((sum, row) => sum + (Number(row?.qty) || 0), 0) * 1000,
  ) / 1000
}

/** e.g. 256 → "256 g total" */
export function formatBatchTotalLabel(grams: number | null | undefined): string {
  const n = Number(grams)
  if (!Number.isFinite(n) || !(n > 0)) return ''
  return `${Math.round(n * 1000) / 1000} g total`
}

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

const sameLabel = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

/**
 * Metal In batch choices: each open alloy mix on this department is its own batch (BMG-…),
 * then a numeric fallback for non-alloy metal.
 */
export function metalInChoices(
  openMixCodes: string[],
  metalIn: BatchChoice[],
  today: string,
): BatchChoice[] {
  const used = metalIn.map((b) => b.batchLabel)
  const mixChoices = openMixCodes
    .map((code) => String(code || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((code, i, all) => all.indexOf(code) === i)
    .filter((code) => !used.some((label) => sameLabel(label, code)))
    .map((batchLabel) => ({ entryDate: today, batchLabel }))
    .sort(compareBatches)
  if (mixChoices.length) return mixChoices
  const todayLabels = metalIn.filter((b) => b.entryDate === today).map((b) => b.batchLabel)
  return [{ entryDate: today, batchLabel: nextBatchLabel(todayLabels) }]
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

/**
 * The direction's default metals always first (Gold/Alloy/Silver/Copper for Metal In,
 * Gold/Silver/Copper for Metal Out), empty when not sent, then any other metals that were sent.
 * When `preferSeedOnly` is set (alloy mix product lines), show those rows as-is.
 */
export function withDefaultMetals(
  lines: Array<BatchEntryLine | AlloyFinishedSeedLine> = [],
  direction: BatchDirection = 'IN',
  preferSeedOnly = false,
): AlloyFinishedSeedLine[] {
  if (preferSeedOnly && lines.length) {
    return lines.map((l) => ({
      metal: l.metal,
      qty: l.qty ?? null,
      purity: l.purity ?? null,
      time: l.time || '',
      ...('purityDisplay' in l && l.purityDisplay ? { purityDisplay: l.purityDisplay } : {}),
      ...('compositionParts' in l && Array.isArray(l.compositionParts) && l.compositionParts.length
        ? { compositionParts: l.compositionParts }
        : {}),
    }))
  }
  const defaultMetals = defaultMetalsFor(direction)
  const defaults = defaultMetals.map(
    (metal) => lines.find((l) => l.metal === metal) || { metal, qty: null, purity: null, time: '' },
  )
  return [...defaults, ...lines.filter((l) => !defaultMetals.includes(l.metal))]
}

/** Popup rows for a new batch, or for a rejected batch being fixed (its sent lines filled in). */
export function editableBatch(
  { entryDate, batchLabel }: BatchChoice,
  lines?: Array<BatchEntryLine | AlloyFinishedSeedLine>,
  direction: BatchDirection = 'IN',
  opts: { preferSeedOnly?: boolean } = {},
): MetalBatchEdit {
  return {
    batchLabel,
    entryDate,
    lines: withDefaultMetals(lines, direction, Boolean(opts.preferSeedOnly)).map((l) => {
      const composition = 'purityDisplay' in l ? String(l.purityDisplay || '').trim() : ''
      const parts = 'compositionParts' in l && Array.isArray(l.compositionParts) ? l.compositionParts : []
      return {
        metal: l.metal,
        qty: show(l.qty),
        purity: composition || show(l.purity),
        time: l.time || '',
        ...(composition && l.purity != null ? { purityValue: show(l.purity) } : {}),
        ...(parts.length ? { compositionParts: parts } : {}),
      }
    }),
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
