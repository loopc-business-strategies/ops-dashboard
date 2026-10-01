const mongoose = require('mongoose')
const FloorBatchEntry = require('../../models/FloorBatchEntry')
const { ProductionError } = require('../productionControl/errors')
const { hasProductionPermission } = require('../productionControl/permissions')
const { writeProductionAudit } = require('../productionControl/audit')
const { applyApprovedEntryToWorkbook, removeEntryFromWorkbook, summarizeLines } = require('./workbookLink')
const {
  BATCH_ENTRY_DIRECTIONS,
  BATCH_ENTRY_STATUSES,
  BATCH_ENTRY_MAX_LINES,
  FLOOR_DEPARTMENTS,
  LEGACY_FLOOR_DEPARTMENT_ALIASES,
  aliasFloorDepartment,
  normalizeFloorDepartment,
} = require('../../constants/mgFloorBatchEntry')

const ENTRY_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/
const ENTRY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const UNDO_WINDOW_HOURS = 24

function activeKeyFor({ entryDate, department, direction, batchLabel }) {
  return [entryDate, String(department || '').trim().toLowerCase(), direction, batchLabel].join('|')
}

function cleanNumber(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function validTzOffset(value) {
  const n = Number(value)
  return value != null && value !== '' && Number.isInteger(n) && Math.abs(n) <= 840 ? n : null
}

function sanitizeLines(lines) {
  return (Array.isArray(lines) ? lines : []).slice(0, BATCH_ENTRY_MAX_LINES).map((line) => ({
    metal: String(line?.metal || '').trim().slice(0, 40),
    qty: cleanNumber(line?.qty),
    purity: cleanNumber(line?.purity),
    time: String(line?.time || '').trim().slice(0, 16),
  }))
}

function canDecide(user) {
  return hasProductionPermission(user, 'approvePass')
}

function isSameUser(a, b) {
  return a != null && b != null && String(a) === String(b)
}

function batchExistsError({ batchLabel, direction, entryDate }) {
  const err = new ProductionError(
    `Batch ${batchLabel} Metal ${direction === 'IN' ? 'In' : 'Out'} for ${entryDate} is already waiting for or has Floor Manager approval`,
    409,
  )
  err.code = 'BATCH_ENTRY_EXISTS'
  return err
}

function departmentError(message, status, code) {
  const err = new ProductionError(message, status)
  err.code = code
  return err
}

/**
 * Operators always submit under their admin-assigned floorDepartment; only Floor / Production
 * Managers may submit for another stage.
 */
function resolveEntryDepartment(user, requested) {
  const assigned = normalizeFloorDepartment(user?.floorDepartment)
  const asked = aliasFloorDepartment(requested)

  if (canDecide(user)) {
    const department = asked || assigned
    if (!department) throw departmentError('department is required', 400, 'DEPARTMENT_REQUIRED')
    if (!FLOOR_DEPARTMENTS.includes(department)) {
      throw departmentError(`Unknown floor department: ${department}`, 400, 'INVALID_DEPARTMENT')
    }
    return department
  }

  if (!assigned) {
    throw departmentError(
      'No floor department is assigned to your account. Ask an admin to set it.',
      403,
      'FLOOR_DEPARTMENT_REQUIRED',
    )
  }
  if (asked && asked !== assigned) {
    throw departmentError(
      `You can only send batches for your assigned department (${assigned}).`,
      403,
      'DEPARTMENT_MISMATCH',
    )
  }
  return assigned
}

/**
 * Operator sends one typed Metal In / Metal Out batch for Floor Manager approval.
 * Replaying the same entryId returns the stored entry (offline outbox retries).
 */
async function submitBatchEntry(req, body = {}) {
  const user = req.user
  const direction = String(body.direction || '').trim().toUpperCase()
  if (!BATCH_ENTRY_DIRECTIONS.includes(direction)) {
    throw new ProductionError('direction must be IN or OUT', 400)
  }
  if (!String(body.batchLabel || '').trim()) {
    throw new ProductionError('batchLabel is required', 400)
  }
  const needed = direction === 'IN' ? 'receivePass' : 'createPass'
  if (!hasProductionPermission(user, needed)) {
    throw new ProductionError(`Insufficient production permission to send Metal ${direction === 'IN' ? 'In' : 'Out'}`, 403)
  }
  const department = resolveEntryDepartment(user, body.department)

  const entryId = String(body.entryId || '').trim()
  if (!ENTRY_ID_PATTERN.test(entryId)) {
    throw new ProductionError('entryId must be 8-120 characters (letters, digits, - or _)', 400)
  }
  const entryDate = String(body.entryDate || '').trim()
  if (!ENTRY_DATE_PATTERN.test(entryDate)) {
    throw new ProductionError('entryDate must be YYYY-MM-DD', 400)
  }

  const lines = sanitizeLines(body.lines)
  if (!lines.some((l) => l.qty != null && l.qty > 0)) {
    throw new ProductionError('Enter a quantity for at least one metal', 400)
  }
  if (lines.some((l) => l.qty != null && l.qty <= 0)) {
    throw new ProductionError('Quantity must be greater than 0', 400)
  }
  if (direction === 'OUT' && lines.some((l) => l.qty != null && l.metal.toLowerCase() === 'alloy')) {
    throw new ProductionError('Alloy is entered on Metal In only', 400)
  }
  if (lines.some((l) => l.purity != null && (l.purity <= 0 || l.purity > 1000))) {
    throw new ProductionError('Purity must be between 0 and 1000', 400)
  }

  const existing = await FloorBatchEntry.findOne({ entryId }).lean()
  if (existing) return { entry: existing, reused: true }

  const doc = {
    entryId,
    direction,
    department,
    batchLabel: String(body.batchLabel || '').trim().slice(0, 20),
    entryDate,
    lines,
    employeeId: user?._id || null,
    employeeName: user?.name || '',
    deviceId: String(body.deviceId || '').trim().slice(0, 120),
    tzOffsetMinutes: validTzOffset(body.tzOffsetMinutes),
    status: 'PENDING',
    submittedAt: new Date(),
  }
  doc.activeKey = activeKeyFor(doc)

  // Hardened deploys run without autoIndex, so the unique activeKey index may be missing.
  if (await FloorBatchEntry.exists({ activeKey: doc.activeKey })) throw batchExistsError(doc)

  let created
  try {
    created = await FloorBatchEntry.create(doc)
  } catch (err) {
    if (err?.code === 11000) {
      const again = await FloorBatchEntry.findOne({ entryId }).lean()
      if (again) return { entry: again, reused: true }
      throw batchExistsError(doc)
    }
    throw err
  }

  await writeProductionAudit(req, {
    resource: 'FloorBatchEntry',
    resourceId: created._id,
    action: 'mg_floor_batch_entry_submitted',
    detail: `Batch ${doc.batchLabel} Metal ${direction} ${doc.department} sent for approval`,
    changes: {
      entryId,
      batchLabel: doc.batchLabel,
      direction,
      department: doc.department,
      entryDate,
      lines,
      employeeId: doc.employeeId,
      employeeName: doc.employeeName,
      status: 'PENDING',
    },
  }).catch((err) => console.warn('[mg-floor] batch entry audit failed', err?.message || err))

  return { entry: created.toObject(), reused: false }
}

const sameBatchKey = (e) => [e.entryDate, normalizeFloorDepartment(e.department), String(e.batchLabel || '').trim()].join('|')

/**
 * Each Metal Out gets the Metal In of the same day, department and batch (the approved one, else the
 * newest pending one) so the Floor Manager sees In vs Out and the loss before approving.
 */
async function attachMetalIn(entries) {
  const outs = entries.filter((e) => e.direction === 'OUT')
  if (!outs.length) return
  const ins = await FloorBatchEntry.find({
    direction: 'IN',
    status: { $in: ['PENDING', 'APPROVED'] },
    $or: outs.map((o) => ({ entryDate: o.entryDate, batchLabel: o.batchLabel })),
  }).sort({ submittedAt: -1 }).lean()
  const byKey = new Map()
  for (const entry of ins) {
    const key = sameBatchKey(entry)
    const current = byKey.get(key)
    if (!current || (current.status !== 'APPROVED' && entry.status === 'APPROVED')) byKey.set(key, entry)
  }
  for (const out of outs) {
    const match = byKey.get(sameBatchKey(out))
    out.metalIn = match ? { status: match.status, ...summarizeLines(match.lines) } : null
  }
}

async function listBatchEntries(query = {}) {
  const filter = {}
  if (query.status && BATCH_ENTRY_STATUSES.includes(String(query.status).toUpperCase())) {
    filter.status = String(query.status).toUpperCase()
  }
  if (query.direction) filter.direction = String(query.direction).toUpperCase()
  if (query.department) {
    const key = aliasFloorDepartment(query.department)
    const legacy = Object.keys(LEGACY_FLOOR_DEPARTMENT_ALIASES).filter((k) => LEGACY_FLOOR_DEPARTMENT_ALIASES[k] === key)
    filter.department = legacy.length ? { $in: [key, ...legacy] } : key
  }
  if (query.entryDate) filter.entryDate = String(query.entryDate).trim()
  if (query.from || query.to) {
    filter.submittedAt = {}
    if (query.from) filter.submittedAt.$gte = new Date(query.from)
    if (query.to) filter.submittedAt.$lte = new Date(query.to)
  }
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  const skip = Math.max(Number(query.skip) || 0, 0)

  const countFilter = { ...filter }
  delete countFilter.status
  const [entries, total, grouped, oldestPending] = await Promise.all([
    FloorBatchEntry.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
    FloorBatchEntry.countDocuments(filter),
    FloorBatchEntry.aggregate([{ $match: countFilter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    FloorBatchEntry.findOne({ ...countFilter, status: 'PENDING' }).sort({ submittedAt: 1 }).select('submittedAt').lean(),
  ])
  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 }
  for (const g of grouped) if (g._id in counts) counts[g._id] = g.n
  for (const entry of entries) entry.totals = summarizeLines(entry.lines)
  await attachMetalIn(entries)
  return { entries, total, counts, limit, skip, oldestPendingAt: oldestPending?.submittedAt || null }
}

async function decideBatchEntry(req, id, decision, reason = '') {
  const user = req.user
  if (!canDecide(user)) {
    throw new ProductionError('Only a Floor Manager or Production Manager can approve or reject', 403)
  }
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ProductionError('Entry not found', 404)
  }
  const current = await FloorBatchEntry.findById(id).lean()
  if (!current) throw new ProductionError('Entry not found', 404)
  if (isSameUser(current.employeeId, user?._id)) {
    throw new ProductionError('You cannot approve or reject a batch you sent yourself', 403)
  }
  if (current.status !== 'PENDING') {
    const err = new ProductionError(`This batch is already ${current.status.toLowerCase()}`, 409)
    err.code = 'BATCH_ENTRY_DECIDED'
    throw err
  }

  const approve = decision === 'APPROVED'
  if (approve && current.activeKey) {
    const alreadyApproved = await FloorBatchEntry.exists({
      activeKey: current.activeKey,
      status: 'APPROVED',
      _id: { $ne: current._id },
    })
    if (alreadyApproved) throw batchExistsError(current)
  }
  const rejectReason = String(reason || '').trim().slice(0, 500)
  if (!approve && rejectReason.length < 3) {
    throw new ProductionError('A reason is required to reject', 400)
  }

  const update = {
    $set: {
      status: decision,
      decidedAt: new Date(),
      decidedById: user?._id || null,
      decidedByName: user?.name || '',
      rejectReason: approve ? '' : rejectReason,
    },
  }
  if (!approve) update.$unset = { activeKey: 1 }

  const updated = await FloorBatchEntry.findOneAndUpdate({ _id: id, status: 'PENDING' }, update, {
    returnDocument: 'after',
  }).lean()
  if (!updated) {
    const err = new ProductionError('This batch was already decided by someone else', 409)
    err.code = 'BATCH_ENTRY_DECIDED'
    throw err
  }

  await writeProductionAudit(req, {
    resource: 'FloorBatchEntry',
    resourceId: updated._id,
    action: approve ? 'mg_floor_batch_entry_approved' : 'mg_floor_batch_entry_rejected',
    detail: `Batch ${updated.batchLabel} Metal ${updated.direction} ${approve ? 'approved' : 'rejected'}`,
    changes: {
      entryId: updated.entryId,
      batchLabel: updated.batchLabel,
      direction: updated.direction,
      department: updated.department,
      entryDate: updated.entryDate,
      employeeId: updated.employeeId,
      employeeName: updated.employeeName,
      decidedById: updated.decidedById,
      decidedByName: updated.decidedByName,
      decidedAt: updated.decidedAt,
      status: decision,
      rejectReason: approve ? undefined : rejectReason,
    },
  }).catch((err) => console.warn('[mg-floor] batch entry audit failed', err?.message || err))

  let workbookEntryId = null
  if (approve) {
    try {
      const row = await applyApprovedEntryToWorkbook(updated)
      workbookEntryId = row?._id || null
    } catch (err) {
      console.warn('[mg-floor] workbook update failed (use "Sync MG Floor batches" to retry)', err?.message || err)
    }
  }

  return { entry: updated, workbookEntryId }
}

/**
 * A manager takes back a wrong approval within UNDO_WINDOW_HOURS: the batch returns to the
 * operator as REJECTED (with the reason) to fix and resend, and leaves the workbook. A Metal In
 * whose Metal Out is approved must wait until that Metal Out is undone.
 */
async function undoApproval(req, id, reason = '') {
  const user = req.user
  if (!canDecide(user)) {
    throw new ProductionError('Only a Floor Manager or Production Manager can undo an approval', 403)
  }
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ProductionError('Entry not found', 404)
  }
  const current = await FloorBatchEntry.findById(id).lean()
  if (!current) throw new ProductionError('Entry not found', 404)
  if (isSameUser(current.employeeId, user?._id)) {
    throw new ProductionError('You cannot undo a batch you sent yourself', 403)
  }
  if (current.status !== 'APPROVED') {
    const err = new ProductionError('Only an approved batch can be undone', 409)
    err.code = 'BATCH_ENTRY_NOT_APPROVED'
    throw err
  }
  const approvedAt = current.decidedAt ? new Date(current.decidedAt) : null
  if (!approvedAt || Date.now() - approvedAt.getTime() > UNDO_WINDOW_HOURS * 3600000) {
    const err = new ProductionError(`An approval can only be undone within ${UNDO_WINDOW_HOURS} hours`, 409)
    err.code = 'UNDO_WINDOW_PASSED'
    throw err
  }
  if (current.direction === 'IN') {
    const outApproved = await FloorBatchEntry.exists({
      activeKey: activeKeyFor({ ...current, direction: 'OUT' }),
      status: 'APPROVED',
    })
    if (outApproved) {
      const err = new ProductionError(`Undo the Metal Out for batch ${current.batchLabel} first`, 409)
      err.code = 'UNDO_METAL_OUT_FIRST'
      throw err
    }
  }
  const undoReason = String(reason || '').trim().slice(0, 450)
  if (undoReason.length < 3) {
    throw new ProductionError('A reason is required to undo an approval', 400)
  }

  const now = new Date()
  const updated = await FloorBatchEntry.findOneAndUpdate(
    { _id: id, status: 'APPROVED', decidedAt: current.decidedAt },
    {
      $set: {
        status: 'REJECTED',
        rejectReason: `Approval undone: ${undoReason}`,
        undoReason,
        undoneAt: now,
        approvedByName: current.decidedByName || '',
        approvedAt: current.decidedAt,
        decidedAt: now,
        decidedById: user?._id || null,
        decidedByName: user?.name || '',
      },
      $unset: { activeKey: 1 },
    },
    { returnDocument: 'after' },
  ).lean()
  if (!updated) {
    const err = new ProductionError('This batch was changed by someone else — refresh and try again', 409)
    err.code = 'BATCH_ENTRY_DECIDED'
    throw err
  }

  let workbook = null
  try {
    workbook = await removeEntryFromWorkbook(updated)
  } catch (err) {
    console.warn('[mg-floor] workbook clear after undo failed', err?.message || err)
  }

  await writeProductionAudit(req, {
    resource: 'FloorBatchEntry',
    resourceId: updated._id,
    action: 'mg_floor_batch_entry_approval_undone',
    detail: `Batch ${updated.batchLabel} Metal ${updated.direction} approval undone`,
    changes: {
      entryId: updated.entryId,
      batchLabel: updated.batchLabel,
      direction: updated.direction,
      department: updated.department,
      entryDate: updated.entryDate,
      employeeName: updated.employeeName,
      approvedByName: updated.approvedByName,
      approvedAt: updated.approvedAt,
      undoneByName: updated.decidedByName,
      reason: undoReason,
      workbook,
    },
  }).catch((err) => console.warn('[mg-floor] undo audit failed', err?.message || err))

  return { entry: updated, workbook }
}

module.exports = {
  submitBatchEntry,
  listBatchEntries,
  decideBatchEntry,
  undoApproval,
  UNDO_WINDOW_HOURS,
  activeKeyFor,
  resolveEntryDepartment,
}
