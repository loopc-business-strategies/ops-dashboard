/**
 * Unified backend permission service for all modules.
 * ERP accounting rules remain in erpAccounting/accessPolicy.js and are re-exported here.
 */

const erpAccessPolicy = require('../erpAccounting/accessPolicy')

const normalize = (value = '') => String(value).trim().toLowerCase()
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function isSuperAdmin(user) {
  return user?.role === 'super_admin'
}

function isManagement(user) {
  return user?.role === 'management'
}

function isDepartmentHead(user) {
  return user?.role === 'department_head'
}

function userDept(user) {
  return normalize(user?.department)
}

function hasExplicitModulePermission(user, moduleKey) {
  return Object.prototype.hasOwnProperty.call(user?.modulePermissions || {}, moduleKey)
}

function resolveModuleAccess(user, moduleKey, legacyFn) {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (hasExplicitModulePermission(user, moduleKey)) {
    return user.modulePermissions[moduleKey]?.on === true
  }
  return legacyFn(user)
}

function resolveModuleWrite(user, moduleKey, legacyFn) {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const perm = user?.modulePermissions?.[moduleKey]
  if (perm !== undefined) {
    if (perm.on !== true) return false
    if (perm.edit === false) return false
    return true
  }
  return legacyFn(user)
}

// ─── HR / employees ───────────────────────────────────────────────────────────

function canManageEmployees(user) {
  return resolveModuleWrite(user, 'hr', (subject) => (
    isSuperAdmin(subject)
    || (isDepartmentHead(subject) && userDept(subject) === 'hr')
  ))
}

function buildEmployeeReadFilter(user) {
  if (!user) return null
  if (isSuperAdmin(user) || isManagement(user)) return {}
  if (!resolveModuleAccess(user, 'hr', () => Boolean(userDept(user)))) return null
  const dept = userDept(user)
  if (!dept) return null
  return { department: new RegExp(`^${escapeRegex(dept)}$`, 'i') }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

const isReadOnlyRole = (role) => role === 'management' || role === 'external'

function canCreateTask(user) {
  return user && !isReadOnlyRole(user.role)
}

function isTaskCreator(user, task) {
  if (!user || !task) return false
  const byId = task.createdById && task.createdById.toString() === user._id.toString()
  const byName = normalize(task.createdBy) === normalize(user.name)
  return Boolean(byId || byName)
}

function isUserInTaskAssigneeIds(user, task) {
  if (!user?._id || !task) return false
  const uid = user._id.toString()
  if (Array.isArray(task.assignedToIds) && task.assignedToIds.length) {
    return task.assignedToIds.some((id) => id && id.toString() === uid)
  }
  return false
}

function canMutateTask(user, task) {
  if (!user || !task) return false
  if (isSuperAdmin(user)) return true
  if (isReadOnlyRole(user.role)) return false
  if (user.role === 'department_head') return userDept(user) === normalize(task.department)
  if (user.role === 'department_user') {
    const mineByCoAssignee = isUserInTaskAssigneeIds(user, task)
    const mineById = task.assignedToId && task.assignedToId.toString() === user._id.toString()
    const mineByName = normalize(task.assignedTo) === normalize(user.name)
    return Boolean(mineByCoAssignee || mineById || mineByName || isTaskCreator(user, task))
  }
  return false
}

function canDeleteTask(user, task) {
  if (!user || !task) return false
  if (isSuperAdmin(user)) return true
  if (user.role === 'department_head') return userDept(user) === normalize(task.department)
  if (user.role === 'department_user') return isTaskCreator(user, task)
  return false
}

function canViewTask(user, task) {
  if (!user || !task) return false
  if (isSuperAdmin(user) || isManagement(user)) return true

  const taskDepartment = normalize(task.department)
  if (user.role === 'external') {
    const allowed = (user.allowedModules || []).map(normalize)
    return taskDepartment && allowed.includes(taskDepartment)
  }

  if (user.role === 'department_head') {
    return userDept(user) === taskDepartment
  }

  if (user.role === 'department_user') {
    const mineByCoAssignee = isUserInTaskAssigneeIds(user, task)
    const mineById = task.assignedToId && task.assignedToId.toString() === user._id.toString()
    const mineByName = normalize(task.assignedTo) === normalize(user.name)
    const mineByDepartment = userDept(user) && userDept(user) === taskDepartment
    return Boolean(mineByCoAssignee || mineById || mineByName || mineByDepartment)
  }

  return false
}

function buildTaskReadFilter(user) {
  if (!user) return null
  if (isSuperAdmin(user) || isManagement(user)) return {}

  if (user.role === 'external') {
    const allowed = (user.allowedModules || []).map(normalize).filter(Boolean)
    if (!allowed.length) return { _id: null }
    return { department: { $in: allowed.map((module) => new RegExp(`^${escapeRegex(module)}$`, 'i')) } }
  }

  if (user.role === 'department_head') {
    const dept = userDept(user)
    if (!dept) return { _id: null }
    return { department: new RegExp(`^${escapeRegex(dept)}$`, 'i') }
  }

  if (user.role === 'department_user') {
    const dept = userDept(user)
    const or = []
    if (dept) or.push({ department: new RegExp(`^${escapeRegex(dept)}$`, 'i') })
    or.push({ assignedToId: user._id })
    or.push({ assignedToIds: user._id })
    or.push({ assignedTo: new RegExp(`^${escapeRegex(normalize(user.name))}$`, 'i') })
    return { $or: or }
  }

  return null
}

// ─── Legacy ERP (/api/erp) ────────────────────────────────────────────────────

function isDeptHead(user, dept) {
  return isDepartmentHead(user) && userDept(user) === normalize(dept)
}

function isFinanceRole(user) {
  return userDept(user) === 'finance' && (user?.role === 'department_head' || user?.role === 'department_user')
}

function canEditInventory(user) {
  return resolveModuleWrite(user, 'production', (subject) => (
    isSuperAdmin(subject) || isDeptHead(subject, 'production')
  ))
}

function canViewInventoryCosts(user) {
  return isSuperAdmin(user) || isDeptHead(user, 'production') || isFinanceRole(user)
}

function canManageSuppliers(user) {
  return resolveModuleWrite(user, 'operations', (subject) => (
    isSuperAdmin(subject) || isDeptHead(subject, 'operations')
  ))
}

function canCreatePO(user) {
  return resolveModuleWrite(user, 'operations', (subject) => (
    isSuperAdmin(subject) || isDeptHead(subject, 'operations')
  ))
}

function canApprovePOBudget(user) {
  return isSuperAdmin(user) || isFinanceRole(user)
}

function canManageProduction(user) {
  return resolveModuleWrite(user, 'production', (subject) => (
    isSuperAdmin(subject) || isDeptHead(subject, 'production')
  ))
}

function canManageLegacyErpFinance(user) {
  return resolveModuleWrite(user, 'finance', (subject) => (
    isSuperAdmin(subject) || isDeptHead(subject, 'finance')
  ))
}

function canUploadProcDocs(user) {
  return isSuperAdmin(user) || isDeptHead(user, 'operations') || isFinanceRole(user)
}

function legacyCanViewOperationsModule(user) {
  if (!user) return false
  if (isSuperAdmin(user) || isManagement(user)) return true
  if (user.role === 'department_head' || user.role === 'department_user') {
    return userDept(user) === 'operations'
  }
  return false
}

function canViewOperationsModule(user) {
  return resolveModuleAccess(user, 'operations', legacyCanViewOperationsModule)
}

function legacyCanWriteOperationsLegalDocuments(user) {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (isDepartmentHead(user) && userDept(user) === 'operations') return true
  return false
}

/** Upload/delete Operations legal documents (super_admin or operations department_head). */
function canWriteOperationsLegalDocuments(user) {
  return resolveModuleWrite(user, 'operations', legacyCanWriteOperationsLegalDocuments)
}

// ─── Attendance ───────────────────────────────────────────────────────────────

function isHrHead(user) {
  return isDepartmentHead(user) && userDept(user) === 'hr'
}

function canManageAttendance(user) {
  return resolveModuleWrite(user, 'hr', (subject) => isSuperAdmin(subject) || isHrHead(subject))
}

function canReviewLeave(user) {
  return isSuperAdmin(user) || isHrHead(user) || isDepartmentHead(user)
}

function scopedAttendanceDepartment(user) {
  if (!user) return null
  if (isSuperAdmin(user) || isManagement(user) || isHrHead(user)) return null
  if (user.role === 'department_head' || user.role === 'department_user') return userDept(user)
  return null
}

function canTouchAttendanceDepartment(user, dept) {
  if (isSuperAdmin(user) || isHrHead(user)) return true
  if (user.role === 'department_head') return userDept(user) === normalize(dept)
  return false
}

// ─── Messages ─────────────────────────────────────────────────────────────────

function canSeeAllMessages(user) {
  return isSuperAdmin(user) || isManagement(user)
}

/**
 * Involved-only chat visibility for all roles: DMs the user participates in,
 * group messages for groups in `memberGroupIds`, plus legacy group rows without
 * groupId if the user is sender or in recipientIds.
 *
 * @param {object} user - req.user
 * @param {import('mongoose').Types.ObjectId[]|string[]} memberGroupIds - from ChatGroup distinct for groups the user is in
 */
function buildMessageScopeForUser(user, memberGroupIds = []) {
  if (!user?._id) return { _id: { $exists: false } }
  const uid = user._id
  const name = normalize(user.name)
  const clauses = []

  const dmOr = [{ senderId: uid }, { recipientIds: uid }]
  if (name) {
    dmOr.push({ recipientNames: new RegExp(`^${escapeRegex(name)}$`, 'i') })
  }
  clauses.push({ type: 'dm', $or: dmOr })

  const groupIds = (memberGroupIds || []).filter(Boolean)
  if (groupIds.length) {
    clauses.push({ type: 'group', groupId: { $in: groupIds } })
  }

  clauses.push({
    type: 'group',
    $and: [
      { $or: [{ groupId: null }, { groupId: { $exists: false } }] },
      { $or: [{ senderId: uid }, { recipientIds: uid }] },
    ],
  })

  return { $or: clauses }
}

// ─── CRM ──────────────────────────────────────────────────────────────────────

function isSalesHead(user) {
  return isSuperAdmin(user) || (isDepartmentHead(user) && userDept(user) === 'sales')
}

function isSalesRep(user) {
  return isSuperAdmin(user) || isSalesHead(user) || (user?.role === 'department_user' && userDept(user) === 'sales')
}

function canViewCrm(user) {
  return resolveModuleAccess(user, 'sales', (subject) => (
    isSuperAdmin(subject)
    || isManagement(subject)
    || isSalesHead(subject)
    || isSalesRep(subject)
  ))
}

function canEditCrm(user) {
  return resolveModuleWrite(user, 'sales', (subject) => isSuperAdmin(subject) || isSalesHead(subject))
}

function canDeleteCrm(user) {
  return isSuperAdmin(user)
}

// ─── Department state ─────────────────────────────────────────────────────────

const DEPARTMENT_STATE_MODULES = ['finance', 'compliance', 'training', 'admin']

function canAccessDepartmentStateModule(user, module) {
  const normalizedModule = normalize(module)
  if (!DEPARTMENT_STATE_MODULES.includes(normalizedModule)) return false
  if (normalizedModule === 'admin') return isSuperAdmin(user)
  if (isSuperAdmin(user) || isManagement(user)) return true

  const dept = userDept(user)
  if (normalizedModule === 'finance') {
    return resolveModuleAccess(user, 'finance', () => dept === 'finance')
  }
  if (normalizedModule === 'compliance') {
    return resolveModuleAccess(user, 'government', () => dept === 'government' || dept === 'compliance')
  }
  if (normalizedModule === 'training') {
    return resolveModuleAccess(user, 'training', () => dept === 'hr' || dept === 'training')
  }
  return false
}

// ─── Finance module (/api/finance) ────────────────────────────────────────────

function canWriteFinanceModule(user) {
  return resolveModuleWrite(user, 'finance', (subject) => {
    if (isSuperAdmin(subject)) return true
    if (isDepartmentHead(subject)) {
      const dept = userDept(subject)
      return dept === 'finance' || dept === 'hr'
    }
    return false
  })
}

function canDeleteFinanceModule(user) {
  return isSuperAdmin(user)
}

// ─── Compliance module ────────────────────────────────────────────────────────

function canWriteComplianceModule(user) {
  return resolveModuleWrite(user, 'government', (subject) => {
    if (isSuperAdmin(subject)) return true
    if (isDepartmentHead(subject)) {
      const dept = userDept(subject)
      return dept === 'government' || dept === 'compliance' || dept === 'finance'
    }
    return false
  })
}

function canDeleteComplianceModule(user) {
  return isSuperAdmin(user)
}

// ─── Training module ──────────────────────────────────────────────────────────

function canWriteTrainingModule(user) {
  return resolveModuleWrite(user, 'training', (subject) => (
    isSuperAdmin(subject) || isDepartmentHead(subject)
  ))
}

function canDeleteTrainingModule(user) {
  return isSuperAdmin(user)
}

module.exports = {
  normalize,
  escapeRegex,
  isSuperAdmin,
  isManagement,
  isDepartmentHead,
  userDept,
  hasExplicitModulePermission,
  resolveModuleAccess,
  resolveModuleWrite,
  canManageEmployees,
  buildEmployeeReadFilter,
  isReadOnlyRole,
  canCreateTask,
  isTaskCreator,
  canMutateTask,
  canDeleteTask,
  canViewTask,
  buildTaskReadFilter,
  isDeptHead,
  isFinanceRole,
  canEditInventory,
  canViewInventoryCosts,
  canManageSuppliers,
  canCreatePO,
  canApprovePOBudget,
  canManageProduction,
  canManageLegacyErpFinance,
  canUploadProcDocs,
  canViewOperationsModule,
  canWriteOperationsLegalDocuments,
  isHrHead,
  canManageAttendance,
  canReviewLeave,
  scopedAttendanceDepartment,
  canTouchAttendanceDepartment,
  canSeeAllMessages,
  buildMessageScopeForUser,
  isSalesHead,
  isSalesRep,
  canViewCrm,
  canEditCrm,
  canDeleteCrm,
  DEPARTMENT_STATE_MODULES,
  canAccessDepartmentStateModule,
  canWriteFinanceModule,
  canDeleteFinanceModule,
  canWriteComplianceModule,
  canDeleteComplianceModule,
  canWriteTrainingModule,
  canDeleteTrainingModule,
  erp: erpAccessPolicy,
}
