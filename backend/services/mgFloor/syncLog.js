const FloorSyncOperation = require('../../models/FloorSyncOperation')
const FloorBatchEntry = require('../../models/FloorBatchEntry')
const FloorDevice = require('../../models/FloorDevice')
const User = require('../../models/User')
const { ProductionError } = require('../productionControl/errors')
const { normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')
const { summarizeLines } = require('./workbookLink')

const MAX_DAYS = 93
const MAX_ITEMS = 2000
/** Synced more than this long after it was saved on the tablet = late. */
const LATE_MINUTES = 60
/** Asia/Dubai has no daylight saving, so a fixed offset gives its day boundaries. */
const DUBAI_OFFSET = '+04:00'
const PROBLEM_STATUSES = ['FAILED', 'CONFLICT', 'SYNCING', 'PENDING']

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
const dayStart = (day) => new Date(`${day}T00:00:00${DUBAI_OFFSET}`)
function nextDay(day) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const dubaiDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' })
const minutesBetween = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : null)

function toItem(op, { entries, users, devices }) {
  const payload = op.payload || {}
  const entryId = op.result?.entryId || payload.entryId || ''
  const entry = entries.get(entryId)
  const device = devices.get(op.deviceId || payload.deviceId)
  const savedAt = op.clientTimestamp || op.createdAt
  const delayMinutes = op.syncStatus === 'SYNCED' ? minutesBetween(savedAt, op.syncedAt) : null
  const entryDate = entry?.entryDate || payload.entryDate || ''
  return {
    operationId: op.operationId,
    type: op.operationType,
    status: op.syncStatus,
    errorMessage: op.errorMessage || '',
    savedAt,
    firstTriedAt: op.createdAt,
    syncedAt: op.syncedAt || null,
    delayMinutes,
    late: delayMinutes != null && delayMinutes > LATE_MINUTES,
    arrivedLaterDay: Boolean(op.syncedAt && entryDate && dubaiDay.format(new Date(op.syncedAt)) > entryDate),
    operator: entry?.employeeName || users.get(String(op.employeeId)) || '',
    department: normalizeFloorDepartment(entry?.department || payload.department) || '',
    batchLabel: entry?.batchLabel || payload.batchLabel || '',
    direction: entry?.direction || payload.direction || '',
    entryDate,
    weight: summarizeLines(entry?.lines || payload.lines).weight,
    entryId,
    batchStatus: entry?.status || '',
    deviceId: op.deviceId || payload.deviceId || '',
    appVersion: device?.appVersion || '',
  }
}

/**
 * Batches a tablet saved while offline (or when sending failed) and sent later, in a day range of
 * when they were saved on the tablet. Shows how late each one reached the server and which failed.
 */
async function getSyncLog({ from, to, department: rawDepartment, status = 'all' } = {}) {
  const days = daysBetween(from, to)
  if (!Number.isFinite(days) || days < 0) throw new ProductionError('"From" must be on or before "To"', 400)
  if (days >= MAX_DAYS) throw new ProductionError('Pick at most 3 months', 400)
  const department = rawDepartment ? normalizeFloorDepartment(rawDepartment) : ''
  if (rawDepartment && !department) throw new ProductionError('A valid floor department is required', 400)

  const range = { $gte: dayStart(from), $lt: dayStart(nextDay(to)) }
  const filter = { $or: [{ clientTimestamp: range }, { clientTimestamp: null, createdAt: range }] }
  if (status === 'synced') filter.syncStatus = 'SYNCED'
  if (status === 'problem') filter.syncStatus = { $in: PROBLEM_STATUSES }

  let ops = await FloorSyncOperation.find(filter).sort({ clientTimestamp: -1, createdAt: -1 }).limit(MAX_ITEMS + 1).lean()
  const truncated = ops.length > MAX_ITEMS
  if (truncated) ops = ops.slice(0, MAX_ITEMS)

  const entryIds = [...new Set(ops.map((op) => op.result?.entryId || op.payload?.entryId).filter(Boolean))]
  const userIds = [...new Set(ops.map((op) => op.employeeId).filter(Boolean).map(String))]
  const deviceIds = [...new Set(ops.map((op) => op.deviceId || op.payload?.deviceId).filter(Boolean))]
  const [entryDocs, userDocs, deviceDocs] = await Promise.all([
    entryIds.length ? FloorBatchEntry.find({ entryId: { $in: entryIds } }).select('entryId entryDate department batchLabel direction lines status employeeName').lean() : [],
    userIds.length ? User.find({ _id: { $in: userIds } }).select('name').lean() : [],
    deviceIds.length ? FloorDevice.find({ deviceId: { $in: deviceIds } }).select('deviceId appVersion').lean() : [],
  ])
  const lookups = {
    entries: new Map(entryDocs.map((e) => [e.entryId, e])),
    users: new Map(userDocs.map((u) => [String(u._id), u.name || ''])),
    devices: new Map(deviceDocs.map((d) => [d.deviceId, d])),
  }

  const items = ops.map((op) => toItem(op, lookups)).filter((item) => !department || item.department === department)
  const synced = items.filter((i) => i.status === 'SYNCED')
  const delays = synced.map((i) => i.delayMinutes).filter((m) => m != null)
  return {
    from,
    to,
    lateMinutes: LATE_MINUTES,
    summary: {
      total: items.length,
      synced: synced.length,
      problems: items.filter((i) => PROBLEM_STATUSES.includes(i.status)).length,
      late: items.filter((i) => i.late).length,
      arrivedLaterDay: items.filter((i) => i.arrivedLaterDay).length,
      maxDelayMinutes: delays.length ? Math.max(...delays) : null,
      avgDelayMinutes: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
    },
    items,
    truncated,
  }
}

module.exports = { getSyncLog, MAX_DAYS, LATE_MINUTES }
