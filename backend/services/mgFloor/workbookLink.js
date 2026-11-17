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
 * AMX Metal In is already written as gold_alloy on Incoming Approve (receiveMixJob).
 * FM approve of the seeded Floor batch must attach to that custody row — never create a
 * parallel mg_floor Melting Metal IN/OUT (that double-counts Ops / Production Dashboard totals).
 * Metal Out weight still comes from allocate→vault (gold_alloy OUT); we only stamp floorOutEntryId.
 */
async function linkAlloyMixFloorApproval(entry, departmentKey, alloyMixCode) {
  if (!alloyMixCode || !departmentKey) return null

  if (entry.direction === 'IN') {
    const row = await OperationsProductionEntry.findOne({
      alloyMixCode,
      departmentKey,
      source: 'gold_alloy',
      metalIn: { $ne: null },
    }).sort({ updatedAt: -1 })
    if (!row) return null
    row.floorInEntryId = entry.entryId
    row.departmentManagerName = entry.decidedByName || row.departmentManagerName
    if (entry.employeeName) row.employeeName = entry.employeeName
    await row.save()
    return row
  }

  const inRow = await OperationsProductionEntry.findOne({
    alloyMixCode,
    departmentKey,
    source: 'gold_alloy',
    metalIn: { $ne: null },
  }).sort({ updatedAt: -1 })
  if (!inRow) return null
  inRow.floorOutEntryId = entry.entryId
  inRow.departmentManagerName = entry.decidedByName || inRow.departmentManagerName
  await inRow.save()
  return inRow
}

/**
 * Writes an APPROVED MG Floor batch into the Operations → Production workbook.
 * IN fills Metal IN, Purity, Fine Gold and Batch Start; OUT fills Metal OUT, Purity OUT, Fine Gold OUT
 * and Batch Over.
 * Idempotent: re-applying the same entry leaves the row unchanged. Only the workbook is written.
 */
async function applyApprovedEntryToWorkbook(entry) {
  const departmentKey = normalizeFloorDepartment(entry?.department)
  if (!entry || entry.status !== 'APPROVED' || !departmentKey) return null

  const key = floorBatchKey(entry)
  const sums = summarizeLines(entry.lines)
  const at = entryTimestamp(entry)
  const batchNumber = String(entry.batchLabel || '').trim()
  // Alloy mix batches use AMX-… as the label so Ops can match Gold Alloy / Floor allocate.
  const alloyMixCode = /^AMX-/i.test(batchNumber) ? batchNumber.toUpperCase() : ''

  // Prefer existing gold_alloy custody row for AMX — one Melting Metal IN per mix.
  if (alloyMixCode) {
    const linked = await linkAlloyMixFloorApproval(entry, departmentKey, alloyMixCode)
    if (linked) return linked
  }

  const set = {
    source: 'mg_floor',
    departmentKey,
    date: entry.entryDate,
    batchNumber,
    departmentManagerName: entry.decidedByName || '',
    ...(alloyMixCode ? { alloyMixCode } : {}),
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
    Object.assign(set, {
      metalOut: sums.weight,
      purityOut: sums.purity,
      fineGoldOut: sums.fineGold,
      batchOverAt: at,
      floorOutEntryId: entry.entryId,
    })
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

const IN_FIELDS = { metalIn: null, purity: null, fineGold: null, batchStartedAt: null, floorInEntryId: '' }
const OUT_FIELDS = { metalOut: null, purityOut: null, fineGoldOut: null, batchOverAt: null, floorOutEntryId: '' }

/**
 * Takes an undone batch back out of its workbook row: clears the Metal In or Metal Out side it
 * filled, and removes the row when nothing else is left on it (no other side, rating, breakdown
 * or requests). Returns 'cleared', 'removed', or null when the row no longer carries this entry.
 * AMX gold_alloy custody rows only drop the floor link — Metal IN stayed from Incoming Approve.
 */
async function removeEntryFromWorkbook(entry) {
  const isIn = entry.direction === 'IN'
  let row = await OperationsProductionEntry.findOne({ floorBatchKey: floorBatchKey(entry) })
  if (!row) {
    row = await OperationsProductionEntry.findOne(
      isIn ? { floorInEntryId: entry.entryId } : { floorOutEntryId: entry.entryId },
    )
  }
  if (!row) return null
  if ((isIn ? row.floorInEntryId : row.floorOutEntryId) !== entry.entryId) return null

  // Alloy receive already owns Metal IN; undoing FM only unlinks the floor stamp.
  if (row.source === 'gold_alloy' && String(row.alloyMixCode || '').trim()) {
    if (isIn) row.floorInEntryId = ''
    else row.floorOutEntryId = ''
    await row.save()
    return 'cleared'
  }

  Object.assign(row, isIn ? IN_FIELDS : OUT_FIELDS, { metalLoss: null })
  const hasOtherSide = isIn ? row.metalOut != null || Boolean(row.floorOutEntryId) : row.metalIn != null || Boolean(row.floorInEntryId)
  const hasManualNotes = [row.rating, row.breakdown, row.requests].some((v) => String(v || '').trim())
  if (!hasOtherSide && !hasManualNotes) {
    await row.deleteOne()
    return 'removed'
  }
  await row.save()
  return 'cleared'
}

/**
 * Drop leftover mg_floor Ops rows for AMX batches that already have gold_alloy custody Metal IN
 * (pre-fix double Melting Metal IN). Safe to repeat.
 */
async function removeDuplicateAlloyMgFloorRows() {
  const mgRows = await OperationsProductionEntry.find({
    source: 'mg_floor',
    alloyMixCode: { $regex: /^AMX-/i },
  }).lean()
  let removed = 0
  for (const row of mgRows || []) {
    const code = String(row.alloyMixCode || '').toUpperCase()
    if (!code) continue
    const hasGoldIn = await OperationsProductionEntry.exists({
      source: 'gold_alloy',
      alloyMixCode: code,
      departmentKey: row.departmentKey,
      metalIn: { $ne: null },
      _id: { $ne: row._id },
    })
    if (!hasGoldIn) continue
    await OperationsProductionEntry.deleteOne({ _id: row._id })
    removed += 1
  }
  return removed
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
  const duplicatesRemoved = await removeDuplicateAlloyMgFloorRows()
  return {
    approved: entries.length,
    linked,
    skipped: entries.length - linked,
    skippedDepartments,
    duplicatesRemoved,
  }
}

module.exports = {
  applyApprovedEntryToWorkbook,
  removeEntryFromWorkbook,
  syncApprovedEntriesToWorkbook,
  linkAlloyMixFloorApproval,
  removeDuplicateAlloyMgFloorRows,
  floorBatchKey,
  lineTimestamp,
  summarizeLines,
}
