/** Normalize employee National ID / phone for duplicate detection (mirrors backend). */

export function normalizeIdNumber(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, '')
}

export function normalizePhoneNumber(value) {
  return String(value || '')
    .trim()
    .replace(/\D/g, '')
}

/**
 * Find an existing employee colliding on ID or phone.
 * @returns {{ field: 'idNumber'|'phoneNumber', employee }|null}
 */
export function findLocalEmployeeIdentityConflict(employees = [], { idNumber, phoneNumber, excludeId = null } = {}) {
  const idNorm = normalizeIdNumber(idNumber)
  const phoneNorm = normalizePhoneNumber(phoneNumber)
  if (!idNorm && !phoneNorm) return null

  for (const emp of employees) {
    if (!emp || (excludeId && String(emp._id) === String(excludeId))) continue
    if (emp.isDeleted === true) continue

    const empIdNorm = emp.idNumberNormalized
      ? String(emp.idNumberNormalized)
      : normalizeIdNumber(emp.idNumber)
    const empPhoneNorm = emp.phoneNormalized
      ? String(emp.phoneNormalized)
      : normalizePhoneNumber(emp.phoneNumber)

    if (idNorm && empIdNorm && idNorm === empIdNorm) {
      return { field: 'idNumber', employee: emp }
    }
    if (phoneNorm && empPhoneNorm && phoneNorm === empPhoneNorm) {
      return { field: 'phoneNumber', employee: emp }
    }
  }
  return null
}
