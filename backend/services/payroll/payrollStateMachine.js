const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ['CALCULATED'],
  CALCULATED: ['UNDER_REVIEW', 'DRAFT'],
  UNDER_REVIEW: ['APPROVED', 'CALCULATED'],
  APPROVED: ['FINALIZED', 'UNDER_REVIEW'],
  FINALIZED: ['PAID'],
  PAID: [],
})

const IMMUTABLE_STATUSES = new Set(['FINALIZED', 'PAID'])

function canTransition(fromStatus, toStatus) {
  const from = String(fromStatus || '').toUpperCase()
  const to = String(toStatus || '').toUpperCase()
  const allowed = ALLOWED_TRANSITIONS[from] || []
  return allowed.includes(to)
}

function assertTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    const err = new Error(`Invalid payroll status transition: ${fromStatus} → ${toStatus}`)
    err.statusCode = 400
    err.code = 'INVALID_TRANSITION'
    throw err
  }
}

function isImmutable(status) {
  return IMMUTABLE_STATUSES.has(String(status || '').toUpperCase())
}

function assertMutable(run) {
  if (isImmutable(run?.status)) {
    const err = new Error(`Payroll run in ${run.status} cannot be modified.`)
    err.statusCode = 409
    err.code = 'RUN_IMMUTABLE'
    throw err
  }
}

module.exports = {
  ALLOWED_TRANSITIONS,
  IMMUTABLE_STATUSES,
  canTransition,
  assertTransition,
  isImmutable,
  assertMutable,
}
