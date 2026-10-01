const User = require('../../models/User')
const MgFloorSetting = require('../../models/MgFloorSetting')
const { ProductionError } = require('../productionControl/errors')
const { writeProductionAudit } = require('../productionControl/audit')
const { resolveProductionRole } = require('../productionControl/permissions')
const { normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')

const MANAGER_ROLES = ['floor_manager', 'production_manager']

/**
 * Floor staff who can be put in charge of a department: an explicit Floor / Production Manager
 * role, or a production department head. Admins and management accounts approve too, but only
 * appear here once given a production role.
 */
function isFloorManager(user) {
  if (!user || user.isActive === false || user.isDeleted) return false
  if (!user.productionRole && user.role !== 'department_head') return false
  return MANAGER_ROLES.includes(resolveProductionRole(user))
}

const ACTIVE = { isActive: { $ne: false }, isDeleted: { $ne: true } }
const CANDIDATES = { $or: [{ productionRole: { $in: MANAGER_ROLES } }, { productionRole: null, role: 'department_head', department: 'production' }] }
const FIELDS = 'name role department productionRole isActive isDeleted'

async function listFloorManagers() {
  const users = await User.find({ ...ACTIVE, ...CANDIDATES }).select(FIELDS).sort({ name: 1 }).lean()
  return users.filter(isFloorManager).map((u) => ({ id: String(u._id), name: u.name, productionRole: resolveProductionRole(u) }))
}

/**
 * Assigned manager per department, e.g. { melting: { id, name, assignedByName, assignedAt } }.
 * Uses the manager's current name and leaves out anyone no longer a Floor / Production Manager.
 */
async function getDepartmentManagers() {
  const settings = await MgFloorSetting.find({ managerId: { $ne: null } }).lean()
  if (!settings.length) return {}
  const users = await User.find({ _id: { $in: settings.map((s) => s.managerId) } }).select(FIELDS).lean()
  const current = new Map(users.filter(isFloorManager).map((u) => [String(u._id), u]))
  const out = {}
  for (const s of settings) {
    const user = current.get(String(s.managerId))
    if (!user) continue
    out[s.department] = {
      id: String(user._id),
      name: user.name,
      assignedByName: s.managerAssignedByName || '',
      assignedAt: s.managerAssignedAt || null,
    }
  }
  return out
}

/** Floor / Production Managers put someone in charge of a department, or clear it with null. */
async function setDepartmentManager(req, { department: rawDepartment, managerId }) {
  const department = normalizeFloorDepartment(rawDepartment)
  if (!department) {
    const err = new ProductionError('A valid floor department is required', 400)
    err.code = 'INVALID_DEPARTMENT'
    throw err
  }
  let manager = null
  if (managerId) {
    const user = await User.findById(managerId).select(FIELDS).lean()
    if (!isFloorManager(user)) throw new ProductionError('Pick an active Floor or Production Manager', 400)
    manager = user
  }

  const before = await MgFloorSetting.findOne({ department }).lean()
  // timestamps off: the record's updatedAt is when the loss limit last changed.
  const setting = await MgFloorSetting.findOneAndUpdate(
    { department },
    {
      $set: {
        managerId: manager?._id || null,
        managerName: manager?.name || '',
        managerAssignedByName: req.user?.name || '',
        managerAssignedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true, timestamps: false },
  ).lean()
  await writeProductionAudit(req, {
    resource: 'MgFloorSetting',
    resourceId: setting._id,
    action: 'mg_floor_manager_assigned',
    detail: manager ? `${manager.name} assigned as manager for ${department}` : `Manager removed for ${department}`,
    changes: { department, from: before?.managerName || null, to: manager?.name || null },
  }).catch((err) => console.warn('[mg-floor] manager audit failed', err?.message || err))

  return { department, manager: (await getDepartmentManagers())[department] || null }
}

module.exports = { getDepartmentManagers, isFloorManager, listFloorManagers, setDepartmentManager }
