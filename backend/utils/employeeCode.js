/**
 * Sequential EMP-NNN allocation across all employees (including archived).
 */

const CODE_RE = /^(?:EMP-)?(\d+)$/i

function parseEmployeeCodeSuffix(code) {
  const match = String(code || '').trim().match(CODE_RE)
  if (!match) return 0
  return Number(match[1]) || 0
}

function formatEmployeeCode(n) {
  return `EMP-${String(Math.max(1, Number(n) || 1)).padStart(3, '0')}`
}

/**
 * Next EMP code from max numeric suffix among all docs (incl. soft-deleted).
 */
async function allocateNextEmployeeCode(Model) {
  const rows = await Model.find({})
    .select('employeeCode')
    .lean()
  let maxSuffix = 0
  for (const row of rows) {
    maxSuffix = Math.max(maxSuffix, parseEmployeeCodeSuffix(row.employeeCode))
  }
  return formatEmployeeCode(maxSuffix + 1)
}

async function employeeCodeExists(Model, code, excludeId = null) {
  const normalized = String(code || '').trim()
  if (!normalized) return false
  const q = { employeeCode: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  if (excludeId) q._id = { $ne: excludeId }
  const hit = await Model.findOne(q).select('_id').lean()
  return Boolean(hit)
}

/**
 * Prefer client code when unique; otherwise allocate next free EMP-N.
 */
async function resolveEmployeeCodeForCreate(Model, requestedCode) {
  const requested = String(requestedCode || '').trim()
  if (requested && !(await employeeCodeExists(Model, requested))) {
    return requested
  }
  return allocateNextEmployeeCode(Model)
}

module.exports = {
  parseEmployeeCodeSuffix,
  formatEmployeeCode,
  allocateNextEmployeeCode,
  employeeCodeExists,
  resolveEmployeeCodeForCreate,
}
