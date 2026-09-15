const ProductionFloorSession = require('../../models/ProductionFloorSession')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { AUDIT_ACTIONS } = require('./constants')
const { getCurrentShift } = require('./shiftService')
const { ProductionError } = require('./batchService')

function actor(req) {
  return { id: req.user?._id || null, name: req.user?.name || 'system' }
}

async function startSession(req, { employeeId = null } = {}) {
  const a = actor(req)
  if (!a.id) throw new ProductionError('User required for floor session')

  return runInTransaction(async (session) => {
    const existing = await withSession(
      ProductionFloorSession.findOne({ userId: a.id, status: 'OPEN' }),
      session,
    )
    if (existing) {
      existing.lastActivityAt = new Date()
      await existing.save(writeOpts(session))
      return { session: existing, reused: true }
    }

    const shift = await getCurrentShift()
    const [row] = await ProductionFloorSession.create(
      [
        {
          userId: a.id,
          employeeId: employeeId || null,
          name: a.name,
          shiftId: shift._id || null,
          shiftName: shift.name || 'Shift 1',
          loginAt: new Date(),
          lastActivityAt: new Date(),
          status: 'OPEN',
        },
      ],
      writeOpts(session),
    )

    await writeProductionAudit(req, {
      resource: 'ProductionFloorSession',
      resourceId: row._id,
      action: AUDIT_ACTIONS.FLOOR_SESSION_STARTED,
      detail: `Floor manager ${a.name} logged in (${row.shiftName})`,
      changes: { loginAt: row.loginAt, shiftName: row.shiftName },
      session,
    })

    return { session: row, reused: false }
  })
}

async function endSession(req) {
  const a = actor(req)
  return runInTransaction(async (session) => {
    const open = await withSession(
      ProductionFloorSession.findOne({ userId: a.id, status: 'OPEN' }),
      session,
    )
    if (!open) throw new ProductionError('No open floor session', 404)

    const now = new Date()
    open.logoutAt = now
    open.lastActivityAt = now
    open.status = 'CLOSED'
    open.durationMinutes = Math.max(0, Math.round((now - open.loginAt) / 60000))
    await open.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionFloorSession',
      resourceId: open._id,
      action: AUDIT_ACTIONS.FLOOR_SESSION_ENDED,
      detail: `Floor manager ${a.name} logged out (${open.durationMinutes} min)`,
      changes: {
        loginAt: open.loginAt,
        logoutAt: open.logoutAt,
        durationMinutes: open.durationMinutes,
      },
      session,
    })

    return open
  })
}

async function heartbeat(req) {
  const a = actor(req)
  const open = await ProductionFloorSession.findOne({ userId: a.id, status: 'OPEN' })
  if (!open) return null
  open.lastActivityAt = new Date()
  await open.save()
  return open
}

async function listSessions(query = {}) {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
  const skip = Math.max(0, Number(query.skip) || 0)
  const filter = {}
  if (query.status) filter.status = query.status
  if (query.userId) filter.userId = query.userId
  if (query.date) {
    const day = new Date(query.date)
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    filter.loginAt = { $gte: day, $lt: next }
  }
  const [sessions, total] = await Promise.all([
    ProductionFloorSession.find(filter).sort({ loginAt: -1 }).skip(skip).limit(limit).lean(),
    ProductionFloorSession.countDocuments(filter),
  ])
  return { sessions, total, limit, skip }
}

async function getOpenManagers() {
  return ProductionFloorSession.find({ status: 'OPEN' }).sort({ loginAt: 1 }).lean()
}

module.exports = {
  startSession,
  endSession,
  heartbeat,
  listSessions,
  getOpenManagers,
}
