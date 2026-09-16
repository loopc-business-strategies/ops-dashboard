function toAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function sumComponents(components = []) {
  return (Array.isArray(components) ? components : []).reduce((sum, item) => sum + toAmount(item?.amount), 0)
}

function normalizeComponents(components = []) {
  return (Array.isArray(components) ? components : []).map((item) => ({
    code: String(item?.code || '').trim() || 'ITEM',
    label: String(item?.label || item?.code || '').trim(),
    amount: toAmount(item?.amount),
  }))
}

/**
 * Pure payroll line calculation from a salary assignment snapshot.
 * Attendance fields are stored for display only — they do not alter amounts.
 */
function calculateLineFromAssignment(assignment, employee = {}) {
  const earnings = normalizeComponents(assignment?.earnings)
  const deductions = normalizeComponents(assignment?.deductions)
  const employerContributions = normalizeComponents(assignment?.employerContributions)

  const gross = sumComponents(earnings)
  const totalDeductions = sumComponents(deductions)
  const net = Math.round((gross - totalDeductions) * 100) / 100
  const employerTotal = sumComponents(employerContributions)

  return {
    employeeId: employee._id || employee.id || assignment?.employeeId,
    employeeCode: employee.employeeCode || '',
    employeeName: employee.name || '',
    department: employee.department || '',
    position: employee.position || '',
    salaryAssignmentId: assignment?._id || null,
    salaryAssignmentVersion: assignment?.version ?? null,
    earnings,
    deductions,
    employerContributions,
    gross,
    totalDeductions,
    net: net < 0 ? 0 : net,
    employerTotal,
  }
}

function calculateRunTotals(lines = []) {
  const list = Array.isArray(lines) ? lines : []
  return {
    employeeCount: list.length,
    gross: Math.round(list.reduce((s, l) => s + toAmount(l.gross), 0) * 100) / 100,
    deductions: Math.round(list.reduce((s, l) => s + toAmount(l.totalDeductions), 0) * 100) / 100,
    net: Math.round(list.reduce((s, l) => s + toAmount(l.net), 0) * 100) / 100,
    employerTotal: Math.round(list.reduce((s, l) => s + toAmount(l.employerTotal), 0) * 100) / 100,
  }
}

module.exports = {
  toAmount,
  sumComponents,
  normalizeComponents,
  calculateLineFromAssignment,
  calculateRunTotals,
}
