const {
  BATCH_STATUS_TRANSITIONS,
  PASS_STATUS_TRANSITIONS,
} = require('./constants')
const { ProductionError } = require('./errors')

/**
 * Centralized status transition enforcement for Production Control.
 * Same-status is a no-op (allowed). Unknown from-status rejects.
 */
function assertStatusTransition(entity, from, to, { allowSame = true } = {}) {
  if (from === to) {
    if (allowSame) return
    throw new ProductionError(`Invalid ${entity} transition: already ${to}`)
  }

  const map =
    entity === 'batch' ? BATCH_STATUS_TRANSITIONS
      : entity === 'pass' ? PASS_STATUS_TRANSITIONS
        : null

  if (!map) {
    throw new ProductionError(`Unknown transition entity: ${entity}`)
  }

  const allowed = map[from]
  if (!allowed) {
    throw new ProductionError(
      `Cannot change ${entity} status from ${from} to ${to}: no transitions defined for ${from}`,
    )
  }
  if (!allowed.includes(to)) {
    throw new ProductionError(
      `Invalid ${entity} status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || '(none)'}`,
    )
  }
}

function normalizeDepartmentKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

/**
 * Compare pass fromDepartment against batch custody location.
 * Accepts either stage key (vault) or label (Vault).
 */
function departmentsMatch(a, b) {
  const na = normalizeDepartmentKey(a)
  const nb = normalizeDepartmentKey(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const aliases = {
    vault_return: 'vault',
    packaging: 'packing',
    packing: 'packing',
    quality_control: 'quality_control',
    qc: 'quality_control',
  }
  const ca = aliases[na] || na
  const cb = aliases[nb] || nb
  return ca === cb
}

module.exports = {
  assertStatusTransition,
  normalizeDepartmentKey,
  departmentsMatch,
}
