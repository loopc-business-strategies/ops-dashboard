/**
 * Reusable approval / segregation-of-duties helpers (additive).
 * Domain workflows keep their own services; call these for maker≠checker and thresholds.
 */

const SETTINGS_DEFAULTS = Object.freeze({
  stock_adjust: { requireApproval: true, amountThreshold: null, dualControl: false },
  gold_variance: { requireApproval: true, amountThreshold: null, dualControl: true },
  payment: { requireApproval: true, amountThreshold: 10000, dualControl: true },
  purchase: { requireApproval: true, amountThreshold: 25000, dualControl: false },
  production_exception: { requireApproval: true, amountThreshold: null, dualControl: false },
})

const VERBS = Object.freeze([
  'view', 'create', 'edit', 'submit', 'approve', 'post', 'delete', 'export',
])

function normalizeVerb(verb) {
  return String(verb || '').trim().toLowerCase()
}

/**
 * Additive verb check on modulePermissions[moduleKey].
 * Backward compatible: if only `{ on: true }` is set, treat as view+create+edit allowed;
 * approve/post/delete/export still require explicit true OR super_admin / legacy fallback.
 */
function hasModuleVerb(user, moduleKey, verb, { legacyAllow } = {}) {
  if (!user) return false
  if (user.role === 'super_admin') return true
  const v = normalizeVerb(verb)
  if (!VERBS.includes(v)) return false

  const perm = user.modulePermissions?.[moduleKey]
  if (perm && typeof perm === 'object') {
    if (perm.on === false) return false
    if (perm[v] === true) return true
    if (perm[v] === false) return false
    // Coarse legacy shape `{ on: true }` or `{ on: true, edit: false }`
    if (perm.on === true) {
      if (['view', 'create'].includes(v)) return true
      if (v === 'edit') return perm.edit !== false
      return false
    }
  }

  if (typeof legacyAllow === 'function') return Boolean(legacyAllow(user, v))
  return false
}

function resolveApprovalPolicy(entityType, settings = {}) {
  const key = String(entityType || '').trim().toLowerCase()
  const base = SETTINGS_DEFAULTS[key] || {
    requireApproval: false,
    amountThreshold: null,
    dualControl: false,
  }
  const override = settings[key] && typeof settings[key] === 'object' ? settings[key] : {}
  return {
    entityType: key,
    requireApproval: override.requireApproval != null ? Boolean(override.requireApproval) : base.requireApproval,
    amountThreshold: override.amountThreshold != null ? Number(override.amountThreshold) : base.amountThreshold,
    dualControl: override.dualControl != null ? Boolean(override.dualControl) : base.dualControl,
  }
}

/**
 * Returns null when allowed, or an error message string when blocked.
 */
function assertMakerChecker({ policy, creatorId, approverId, amount = null }) {
  if (!policy?.requireApproval) return null
  if (policy.amountThreshold != null && Number.isFinite(Number(amount))) {
    if (Number(amount) < Number(policy.amountThreshold)) return null
  }
  if (!policy.dualControl) return null
  const creator = creatorId != null ? String(creatorId) : ''
  const approver = approverId != null ? String(approverId) : ''
  if (!creator || !approver) {
    return 'Dual-control approval requires both creator and approver identities'
  }
  if (creator === approver) {
    return 'Segregation of duties: approver cannot be the same user as the creator'
  }
  return null
}

function isFinanceUser(user) {
  if (!user) return false
  if (user.role === 'super_admin') return true
  if (user.financeUser === true) return true
  const dept = String(user.department || '').toLowerCase()
  return user.role === 'department_head' && dept === 'finance'
}

module.exports = {
  VERBS,
  SETTINGS_DEFAULTS,
  hasModuleVerb,
  resolveApprovalPolicy,
  assertMakerChecker,
  isFinanceUser,
}
