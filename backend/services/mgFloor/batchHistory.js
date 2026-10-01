const FloorBatchEntry = require('../../models/FloorBatchEntry')
const { ProductionError } = require('../productionControl/errors')
const { normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')
const { departmentFilter, sameBatchKey } = require('./batchEntries')
const { summarizeLines } = require('./workbookLink')

const MAX_DAYS = 93
const MAX_ENTRIES = 3000

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const round = (value, places) => {
  const f = 10 ** places
  return Math.round(value * f) / f
}
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
const latest = (...dates) => dates.filter(Boolean).reduce((a, b) => (new Date(b) > new Date(a) ? b : a), null)

/** One entry's events: sent, then approved / rejected / approved-then-undone. */
function entryEvents(e) {
  const base = { direction: e.direction, entryId: e.entryId }
  const totals = summarizeLines(e.lines)
  const events = [{
    ...base,
    type: 'sent',
    at: e.submittedAt,
    by: e.employeeName || '',
    lines: e.lines || [],
    weight: totals.weight,
  }]
  if (e.status === 'APPROVED') events.push({ ...base, type: 'approved', at: e.decidedAt, by: e.decidedByName || '' })
  if (e.status === 'REJECTED' && e.undoneAt) {
    events.push({ ...base, type: 'approved', at: e.approvedAt, by: e.approvedByName || '' })
    events.push({ ...base, type: 'undone', at: e.undoneAt, by: e.decidedByName || '', reason: e.undoReason || '' })
  } else if (e.status === 'REJECTED') {
    events.push({ ...base, type: 'rejected', at: e.decidedAt, by: e.decidedByName || '', reason: e.rejectReason || '' })
  }
  return events
}

/** The newest entry for one side (Metal In or Metal Out) and how many times it was sent. */
function sideSummary(entries) {
  if (!entries.length) return null
  const last = entries.reduce((a, b) => (new Date(b.submittedAt) > new Date(a.submittedAt) ? b : a))
  const totals = summarizeLines(last.lines)
  return {
    status: last.status,
    undone: Boolean(last.undoneAt),
    weight: totals.weight,
    purity: totals.purity,
    fineGold: totals.fineGold,
    times: entries.length,
    by: last.employeeName || '',
  }
}

function batchStatus(metalIn, metalOut) {
  if (metalIn?.status === 'PENDING' || metalOut?.status === 'PENDING') return 'waiting'
  if (metalIn?.status === 'REJECTED' || metalOut?.status === 'REJECTED') return 'sent_back'
  if (metalIn?.status === 'APPROVED' && metalOut?.status === 'APPROVED') return 'finished'
  return 'running'
}

function summarizeBatch(key, entries) {
  const first = entries[0]
  const metalIn = sideSummary(entries.filter((e) => e.direction === 'IN'))
  const metalOut = sideSummary(entries.filter((e) => e.direction === 'OUT'))
  const finished = metalIn?.status === 'APPROVED' && metalOut?.status === 'APPROVED'
  const loss = finished && metalIn.weight > 0 && metalOut.weight != null ? round(metalIn.weight - metalOut.weight, 3) : null
  const events = entries.flatMap(entryEvents).sort((a, b) => new Date(a.at) - new Date(b.at))
  return {
    key,
    entryDate: first.entryDate,
    department: normalizeFloorDepartment(first.department) || first.department,
    batchLabel: first.batchLabel,
    status: batchStatus(metalIn, metalOut),
    metalIn,
    metalOut,
    loss,
    lossPct: loss != null ? round((loss / metalIn.weight) * 100, 2) : null,
    timesSent: entries.length,
    lastActivityAt: latest(...entries.flatMap((e) => [e.submittedAt, e.decidedAt, e.undoneAt])),
    events,
  }
}

/**
 * Every MG Floor batch in a day range with its full story: each Metal In / Out sent from the tablet,
 * approved, rejected or undone — who and when. Filtering by batch or operator keeps the whole batch.
 */
async function getBatchHistory({ from, to, department, batch, operator } = {}) {
  const days = daysBetween(from, to)
  if (!Number.isFinite(days) || days < 0) throw new ProductionError('"From" must be on or before "To"', 400)
  if (days >= MAX_DAYS) throw new ProductionError('Pick at most 3 months', 400)

  const range = { entryDate: { $gte: from, $lte: to } }
  if (department) range.department = departmentFilter(department)
  const match = { ...range }
  if (batch) match.batchLabel = { $regex: `^${escapeRegex(batch.trim())}$`, $options: 'i' }
  if (operator) match.employeeName = { $regex: escapeRegex(operator.trim()), $options: 'i' }

  let entries
  if (batch || operator) {
    const hits = await FloorBatchEntry.find(match).select('entryDate department batchLabel').limit(MAX_ENTRIES).lean()
    const keys = new Set(hits.map(sameBatchKey))
    if (!keys.size) return { from, to, batches: [], truncated: false }
    const pairs = [...new Map(hits.map((h) => [`${h.entryDate}|${h.batchLabel}`, { entryDate: h.entryDate, batchLabel: h.batchLabel }])).values()]
    entries = (await FloorBatchEntry.find({ ...range, $or: pairs }).sort({ submittedAt: 1 }).limit(MAX_ENTRIES + 1).lean())
      .filter((e) => keys.has(sameBatchKey(e)))
  } else {
    entries = await FloorBatchEntry.find(range).sort({ submittedAt: 1 }).limit(MAX_ENTRIES + 1).lean()
  }

  const truncated = entries.length > MAX_ENTRIES
  if (truncated) entries = entries.slice(0, MAX_ENTRIES)
  const groups = new Map()
  for (const e of entries) {
    const key = sameBatchKey(e)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }
  const batches = [...groups.entries()]
    .map(([key, list]) => summarizeBatch(key, list))
    .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
  return { from, to, batches, truncated }
}

module.exports = { getBatchHistory, MAX_DAYS }
