/** Shared enums / defaults for Production Control Center (additive; no ERP rewrites). */

const BATCH_STATUSES = [
  'CREATED',
  'AWAITING_ISSUE',
  'ISSUED',
  'IN_TRANSIT',
  'RECEIVED',
  'IN_PROCESS',
  'WAITING',
  'QC',
  'REWORK',
  'HOLD',
  'COMPLETED',
  'RETURNED_TO_VAULT',
  'CANCELLED',
]

const PASS_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'ISSUED',
  'IN_TRANSIT',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED',
]

const METAL_TYPES = ['Gold', 'Silver', 'Platinum', 'Other']

const GOLD_PURITIES = ['14K', '18K', '22K', '24K']

const QC_RESULTS = ['PASS', 'FAIL', 'HOLD', 'REWORK']

const MACHINE_STATUSES = ['RUNNING', 'IDLE', 'STOPPED', 'MAINTENANCE', 'FAULT', 'OFFLINE']

const PROCESS_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

const ALERT_SEVERITIES = ['info', 'warning', 'critical']

const PRODUCTION_ROLES = [
  'production_manager',
  'floor_manager',
  'department_head',
  'operator',
  'qc_inspector',
  'vault_officer',
]

const DEFAULT_FLOW_STAGES = [
  { key: 'vault', label: 'Vault', process: null, order: 0 },
  { key: 'melting', label: 'Melting', process: 'Melting', order: 1 },
  { key: 'casting', label: 'Casting', process: 'Casting', order: 2 },
  { key: 'rolling', label: 'Rolling', process: 'Rolling', order: 3 },
  { key: 'bangle_division', label: 'Bangle Division', process: 'Bangle Division', order: 4 },
  { key: 'stamping', label: 'Stamping', process: 'Stamping', order: 5 },
  { key: 'polishing', label: 'Polishing', process: 'Polishing', order: 6 },
  { key: 'quality_control', label: 'Quality Control', process: 'Quality Control', order: 7 },
  { key: 'packing', label: 'Packing', process: 'Packing', order: 8 },
  { key: 'vault_return', label: 'Vault', process: null, order: 9 },
]

const DEFAULT_WEIGHT_TOLERANCE_PCT = 0.5

const AUDIT_ACTIONS = {
  BATCH_CREATED: 'BATCH_CREATED',
  METAL_ISSUED: 'METAL_ISSUED',
  METAL_RECEIVED: 'METAL_RECEIVED',
  METAL_TRANSFERRED: 'METAL_TRANSFERRED',
  PROCESS_STARTED: 'PROCESS_STARTED',
  PROCESS_COMPLETED: 'PROCESS_COMPLETED',
  WEIGHT_ADJUSTED: 'WEIGHT_ADJUSTED',
  WEIGHT_VARIANCE_DETECTED: 'WEIGHT_VARIANCE_DETECTED',
  QC_SUBMITTED: 'QC_SUBMITTED',
  QC_PASSED: 'QC_PASSED',
  QC_FAILED: 'QC_FAILED',
  BATCH_HOLD: 'BATCH_HOLD',
  BATCH_RELEASED: 'BATCH_RELEASED',
  PASS_CREATED: 'PASS_CREATED',
  PASS_APPROVED: 'PASS_APPROVED',
  PASS_RECEIVED: 'PASS_RECEIVED',
  PASS_CANCELLED: 'PASS_CANCELLED',
  REWORK_STARTED: 'REWORK_STARTED',
  BATCH_COMPLETED: 'BATCH_COMPLETED',
  RETURNED_TO_VAULT: 'RETURNED_TO_VAULT',
  MACHINE_UPDATED: 'MACHINE_UPDATED',
  ALERT_RAISED: 'ALERT_RAISED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
}

const ACTIVE_BATCH_STATUSES = BATCH_STATUSES.filter(
  (s) => !['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(s),
)

module.exports = {
  BATCH_STATUSES,
  PASS_STATUSES,
  METAL_TYPES,
  GOLD_PURITIES,
  QC_RESULTS,
  MACHINE_STATUSES,
  PROCESS_STATUSES,
  ALERT_SEVERITIES,
  PRODUCTION_ROLES,
  DEFAULT_FLOW_STAGES,
  DEFAULT_WEIGHT_TOLERANCE_PCT,
  AUDIT_ACTIONS,
  ACTIVE_BATCH_STATUSES,
}
