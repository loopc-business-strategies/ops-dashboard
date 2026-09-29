const OperationsProductionEntry = require('../../models/OperationsProductionEntry')
const { normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')

const DEFAULT_TIME_ZONE = 'Asia/Dubai'
const DAY_MS = 24 * 60 * 60 * 1000

const round = (value, places) => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

/** Workbook row identity for an MG Floor batch: one row per day, department and batch label. */
function floorBatchKey(entry) {
  return [entry.entryDate, normalizeFloorDepartment(entry.department), String(entry.batchLabel || '').trim()].join('|')
}

/** Tablet purity may be typed as % (99.5) or per-mille (995). */
function purityPercent(value) {
  const p = Number(value)
  if (value == null || value === '' || !Number.isFinite(p) || p <= 0) return null
  return p > 100 ? p / 10 : p
}

/**
 * Total weight of the batch lines, plus fine gold from the lines that carry a purity.
 * Lines without purity (e.g. alloy) add weight but no fine gold, so purity is the blended %.
 */
function summarizeLines(lines) {
  let weight = 0
  let fine = 0
  let hasPurity = false
  for (const line of Array.isArray(lines) ? lines : []) {
    const qty = Number(line?.qty)
    if (!Number.isFinite(qty) || qty <= 0) continue
    weight += qty
    const pct = purityPercent(line?.purity)
    if (pct != null) {
      hasPurity = true
      fine += (qty * pct) / 100
    }
  }
  if (weight <= 0) return { weight: null, fineGold: null, purity: null }
  return {
    weight: round(weight, 3),
    fineGold: hasPurity ? round(fine, 3) : null,
    purity: hasPurity ? Math.min(100, round((fine / weight) * 100, 2)) : null,
  }
}

/** Minutes east of UTC for an IANA zone at a given instant. */
function zoneOffsetMinutes(timeZone, at) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return Math.round((asUtc - at.getTime()) / 60000)
}

/** Tablet-local entryDate + "HH:MM" → Date, using the tablet's offset or MG_FLOOR_TIMEZONE. */
function lineTimestamp(entryDate, time, tzOffsetMinutes) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || '').trim())
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(entryDate || '').trim())
  if (!m || !d) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 23 || minutes > 59) return null
  const localAsUtc = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hours, minutes)
  let offset = Number.isInteger(tzOffsetMinutes) ? tzOffsetMinutes : null
  if (offset == null) {
    try {
      offset = zoneOffsetMinutes(process.env.MG_FLOOR_TIMEZONE || DEFAULT_TIME_ZONE, new Date(localAsUtc))
    } catch {
      offset = 0
    }
  }
  return new Date(localAsUtc - offset * 60000)
}

/** Earliest (IN) or latest (OUT) line time; falls back to when the batch was sent. */
function entryTimestamp(entry) {
  const times = (entry.lines || [])
    .filter((l) => Number(l?.qty) > 0)
    .map((l) => lineTimestamp(entry.entryDate, l.time, entry.tzOffsetMinutes))
    .filter(Boolean)
    .map((t) => t.getTime())
  if (times.length) return new Date(entry.direction === 'IN' ? Math.min(...times) : Math.max(...times))
  return entry.submittedAt ? new Date(entry.submittedAt) : null
}

/**
 * A night-shift Metal Out is filed under its Metal In's day, so a time after midnight reads as a
 * day early. A batch cannot end before it starts: move such an end forward by one day.
 */
function batchOverAfterStart(startedAt, overAt) {
  if (!startedAt || !overAt) return overAt
  const start = new Date(startedAt).getTime()
  const over = new Date(overAt).getTime()
  if (over >= start || start - over >= DAY_MS) return overAt
  return new Date(over + DAY_MS)
}

/**
 * Writes an APPROVED MG Floor batch into the Operations → Production workbook.
 * IN fills Metal IN, Purity, Fine Gold and Batch Start; OUT fills Metal OUT and Batch Over.
 * Idempotent: re-applying the same entry leaves the row unchanged. Only the workbook is written.
 */
async function applyApprovedEntryToWorkbook(entry) {
  const departmentKey = normalizeFloorDepartment(entry?.department)
  if (!entry || entry.status !== 'APPROVED' || !departmentKey) return null

  const key = floorBatchKey(entry)
  const sums = summarizeLines(entry.lines)
  const at = entryTimestamp(entry)
  const set = {
    source: 'mg_floor',
    departmentKey,
    date: entry.entryDate,
    batchNumber: String(entry.batchLabel || '').trim(),
    departmentManagerName: entry.decidedByName || '',
  }
  const setOnInsert = {
    createdById: entry.decidedById || null,
    createdByName: entry.decidedByName || '',
  }
  if (entry.direction === 'IN') {
    Object.assign(set, {
      metalIn: sums.weight,
      purity: sums.purity,
      fineGold: sums.fineGold,
      batchStartedAt: at,
      employeeName: entry.employeeName || '',
      floorInEntryId: entry.entryId,
    })
  } else {
    Object.assign(set, { metalOut: sums.weight, batchOverAt: at, floorOutEntryId: entry.entryId })
    setOnInsert.employeeName = entry.employeeName || ''
  }

  const update = { $set: set, $setOnInsert: setOnInsert }
  const opts = { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  let row
  try {
    row = await OperationsProductionEntry.findOneAndUpdate({ floorBatchKey: key }, update, opts)
  } catch (err) {
    if (err?.code !== 11000) throw err
    row = await OperationsProductionEntry.findOneAndUpdate({ floorBatchKey: key }, update, { ...opts, upsert: false })
  }
  if (!row) return null

  const loss = row.metalIn != null && row.metalOut != null ? Math.max(0, round(row.metalIn - row.metalOut, 3)) : null
  const overAt = batchOverAfterStart(row.batchStartedAt, row.batchOverAt)
  if (loss !== row.metalLoss || overAt !== row.batchOverAt) {
    row.metalLoss = loss
    row.batchOverAt = overAt
    await row.save()
  }
  return row
}

/**
 * Re-applies every APPROVED batch to the workbook (batches approved before the link existed, or a
 * workbook write that failed). Safe to repeat. Batches from retired departments are skipped.
 */
async function syncApprovedEntriesToWorkbook() {
  const FloorBatchEntry = require('../../models/FloorBatchEntry')
  const entries = await FloorBatchEntry.find({ status: 'APPROVED' }).sort({ decidedAt: 1 }).lean()
  const skippedDepartments = {}
  let linked = 0
  for (const entry of entries) {
    const row = await applyApprovedEntryToWorkbook(entry)
    if (row) {
      linked += 1
    } else {
      const dept = entry.department || '(none)'
      skippedDepartments[dept] = (skippedDepartments[dept] || 0) + 1
    }
  }
  return { approved: entries.length, linked, skipped: entries.length - linked, skippedDepartments }
}

module.exports = {
  applyApprovedEntryToWorkbook,
  syncApprovedEntriesToWorkbook,
  floorBatchKey,
  lineTimestamp,
  summarizeLines,
}
