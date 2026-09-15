const ProductionShiftConfig = require('../../models/ProductionShiftConfig')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { AUDIT_ACTIONS } = require('./constants')
const { ProductionError } = require('./batchService')

const DEFAULT_SHIFT = {
  name: 'Shift 1',
  startTime: '09:00',
  endTime: '21:00',
  breakMinutes: 0,
  isActive: true,
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  sortOrder: 0,
}

function parseHm(hm) {
  const [h, m] = String(hm || '00:00').split(':').map((n) => parseInt(n, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function dayKey(date = new Date()) {
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return map[date.getDay()]
}

async function ensureDefaultShift(session = null) {
  const existing = await withSession(
    ProductionShiftConfig.findOne({ name: DEFAULT_SHIFT.name }),
    session,
  )
  if (existing) {
    return withSession(ProductionShiftConfig.find({ isActive: true }).sort({ sortOrder: 1 }), session)
  }

  try {
    await ProductionShiftConfig.create([DEFAULT_SHIFT], writeOpts(session))
  } catch (err) {
    // Concurrent seed race — unique name index; treat as already created
    if (err?.code !== 11000) throw err
  }

  return withSession(ProductionShiftConfig.find({ isActive: true }).sort({ sortOrder: 1 }), session)
}

async function listShifts() {
  await ensureDefaultShift()
  return ProductionShiftConfig.find({}).sort({ sortOrder: 1, name: 1 }).lean()
}

async function getCurrentShift(now = new Date()) {
  await ensureDefaultShift()
  const shifts = await ProductionShiftConfig.find({ isActive: true }).sort({ sortOrder: 1 }).lean()
  const mins = now.getHours() * 60 + now.getMinutes()
  const today = dayKey(now)

  for (const shift of shifts) {
    const days = shift.workingDays || []
    if (days.length && !days.includes(today)) continue
    const start = parseHm(shift.startTime)
    const end = parseHm(shift.endTime)
    const inWindow = end > start
      ? mins >= start && mins < end
      : mins >= start || mins < end // overnight
    if (inWindow) {
      return enrichShift(shift, now)
    }
  }

  // Fallback: first active shift (display even if outside window)
  if (shifts[0]) return enrichShift(shifts[0], now, false)
  return enrichShift(DEFAULT_SHIFT, now, false)
}

function enrichShift(shift, now = new Date(), isCurrent = true) {
  const start = parseHm(shift.startTime)
  const end = parseHm(shift.endTime)
  const mins = now.getHours() * 60 + now.getMinutes()
  let elapsed = 0
  let remaining = 0
  if (end > start) {
    elapsed = Math.max(0, Math.min(mins, end) - start)
    remaining = Math.max(0, end - Math.max(mins, start))
  } else {
    // overnight
    if (mins >= start) {
      elapsed = mins - start
      remaining = (24 * 60 - mins) + end
    } else {
      elapsed = (24 * 60 - start) + mins
      remaining = Math.max(0, end - mins)
    }
  }
  const total = end > start ? end - start : (24 * 60 - start) + end
  return {
    ...shift,
    isCurrent,
    shiftStarted: true,
    timeElapsedMinutes: elapsed,
    timeRemainingMinutes: remaining,
    durationMinutes: total,
    startLabel: formatLabel(shift.startTime),
    endLabel: formatLabel(shift.endTime),
  }
}

function formatLabel(hm) {
  const [hStr, mStr] = String(hm || '00:00').split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10) || 0
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

async function upsertShift(req, input = {}) {
  const {
    id = null,
    name,
    startTime = '09:00',
    endTime = '21:00',
    breakMinutes = 0,
    isActive = true,
    workingDays,
    sortOrder = 0,
  } = input

  if (!name || !String(name).trim()) throw new ProductionError('Shift name is required')

  return runInTransaction(async (session) => {
    let shift
    if (id) {
      shift = await withSession(ProductionShiftConfig.findById(id), session)
      if (!shift) throw new ProductionError('Shift not found', 404)
      shift.name = String(name).trim()
      shift.startTime = startTime
      shift.endTime = endTime
      shift.breakMinutes = Number(breakMinutes) || 0
      shift.isActive = Boolean(isActive)
      if (Array.isArray(workingDays)) shift.workingDays = workingDays
      shift.sortOrder = Number(sortOrder) || 0
      await shift.save(writeOpts(session))
    } else {
      const [created] = await ProductionShiftConfig.create(
        [
          {
            name: String(name).trim(),
            startTime,
            endTime,
            breakMinutes: Number(breakMinutes) || 0,
            isActive: Boolean(isActive),
            workingDays: Array.isArray(workingDays) ? workingDays : DEFAULT_SHIFT.workingDays,
            sortOrder: Number(sortOrder) || 0,
          },
        ],
        writeOpts(session),
      )
      shift = created
    }

    await writeProductionAudit(req, {
      resource: 'ProductionShiftConfig',
      resourceId: shift._id,
      action: AUDIT_ACTIONS.SHIFT_UPDATED,
      detail: `Shift ${shift.name} ${id ? 'updated' : 'created'} (${shift.startTime}–${shift.endTime})`,
      changes: {
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        isActive: shift.isActive,
      },
      session,
    })

    return shift
  })
}

module.exports = {
  listShifts,
  getCurrentShift,
  upsertShift,
  ensureDefaultShift,
  enrichShift,
  DEFAULT_SHIFT,
}
