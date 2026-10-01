const ProductionAlert = require('../../models/ProductionAlert')
const { ProductionError } = require('../productionControl/errors')
const { writeProductionAudit } = require('../productionControl/audit')
const { normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')

const BREAKDOWN_CODE = 'MACHINE_BREAKDOWN'
/** Older unfixed breakdowns are treated as forgotten, not as a machine still down. */
const UNFIXED_WINDOW_DAYS = 14
const MAX_NOTE = 300

/**
 * Breakdowns reported since "Fixed" exists (metadata.trackFix) that nobody has marked fixed yet.
 * Older breakdowns were only ever acknowledged, so they are left out.
 */
const unfixedFilter = (extra = {}) => ({
  code: BREAKDOWN_CODE,
  'metadata.trackFix': true,
  status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
  createdAt: { $gte: new Date(Date.now() - UNFIXED_WINDOW_DAYS * 86400000) },
  ...extra,
})

const downtimeMinutes = (alert) => (alert?.resolvedAt && alert?.createdAt
  ? Math.max(0, Math.round((new Date(alert.resolvedAt) - new Date(alert.createdAt)) / 60000))
  : null)

/** The newest unfixed breakdown of a department, or null. */
async function currentBreakdown(department) {
  const key = normalizeFloorDepartment(department)
  if (!key) return null
  return ProductionAlert.findOne(unfixedFilter({ 'metadata.department': key })).sort({ createdAt: -1 }).lean()
}

/** Every unfixed breakdown, newest first, for the Production Dashboard. */
function listUnfixedBreakdowns() {
  return ProductionAlert.find(unfixedFilter())
    .select('status metadata raisedByName acknowledgedByName acknowledgedAt createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
}

/**
 * Marks a breakdown fixed (from the tablet or the web). Downtime = reported → fixed. Pressing it
 * again after someone else already fixed it returns the fixed breakdown instead of an error.
 */
async function markBreakdownFixed(req, id, note = '') {
  const fixNote = String(note || '').trim().slice(0, MAX_NOTE)
  const alert = await ProductionAlert.findOneAndUpdate(
    { _id: id, code: BREAKDOWN_CODE, status: { $in: ['OPEN', 'ACKNOWLEDGED'] } },
    {
      $set: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: req.user?._id || null,
        resolvedByName: req.user?.name || '',
        'metadata.fixNote': fixNote,
      },
    },
    { returnDocument: 'after' },
  ).lean()

  if (!alert) {
    const existing = await ProductionAlert.findById(id).lean()
    if (!existing || existing.code !== BREAKDOWN_CODE) throw new ProductionError('Breakdown not found', 404)
    return { alert: existing, alreadyFixed: true }
  }

  const minutes = downtimeMinutes(alert)
  const department = alert.metadata?.department || ''
  await writeProductionAudit(req, {
    resource: 'ProductionAlert',
    resourceId: alert._id,
    action: 'mg_floor_breakdown_fixed',
    detail: `Breakdown ${department || 'floor'} fixed after ${minutes} min`,
    changes: { department, downtimeMinutes: minutes, note: fixNote, fixedByName: alert.resolvedByName },
  }).catch((err) => console.warn('[mg-floor] breakdown fixed audit failed', err?.message || err))
  return { alert, alreadyFixed: false }
}

module.exports = {
  UNFIXED_WINDOW_DAYS,
  unfixedFilter,
  downtimeMinutes,
  currentBreakdown,
  listUnfixedBreakdowns,
  markBreakdownFixed,
}
