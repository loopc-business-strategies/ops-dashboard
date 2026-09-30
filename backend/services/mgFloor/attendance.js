const MgFloorAttendance = require('../../models/MgFloorAttendance')
const { resolveProductionRole } = require('../productionControl/permissions')
const { normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')

/** A tablet login left open longer than this is treated as forgotten and closed at its last activity. */
const STALE_OPEN_MS = 16 * 60 * 60 * 1000

function closeRow(row, at, closedBy) {
  row.logoutAt = at
  row.lastActivityAt = at
  row.status = 'CLOSED'
  row.closedBy = closedBy
  row.durationMinutes = Math.max(0, Math.round((at - row.loginAt) / 60000))
}

async function recordLogin(user, { loginMethod = '', deviceLabel = '' } = {}, now = new Date()) {
  const open = await MgFloorAttendance.findOne({ userId: user._id, status: 'OPEN' }).sort({ loginAt: -1 })
  if (open) {
    if (now - open.loginAt < STALE_OPEN_MS) {
      open.lastActivityAt = now
      await open.save()
      return { attendance: open, reused: true }
    }
    closeRow(open, open.lastActivityAt || open.loginAt, 'auto')
    await open.save()
  }

  const row = await MgFloorAttendance.create({
    userId: user._id,
    name: user.name,
    employeeCode: user.employeeCode || '',
    productionRole: resolveProductionRole(user) || '',
    floorDepartment: normalizeFloorDepartment(user.floorDepartment) || '',
    loginMethod,
    deviceLabel,
    loginAt: now,
    lastActivityAt: now,
  })
  return { attendance: row, reused: false }
}

async function recordLogout(user, now = new Date()) {
  const open = await MgFloorAttendance.find({ userId: user._id, status: 'OPEN' })
  for (const row of open) {
    closeRow(row, now, 'user')
    await row.save()
  }
  return { closed: open.length, attendance: open[0] || null }
}

async function listAttendance({ date, status, limit } = {}) {
  const filter = {}
  if (status) filter.status = status
  if (date) {
    const day = new Date(`${date}T00:00:00`)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    filter.loginAt = { $gte: day, $lt: next }
  }
  const max = Math.min(500, Math.max(1, Number(limit) || 200))
  return MgFloorAttendance.find(filter).sort({ loginAt: -1 }).limit(max).lean()
}

module.exports = {
  STALE_OPEN_MS,
  recordLogin,
  recordLogout,
  listAttendance,
}
