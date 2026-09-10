const { PRODUCTION_ROLES } = require('./constants')

/**
 * Resolve effective production role without mutating User.role enum.
 * Optional additive field `user.productionRole` wins when set.
 */
function resolveProductionRole(user) {
  if (!user) return null
  const explicit = String(user.productionRole || '').trim()
  if (PRODUCTION_ROLES.includes(explicit)) return explicit

  if (user.role === 'super_admin') return 'production_manager'
  if (user.role === 'management') return 'production_manager'

  const dept = String(user.department || '').toLowerCase()
  if (dept === 'production') {
    if (user.role === 'department_head') return 'floor_manager'
    if (user.role === 'department_user') return 'operator'
  }

  return null
}

const PERMISSIONS = {
  view: ['production_manager', 'floor_manager', 'department_head', 'operator', 'qc_inspector', 'vault_officer'],
  createBatch: ['production_manager', 'floor_manager'],
  issueMetal: ['production_manager', 'floor_manager', 'vault_officer'],
  approvePass: ['production_manager', 'floor_manager'],
  createPass: ['production_manager', 'floor_manager', 'department_head', 'operator', 'vault_officer'],
  receivePass: ['production_manager', 'floor_manager', 'department_head', 'operator', 'vault_officer', 'qc_inspector'],
  startProcess: ['production_manager', 'floor_manager', 'department_head', 'operator'],
  completeProcess: ['production_manager', 'floor_manager', 'department_head', 'operator'],
  submitQc: ['production_manager', 'qc_inspector', 'floor_manager'],
  adjustWeight: ['production_manager'],
  holdRelease: ['production_manager', 'floor_manager'],
  returnToVault: ['production_manager', 'floor_manager', 'vault_officer'],
  manageMachines: ['production_manager', 'floor_manager'],
  manageFlow: ['production_manager'],
  raiseAlert: ['production_manager', 'floor_manager', 'department_head', 'operator', 'qc_inspector', 'vault_officer'],
  resolveAlert: ['production_manager', 'floor_manager'],
  viewAudit: ['production_manager', 'floor_manager'],
}

function hasProductionPermission(user, permission) {
  if (user?.role === 'super_admin') return true
  const role = resolveProductionRole(user)
  if (!role) return false
  const allowed = PERMISSIONS[permission] || []
  return allowed.includes(role)
}

function requireProductionPermission(permission) {
  return (req, res, next) => {
    if (!hasProductionPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient production permission: ${permission}`,
      })
    }
    return next()
  }
}

module.exports = {
  resolveProductionRole,
  hasProductionPermission,
  requireProductionPermission,
  PERMISSIONS,
}
