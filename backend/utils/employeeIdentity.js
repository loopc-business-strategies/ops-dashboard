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

function duplicateEmployeeError(field, existingEmployeeId) {
  return {
    success: false,
    code: 'DUPLICATE_EMPLOYEE',
    field,
    existingEmployeeId: existingEmployeeId ? String(existingEmployeeId) : null,
    message: DUPLICATE_EMPLOYEE_MESSAGE,
  }
}

/**
 * Find an active employee colliding on normalized ID or phone.
 * Includes legacy rows that never stored normalized fields.
 * @returns {{ field: 'idNumber'|'phoneNumber', employee }|null}
 */
async function findActiveEmployeeIdentityConflict(Model, {
  idNumberNormalized = '',
  phoneNormalized = '',
  excludeId = null,
} = {}) {
  if (!idNumberNormalized && !phoneNormalized) return null

  const query = { isDeleted: { $ne: true } }
  if (excludeId) query._id = { $ne: excludeId }

  const clauses = []
  if (idNumberNormalized) clauses.push({ idNumberNormalized })
  if (phoneNormalized) clauses.push({ phoneNormalized })

  let employee = await Model.findOne({ ...query, $or: clauses })
    .select('_id name idNumber phoneNumber idNumberNormalized phoneNormalized')
    .lean()

  if (!employee) {
    // Legacy fallback: active rows missing/empty normalized fields
    const legacy = await Model.find({
      ...query,
      $or: [
        { idNumberNormalized: { $in: [null, ''] } },
        { idNumberNormalized: { $exists: false } },
        { phoneNormalized: { $in: [null, ''] } },
        { phoneNormalized: { $exists: false } },
      ],
    })
      .select('_id name idNumber phoneNumber idNumberNormalized phoneNormalized')
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

  const empId = employee.idNumberNormalized || normalizeIdNumber(employee.idNumber)
  const empPhone = employee.phoneNormalized || normalizePhoneNumber(employee.phoneNumber)
  if (idNumberNormalized && empId === idNumberNormalized) {
    return { field: 'idNumber', employee }
  }
  if (phoneNormalized && empPhone === phoneNormalized) {
    return { field: 'phoneNumber', employee }
  }
  return { field: idNumberNormalized ? 'idNumber' : 'phoneNumber', employee }
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
  duplicateEmployeeError,
  findActiveEmployeeIdentityConflict,
  isDuplicateKeyError,
  duplicateFieldFromMongoError,
}
