/**
 * Operations → Production workbook departments (every tenant).
 * MG Floor operators are assigned to the same keys (User.floorDepartment), so approved floor
 * batches land in the matching workbook sheet.
 */
const PRODUCTION_DEPARTMENT_KEYS = [
  'vault_room',
  'melting',
  'rolling',
  'bangle_area',
  'stamping',
  'pendent_section',
  'welding_area',
  'assembly',
  'qc',
  'finished_goods',
]

module.exports = { PRODUCTION_DEPARTMENT_KEYS }
