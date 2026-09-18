/** Frontend permission helpers mirroring backend productionRole matrix (UX only — backend enforces). */
export const PCC_PERMISSIONS = {
  view: ['production_manager', 'floor_manager', 'department_head', 'operator', 'qc_inspector', 'vault_officer'],
  createBatch: ['production_manager', 'floor_manager'],
  issueMetal: ['production_manager', 'floor_manager', 'vault_officer'],
  approvePass: ['production_manager', 'floor_manager'],
  createPass: ['production_manager', 'floor_manager', 'department_head', 'operator', 'vault_officer'],
  receivePass: ['production_manager', 'floor_manager', 'department_head', 'operator', 'vault_officer', 'qc_inspector'],
  startProcess: ['production_manager', 'floor_manager', 'department_head', 'operator'],
  completeProcess: ['production_manager', 'floor_manager', 'department_head', 'operator'],
  submitQc: ['production_manager', 'qc_inspector', 'floor_manager'],
  adjustWeight: ['production_manager'],
  holdRelease: ['production_manager', 'floor_manager'],
  returnToVault: ['production_manager', 'floor_manager', 'vault_officer'],
  manageMachines: ['production_manager', 'floor_manager'],
  manageFlow: ['production_manager'],
  resolveAlert: ['production_manager', 'floor_manager'],
  raiseAlert: ['production_manager', 'floor_manager', 'department_head', 'operator', 'qc_inspector', 'vault_officer'],
  splitMergeBatch: ['production_manager', 'floor_manager'],
  manageMaintenance: ['production_manager', 'floor_manager'],
  viewAudit: ['production_manager', 'floor_manager'],
  viewReports: ['production_manager', 'floor_manager'],
  manageShifts: ['production_manager'],
  floorSession: ['production_manager', 'floor_manager'],
  manageStock: ['production_manager', 'floor_manager', 'vault_officer'],
}

export function canPcc(role, permission) {
  if (!role) return false
  if (role === 'production_manager' || role === 'super_admin' || role === 'demo') return true
  const allowed = PCC_PERMISSIONS[permission] || []
  return allowed.includes(role)
}
