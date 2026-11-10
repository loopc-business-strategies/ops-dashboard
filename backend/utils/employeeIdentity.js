/**
 * Normalize employee identity fields for duplicate detection.
 */

function normalizeIdNumber(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, '')
}

function normalizePhoneNumber(value) {
  return String(value || '')
    .trim()
    .replace(/\D/g, '')
}

function applyEmployeeIdentityNormalizedFields(payload = {}) {
  const out = { ...payload }
  if (Object.prototype.hasOwnProperty.call(payload, 'idNumber')) {
    out.idNumberNormalized = normalizeIdNumber(payload.idNumber)
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'phoneNumber')) {
    out.phoneNormalized = normalizePhoneNumber(payload.phoneNumber)
  }
  return out
}

const DUPLICATE_EMPLOYEE_MESSAGE =
  'This employee is already registered. Please check the existing employee record.'

const ARCHIVED_EMPLOYEE_MESSAGE =
  'This employee was previously archived. Reactivate the existing record instead of creating a duplicate.'

function duplicateEmployeeError(field, existingEmployeeId) {
  return {
    success: false,
    code: 'DUPLICATE_EMPLOYEE',
    field,
    existingEmployeeId: existingEmployeeId ? String(existingEmployeeId) : null,
    message: DUPLICATE_EMPLOYEE_MESSAGE,
  }
}

function archivedEmployeeError(field, existingEmployeeId) {
  return {
    success: false,
    code: 'ARCHIVED_EMPLOYEE',
    field,
    existingEmployeeId: existingEmployeeId ? String(existingEmployeeId) : null,
    message: ARCHIVED_EMPLOYEE_MESSAGE,
  }
}

function conflictFieldFor(employee, idNumberNormalized, phoneNormalized) {
  const empId = employee.idNumberNormalized || normalizeIdNumber(employee.idNumber)
  const empPhone = employee.phoneNormalized || normalizePhoneNumber(employee.phoneNumber)
  if (idNumberNormalized && empId === idNumberNormalized) return 'idNumber'
  if (phoneNormalized && empPhone === phoneNormalized) return 'phoneNumber'
  return idNumberNormalized ? 'idNumber' : 'phoneNumber'
}

/**
 * Find any employee (active or archived) colliding on normalized ID or phone.
 * @returns {{ field, employee, archived: boolean }|null}
 */
async function findEmployeeIdentityConflict(Model, {
  idNumberNormalized = '',
  phoneNormalized = '',
  excludeId = null,
} = {}) {
  if (!idNumberNormalized && !phoneNormalized) return null

  const query = {}
  if (excludeId) query._id = { $ne: excludeId }

  const clauses = []
  if (idNumberNormalized) clauses.push({ idNumberNormalized })
  if (phoneNormalized) clauses.push({ phoneNormalized })

  let employee = await Model.findOne({ ...query, $or: clauses })
    .select('_id name idNumber phoneNumber idNumberNormalized phoneNormalized isDeleted')
    .lean()

  if (!employee) {
    const legacy = await Model.find({
      ...query,
      $or: [
        { idNumberNormalized: { $in: [null, ''] } },
        { idNumberNormalized: { $exists: false } },
        { phoneNormalized: { $in: [null, ''] } },
        { phoneNormalized: { $exists: false } },
      ],
    })
      .select('_id name idNumber phoneNumber idNumberNormalized phoneNormalized isDeleted')
      .lean()

    for (const row of legacy) {
      const empId = row.idNumberNormalized || normalizeIdNumber(row.idNumber)
      const empPhone = row.phoneNormalized || normalizePhoneNumber(row.phoneNumber)
      if (idNumberNormalized && empId && empId === idNumberNormalized) {
        employee = row
        break
      }
      if (phoneNormalized && empPhone && empPhone === phoneNormalized) {
        employee = row
        break
      }
    }
  }

  if (!employee) return null

  return {
    field: conflictFieldFor(employee, idNumberNormalized, phoneNormalized),
    employee,
    archived: employee.isDeleted === true,
  }
}

/** @deprecated use findEmployeeIdentityConflict — kept as alias for active-only callers that still import the name */
async function findActiveEmployeeIdentityConflict(Model, opts) {
  const conflict = await findEmployeeIdentityConflict(Model, opts)
  if (!conflict || conflict.archived) return null
  return { field: conflict.field, employee: conflict.employee }
}

function isDuplicateKeyError(err) {
  return Boolean(err && err.code === 11000)
}

function duplicateFieldFromMongoError(err) {
  const key = err?.keyPattern || {}
  if (key.idNumberNormalized || key.idNumber) return 'idNumber'
  if (key.phoneNormalized || key.phoneNumber) return 'phoneNumber'
  if (key.employeeCode) return 'employeeCode'
  const msg = String(err?.message || '')
  if (/idNumberNormalized|idNumber/i.test(msg)) return 'idNumber'
  if (/phoneNormalized|phoneNumber/i.test(msg)) return 'phoneNumber'
  if (/employeeCode/i.test(msg)) return 'employeeCode'
  return null
}

module.exports = {
  normalizeIdNumber,
  normalizePhoneNumber,
  applyEmployeeIdentityNormalizedFields,
  DUPLICATE_EMPLOYEE_MESSAGE,
  ARCHIVED_EMPLOYEE_MESSAGE,
  duplicateEmployeeError,
  archivedEmployeeError,
  findEmployeeIdentityConflict,
  findActiveEmployeeIdentityConflict,
  isDuplicateKeyError,
  duplicateFieldFromMongoError,
}
