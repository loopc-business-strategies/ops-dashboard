const BATCH_ENTRY_DIRECTIONS = ['IN', 'OUT']
const BATCH_ENTRY_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']
const BATCH_ENTRY_MAX_LINES = 8

/** Production flow stage keys an MG Floor operator can be assigned to (User.floorDepartment). */
const FLOOR_DEPARTMENTS = [
  'melting',
  'casting',
  'rolling',
  'bangle_division',
  'stamping',
  'polishing',
  'quality_control',
  'packing',
]

module.exports = {
  BATCH_ENTRY_DIRECTIONS,
  BATCH_ENTRY_STATUSES,
  BATCH_ENTRY_MAX_LINES,
  FLOOR_DEPARTMENTS,
}
