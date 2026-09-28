const { PRODUCTION_DEPARTMENT_KEYS } = require('./productionDepartments')

const BATCH_ENTRY_DIRECTIONS = ['IN', 'OUT']
const BATCH_ENTRY_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']
const BATCH_ENTRY_MAX_LINES = 8

/** Departments an MG Floor operator can be assigned to (User.floorDepartment) = workbook departments. */
const FLOOR_DEPARTMENTS = PRODUCTION_DEPARTMENT_KEYS

/** Keys from the first MG Floor department list that have a workbook equivalent. */
const LEGACY_FLOOR_DEPARTMENT_ALIASES = {
  bangle_division: 'bangle_area',
  quality_control: 'qc',
  packing: 'finished_goods',
}

/** Lowercases and maps legacy keys; unknown values (e.g. old casting / polishing) are returned as-is. */
function aliasFloorDepartment(value) {
  const key = String(value || '').trim().toLowerCase()
  return LEGACY_FLOOR_DEPARTMENT_ALIASES[key] || key
}

/** A valid floor department key, or '' when unset or no longer offered. */
function normalizeFloorDepartment(value) {
  const key = aliasFloorDepartment(value)
  return FLOOR_DEPARTMENTS.includes(key) ? key : ''
}

module.exports = {
  BATCH_ENTRY_DIRECTIONS,
  BATCH_ENTRY_STATUSES,
  BATCH_ENTRY_MAX_LINES,
  FLOOR_DEPARTMENTS,
  LEGACY_FLOOR_DEPARTMENT_ALIASES,
  aliasFloorDepartment,
  normalizeFloorDepartment,
}
